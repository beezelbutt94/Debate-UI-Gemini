# Show me how to build an agent task that automatically scrapes the prospect's LinkedIn/website and prepares an executive briefing document 1 hour before a scheduled demo.

> Status in this repo: Implemented: pre-demo briefing (website only; no LinkedIn scraping)

To prepare for sales calls automatically, build an **Autonomous Pre-Demo Briefing Agent**. 

This subsystem runs via Celery Beat every 15 minutes, checks for upcoming `demo_bookings` starting within the next **45 to 75 minutes**, enriches the prospect by scraping their company website and engineering footprint, prompts Claude Code to synthesize a high-impact **1-page Executive Briefing document**, and stores it in PostgreSQL, ChromaDB, and on the Next.js dashboard.

---

### Pipeline Architecture

```
 [ Celery Beat Cron (Every 15 min) ]
                  │
                  ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ 1. Schedule Lookahead Scanner                               │
 │    - Query: `demo_bookings` where start_time is in [T+45m, T+75m]│
 │    - Filter: `briefing_generated == False`                  │
 └──────────────────────────────┬──────────────────────────────┘
                                │
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ 2. Multi-Source Lead & Tech Stack Scraper                   │
 │    - Company Domain: Homepage, /about, /careers (httpx)     │
 │    - Open Job Listings: Detects stack (e.g. k8s, Celery, Go)│
 │    - GitHub/LinkedIn Public Metadata                        │
 └──────────────────────────────┬──────────────────────────────┘
                                │
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ 3. Executive Briefing Synthesizer (Claude Code)             │
 │    - Company Overview & Business Model                      │
 │    - Detected Tech Stack & Inferred Bottlenecks             │
 │    - 3 Tailored Value Hooks & Likely Objections             │
 │    - Recommended Demo Agenda & Pilot Proposal               │
 └──────────────────────────────┬──────────────────────────────┘
                                │
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ 4. Storage & Operator Delivery                              │
 │    - Saves `PreDemoBriefing` record in PostgreSQL           │
 │    - Ingests into ChromaDB for real-time RAG                │
 │    - Pushes WebSocket event to Next.js Operator Drawer      │
 └─────────────────────────────────────────────────────────────┘
```

---

## 1. Database Schema (`app/models.py`)

Add a model to store the synthesized executive briefing and link it to the demo booking:

```python
# Add to app/models.py:
from sqlalchemy import Column, String, Text, DateTime, Boolean, ForeignKey, JSON
from datetime import datetime, timezone
from sqlalchemy.orm import relationship
from app.db import Base

class PreDemoBriefing(Base):
    __tablename__ = "pre_demo_briefings"

    id = Column(String, primary_key=True, index=True)
    booking_id = Column(String, ForeignKey("demo_bookings.id"), unique=True, nullable=False)
    customer_id = Column(String, ForeignKey("customer_accounts.id"), nullable=False)
    company_name = Column(String, index=True)
    attendee_name = Column(String)
    
    # Synthesized Content
    executive_summary = Column(Text)
    detected_stack_summary = Column(Text)
    pain_points_json = Column(JSON)          # ["Pain point 1", "Pain point 2"]
    value_hooks_json = Column(JSON)          # ["Hook 1", "Hook 2"]
    likely_objections_json = Column(JSON)    # [{"objection": "...", "counter": "..."}]
    markdown_document = Column(Text)         # Full structured 1-page briefing
    
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

# Add `briefing` relationship to DemoBooking:
# DemoBooking.briefing = relationship("PreDemoBriefing", uselist=False, backref="booking")
```

---

## 2. Lead & Career Page Scraper (`app/lead_enricher.py`)

Job postings are the most reliable indicator of a company’s active engineering pain points and dependencies. This module scrapes the company homepage, `/careers`, or `/jobs` page to extract live technical stack context:

```python
import re
import httpx
from bs4 import BeautifulSoup
from typing import Dict, Any, List
from app.config import settings

COMMON_TECH_KEYWORDS = [
    "kubernetes", "k8s", "docker", "celery", "fastapi", "django", "flask",
    "redis", "postgresql", "postgres", "kafka", "rabbitmq", "aws", "gcp",
    "terraform", "github actions", "microservices", "python", "typescript",
    "go", "golang", "datadog", "sentry", "snowflake"
]

class LeadEnricher:
    @staticmethod
    def scrape_company_domain(email_or_domain: str) -> Dict[str, Any]:
        """
        Extracts domain from email, scrapes homepage and careers/about pages,
        and derives tech stack signatures.
        """
        # Extract domain from email if necessary
        if "@" in email_or_domain:
            domain = email_or_domain.split("@")[-1].lower()
        else:
            domain = email_or_domain.lower()

        # Handle common public email providers
        if domain in ["gmail.com", "yahoo.com", "outlook.com", "proton.me"]:
            return {
                "domain": domain,
                "homepage_text": "Personal email provided. No corporate domain available.",
                "careers_text": "",
                "inferred_stack": []
            }

        if settings.SANDBOX_MODE:
            return {
                "domain": domain,
                "homepage_text": f"InnovaTech delivers automated financial microservices and queue infrastructure.",
                "careers_text": "Hiring Senior Backend Engineer: Must have experience scaling Celery task queues, Redis, and FastAPI in Docker.",
                "inferred_stack": ["Celery", "FastAPI", "Docker", "Redis", "PostgreSQL"]
            }

        base_url = f"https://{domain}"
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0 Safari/537.36"}

        homepage_text = ""
        careers_text = ""

        with httpx.Client(follow_redirects=True, timeout=12, headers=headers) as client:
            # 1. Scrape Homepage
            try:
                resp = client.get(base_url)
                if resp.status_code == 200:
                    soup = BeautifulSoup(resp.text, "html.parser")
                    for s in soup(["script", "style", "nav", "footer", "svg"]):
                        s.decompose()
                    homepage_text = " ".join(soup.get_text().split())[:3000]
            except Exception:
                pass

            # 2. Try Scraping Careers / About
            for path in ["/careers", "/jobs", "/about"]:
                try:
                    resp = client.get(f"{base_url}{path}")
                    if resp.status_code == 200:
                        soup = BeautifulSoup(resp.text, "html.parser")
                        for s in soup(["script", "style", "nav", "footer", "svg"]):
                            s.decompose()
                        careers_text += " " + " ".join(soup.get_text().split())[:2500]
                        break
                except Exception:
                    continue

        # Detect technical stack keywords from combined text
        corpus = (homepage_text + " " + careers_text).lower()
        detected_stack = [kw.capitalize() for kw in COMMON_TECH_KEYWORDS if re.search(rf"\b{kw}\b", corpus)]

        return {
            "domain": domain,
            "homepage_text": homepage_text or "Could not extract homepage content.",
            "careers_text": careers_text or "No public careers page found.",
            "inferred_stack": list(set(detected_stack))
        }
```

---

## 3. Executive Briefing Synthesizer (`app/briefing_agent.py`)

This service brings together the booking metadata, enriched scraped company text, and previous outbound email history, prompting Claude Code to synthesize a structured 1-page briefing:

```python
import json
import uuid
from typing import Dict, Any
from app.runner import run_claude_headless
from app.config import settings
from app.db import SessionLocal
from app.models import DemoBooking, CustomerAccount, PreDemoBriefing, Prospect
from app.lead_enricher import LeadEnricher
from app.memory import AgentMemory

class PreDemoBriefingAgent:
    @classmethod
    def generate_briefing_for_booking(cls, booking_id: str) -> Dict[str, Any]:
        db = SessionLocal()
        booking = db.query(DemoBooking).filter(DemoBooking.id == booking_id).first()
        if not booking:
            db.close()
            raise ValueError(f"Booking {booking_id} not found")

        customer = booking.customer
        prospect = db.query(Prospect).filter(Prospect.email == customer.primary_email).first()

        # 1. Scrape Company Web Presence & Open Roles
        enriched = LeadEnricher.scrape_company_domain(customer.primary_email)
        
        # Combine detected tech keywords with any existing stack data
        combined_stack = list(set((customer.detected_tech_stack or "").split(", ") + enriched["inferred_stack"]))
        combined_stack = [s for s in combined_stack if s and s != "Not Detected"]

        context_payload = {
            "company_name": customer.company_name,
            "attendee_name": customer.contact_name or "Engineering Leader",
            "email": customer.primary_email,
            "meeting_title": booking.event_title,
            "scheduled_time": booking.start_time.strftime("%Y-%m-%d %H:%M UTC"),
            "booking_form_responses": booking.responses_json or {},
            "scraped_homepage_summary": enriched["homepage_text"][:1500],
            "careers_page_signals": enriched["careers_text"][:1500],
            "confirmed_tech_stack": combined_stack,
            "outbound_prospecting_history": prospect.detected_tech_stack if prospect else "Inbound direct"
        }

        # 2. Prompt Claude Code to generate the structured 1-page briefing
        prompt = (
            "You are the Principal Solutions Architect and Strategic Sales Lead for Polsia.\n"
            "An enterprise software engineering demo is starting in 1 hour. Synthesize a razor-sharp, "
            "actionable 1-page Executive Pre-Demo Briefing.\n\n"
            f"PROSPECT & COMPANY INTELLIGENCE:\n{json.dumps(context_payload, indent=2)}\n\n"
            "BRIEFING CRITERIA:\n"
            "1. Zero fluff. Focus purely on technical architecture, production bottlenecks, and business ROI.\n"
            "2. Identify likely bottlenecks based on their stack (e.g., Celery queue stalls, CI flaky tests, gVisor isolation needs).\n"
            "3. Formulate 3 compelling value hooks tailored specifically to their infrastructure.\n"
            "4. Predict the 2 most likely technical objections and provide concise rebuttal anchors.\n"
            "5. Structure a concrete 25-minute demo agenda ending in an actionable POC pilot offer.\n\n"
            "OUTPUT SPECIFICATION (STRICT JSON ONLY):\n"
            "{\n"
            '  "executive_summary": "2-3 sentences on what the company does and why they booked",\n'
            '  "detected_stack_summary": "Concise summary of their tech footprint",\n'
            '  "pain_points": ["Pain point 1", "Pain point 2", "Pain point 3"],\n'
            '  "value_hooks": ["Hook 1", "Hook 2", "Hook 3"],\n'
            '  "likely_objections": [\n'
            '    {"objection": "Security concern regarding agent code execution", "counter": "Explain gVisor runsc syscall sandbox and Envoy egress proxy."}\n'
            '  ],\n'
            '  "markdown_document": "# Full structured 1-page markdown document formatted for quick reading..."\n'
            "}"
        )

        res = run_claude_headless(
            prompt=prompt,
            agent_name="PreDemoBriefingAgent"
        )
        
        try:
            data = json.loads(res.get("result", "{}"))
        except Exception:
            data = {
                "executive_summary": f"Demo with {customer.company_name}",
                "detected_stack_summary": ", ".join(combined_stack),
                "pain_points": ["Engineering pipeline friction"],
                "value_hooks": ["Autonomous self-healing git workflows"],
                "likely_objections": [],
                "markdown_document": f"# Pre-Demo Briefing: {customer.company_name}\n\nAutomated briefing generation encountered parse error."
            }

        # 3. Store Briefing Record in Database
        briefing_id = str(uuid.uuid4())
        record = PreDemoBriefing(
            id=briefing_id,
            booking_id=booking.id,
            customer_id=customer.id,
            company_name=customer.company_name,
            attendee_name=customer.contact_name,
            executive_summary=data.get("executive_summary", ""),
            detected_stack_summary=data.get("detected_stack_summary", ", ".join(combined_stack)),
            pain_points_json=data.get("pain_points", []),
            value_hooks_json=data.get("value_hooks", []),
            likely_objections_json=data.get("likely_objections", []),
            markdown_document=data.get("markdown_document", "")
        )
        db.add(record)
        db.commit()

        # 4. Ingest Document into ChromaDB for On-Demand Querying
        memory = AgentMemory("SalesIntelligence")
        memory.record_memory(
            content=(
                f"Executive Briefing for {customer.company_name} ({customer.contact_name}):\n"
                f"{data.get('executive_summary')}\n"
                f"Stack: {data.get('detected_stack_summary')}\n"
                f"Pain Points: {json.dumps(data.get('pain_points'))}"
            ),
            metadata={"booking_id": booking.id, "company": customer.company_name, "type": "EXECUTIVE_BRIEFING"}
        )

        db.close()
        return {"briefing_id": briefing_id, "data": data}
```

---

## 4. Automated 15-Minute Lookahead Poller (`app/tasks.py`)

Configure the Celery task that checks for bookings scheduled to start within the next hour:

```python
# Add to app/tasks.py:
from datetime import datetime, timezone, timedelta
from app.models import DemoBooking, PreDemoBriefing
from app.briefing_agent import PreDemoBriefingAgent

@celery_app.task
def check_and_generate_upcoming_briefings():
    """
    Scans for demo bookings starting between 45 and 75 minutes from now
    that do not yet have a synthesized briefing.
    """
    db = SessionLocal()
    now = datetime.now(timezone.utc)
    window_start = now + timedelta(minutes=45)
    window_end = now + timedelta(minutes=75)

    # Find un-briefed bookings in the window
    upcoming_bookings = db.query(DemoBooking).filter(
        DemoBooking.start_time.between(window_start, window_end),
        DemoBooking.status == "ACCEPTED"
    ).all()

    generated = []
    for b in upcoming_bookings:
        # Verify briefing doesn't already exist
        existing = db.query(PreDemoBriefing).filter(PreDemoBriefing.booking_id == b.id).first()
        if existing:
            continue

        try:
            res = PreDemoBriefingAgent.generate_briefing_for_booking(booking_id=b.id)
            generated.append({"booking_id": b.id, "company": b.customer.company_name})
            
            # Broadcast to WebSocket dashboard
            r.publish("polsia:events", json.dumps({
                "event": "PRE_DEMO_BRIEFING_READY",
                "booking_id": b.id,
                "briefing_id": res["briefing_id"],
                "company": b.customer.company_name,
                "contact_name": b.customer.contact_name,
                "start_time": b.start_time.isoformat()
            }))
        except Exception as e:
            print(f"[Briefing Error] Failed generating briefing for booking {b.id}: {e}")

    db.close()
    return {"scanned_window": f"{window_start.isoformat()} to {window_end.isoformat()}", "briefings_generated": len(generated)}
```

Add the task to the Celery Beat schedule in `app/celery_app.py`:

```python
# In celery_app.conf.beat_schedule in app/celery_app.py:

    "pre-demo-briefing-lookahead": {
        "task": "app.tasks.check_and_generate_upcoming_briefings",
        "schedule": crontab(minute="*/15"), # Every 15 minutes
    },
```

---

## 5. API Endpoints (`app/main.py`)

Expose endpoints to retrieve briefings and trigger on-demand generation:

```python
# Add to app/main.py:
from app.models import PreDemoBriefing
from app.briefing_agent import PreDemoBriefingAgent

@app.get("/briefings/pre-demo/{booking_id}")
def get_pre_demo_briefing(booking_id: str, db: Session = Depends(get_db)):
    briefing = db.query(PreDemoBriefing).filter(PreDemoBriefing.booking_id == booking_id).first()
    if not briefing:
        raise HTTPException(status_code=404, detail="Briefing not generated yet")
    return {
        "id": briefing.id,
        "booking_id": briefing.booking_id,
        "company_name": briefing.company_name,
        "attendee_name": briefing.attendee_name,
        "executive_summary": briefing.executive_summary,
        "detected_stack_summary": briefing.detected_stack_summary,
        "pain_points": briefing.pain_points_json,
        "value_hooks": briefing.value_hooks_json,
        "likely_objections": briefing.likely_objections_json,
        "markdown_document": briefing.markdown_document,
        "created_at": briefing.created_at.isoformat()
    }

@app.post("/briefings/pre-demo/{booking_id}/generate")
def force_generate_briefing(booking_id: str):
    """Manual trigger from dashboard to generate immediately."""
    result = PreDemoBriefingAgent.generate_briefing_for_booking(booking_id)
    return result
```

---

## 6. Next.js Executive Briefing Drawer (`components/PreDemoBriefingModal.tsx`)

This component renders an executive briefing dossier in a slide-out modal with value hooks, predicted objections, and copyable meeting notes:

```tsx
"use client";

import { useEffect, useState } from "react";
import { FileText, Target, ShieldQuestion, Layers, X, Copy, Check, ExternalLink, Calendar } from "lucide-react";

interface BriefingData {
  id: string;
  booking_id: string;
  company_name: string;
  attendee_name: string;
  executive_summary: string;
  detected_stack_summary: string;
  pain_points: string[];
  value_hooks: string[];
  likely_objections: Array<{ objection: string; counter: string }>;
  markdown_document: string;
}

interface Props {
  bookingId: string | null;
  onClose: () => void;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function PreDemoBriefingModal({ bookingId, onClose }: Props) {
  const [data, setData] = useState<BriefingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!bookingId) return;

    const fetchBriefing = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_URL}/briefings/pre-demo/${bookingId}`);
        if (res.ok) {
          setData(await res.json());
        } else {
          // If not generated yet, trigger on-demand generation
          const genRes = await fetch(`${API_URL}/briefings/pre-demo/${bookingId}/generate`, { method: "POST" });
          if (genRes.ok) {
            const result = await genRes.json();
            setData(result.data);
          }
        }
      } catch (err) {
        console.error("Failed to load briefing", err);
      } finally {
        setLoading(false);
      }
    };

    fetchBriefing();
  }, [bookingId]);

  if (!bookingId) return null;

  const copyToClipboard = () => {
    if (!data) return;
    navigator.clipboard.writeText(data.markdown_document);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-800 bg-zinc-900/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold font-mono text-white uppercase tracking-wider">
                {loading ? "Synthesizing Intel..." : `Pre-Demo Briefing: ${data?.company_name}`}
              </h2>
              <p className="text-xs text-zinc-400 font-mono">
                {data?.attendee_name} • 1-Hour Call Preparation
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {data && (
              <button
                onClick={copyToClipboard}
                className="text-xs font-mono text-zinc-300 hover:text-white px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800/60 flex items-center gap-1.5 transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied" : "Copy Doc"}
              </button>
            )}
            <button onClick={onClose} className="text-zinc-400 hover:text-white p-1 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm font-sans text-zinc-200">
          {loading && (
            <div className="py-24 text-center font-mono text-zinc-500">
              Scraping careers page, dependencies, and generating executive dossier...
            </div>
          )}

          {data && (
            <>
              {/* Executive Summary */}
              <div className="p-4 rounded-xl bg-indigo-950/30 border border-indigo-500/20">
                <span className="text-[10px] font-mono uppercase text-indigo-400 font-bold block mb-1">
                  Executive Context
                </span>
                <p className="text-sm text-zinc-200 leading-relaxed font-sans">{data.executive_summary}</p>
              </div>

              {/* Detected Footprint */}
              <div>
                <span className="text-xs font-mono uppercase text-zinc-400 font-bold flex items-center gap-1.5 mb-2">
                  <Layers className="w-4 h-4 text-sky-400" /> Detected Architecture Footprint
                </span>
                <div className="p-3 bg-black/40 border border-zinc-800/80 rounded-xl text-xs font-mono text-zinc-300">
                  {data.detected_stack_summary}
                </div>
              </div>

              {/* High-Impact Value Hooks */}
              <div>
                <span className="text-xs font-mono uppercase text-zinc-400 font-bold flex items-center gap-1.5 mb-2">
                  <Target className="w-4 h-4 text-emerald-400" /> Tailored Pitch Angles
                </span>
                <div className="space-y-2">
                  {data.value_hooks.map((hook, idx) => (
                    <div key={idx} className="p-3 bg-black/40 border border-zinc-800/80 rounded-xl flex items-start gap-2.5">
                      <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                        0{idx + 1}
                      </span>
                      <p className="text-xs text-zinc-200 leading-relaxed">{hook}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Likely Objections & Rebuttals */}
              {data.likely_objections.length > 0 && (
                <div>
                  <span className="text-xs font-mono uppercase text-zinc-400 font-bold flex items-center gap-1.5 mb-2">
                    <ShieldQuestion className="w-4 h-4 text-amber-400" /> Anticipated Objections & Counters
                  </span>
                  <div className="space-y-2">
                    {data.likely_objections.map((item, idx) => (
                      <div key={idx} className="p-3 bg-black/40 border border-zinc-800/80 rounded-xl space-y-1.5">
                        <div className="text-xs font-semibold text-amber-300">
                          Objection: "{item.objection}"
                        </div>
                        <div className="text-xs text-zinc-300 bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-800/60">
                          <strong className="text-zinc-400 font-mono">Response: </strong>{item.counter}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Full Markdown Raw Document */}
              <div>
                <span className="text-xs font-mono uppercase text-zinc-400 font-bold block mb-2">
                  Full Dossier
                </span>
                <div className="bg-black/60 border border-zinc-800/80 rounded-xl p-4 text-xs font-mono text-zinc-300 whitespace-pre-wrap max-h-64 overflow-y-auto leading-relaxed">
                  {data.markdown_document}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
```

---

## 7. Operational Workflow

1. **Scheduling Occurs:** A prospect books a slot for 15:00 UTC via Cal.com. The webhook stores the booking in `demo_bookings`.
2. **Lookahead Trigger (14:00 UTC):** At 14:00 UTC, the Celery Beat task `check_and_generate_upcoming_briefings` evaluates bookings between 14:45 and 15:15 UTC. It identifies the 15:00 UTC booking.
3. **Web & Job Scraping:** `LeadEnricher` visits the prospect’s domain and `/careers` page, identifying that they are actively hiring for engineers with experience in `FastAPI`, `Celery`, `Docker`, and `PostgreSQL`.
4. **Synthesis Pass:** Claude Code cross-references this stack against Polsia's strengths, generating a 1-page briefing that highlights automated queue monitoring, sandbox isolation, and self-healing pull requests.
5. **Dashboard Delivery:** 1 hour before the call, a `PRE_DEMO_BRIEFING_READY` event fires over the WebSocket connection, allowing the operator to click **Open Briefing** on the dashboard and review key value hooks and anticipated objections before jumping on the call.
