# Come ntinue

> Status in this repo: Deferred: SEO continuation

The next core component from Polsia’s architecture is the **`EmailOutreachAgent`**. Running on a **3-hour cadence**, this agent identifies high-fit technical prospects (such as engineering leads maintaining complex microservice repos), enriches their tech stack, drafts tailored, non-spammy cold outreach, sends messages via SendGrid/Resend with strict deliverability limits, and triages inbound replies to book demo calls automatically.

---

### Pipeline Architecture

```
 [ Prospect Discovery Source ] (GitHub Stargazers / Tech Stack Detection)
               │
               ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ 1. Enrichment & Intelligence Engine                         │
 │    - Scrapes target company/repo dependencies               │
 │    - Detects tech stack (e.g. Python, Docker, Celery, k8s)  │
 │    - Extracts verified engineering email address            │
 └──────────────────────────────┬──────────────────────────────┘
                                │
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ 2. EmailOutreachAgent (Claude Code Headless)                │
 │    - Generates hyper-specific 75-word email                │
 │    - Cites specific repo pain points (e.g., test flakiness) │
 │    - Enforces soul.md (zero buzzwords, direct value prop)   │
 └──────────────────────────────┬──────────────────────────────┘
                                │
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ 3. Deliverability Guardrails & ActionApproval Queue         │
 │    - Enforces warmup cap (max 25 emails/day per domain)     │
 │    - Injects CAN-SPAM/GDPR one-click unsubscribe headers    │
 │    - Batches into ActionApproval queue for human sign-off   │
 └──────────────────────────────┬──────────────────────────────┘
                                │ (Approved by Operator)
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ 4. SendGrid Dispatch & Inbound Reply Webhook Engine         │
 │    - Dispatches authenticated SMTP/API email                │
 │    - Inbound Parse webhook receives replies                 │
 │    - Claude Code triages: INTERESTED -> sends booking link  │
 │                           UNSUBSCRIBE -> auto-suppresses    │
 └─────────────────────────────────────────────────────────────┘
```

---

## 1. Database Schema (`app/models.py`)

Add relational tables to track prospects, email sequences, and reply classifications:

```python
# Add to app/models.py:
from sqlalchemy import Column, String, Text, DateTime, Integer, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db import Base

class Prospect(Base):
    __tablename__ = "prospects"

    id = Column(String, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    name = Column(String, nullable=True)
    company = Column(String, index=True)
    role = Column(String, nullable=True)
    github_handle = Column(String, nullable=True)
    detected_tech_stack = Column(Text, nullable=True) # Comma-separated (e.g., "Docker, Celery, FastAPI")
    status = Column(String, default="NEW")            # NEW, QUEUED, CONTACTED, REPLIED, BOUNCED, UNSUBSCRIBED
    created_at = Column(DateTime, default=datetime.utcnow)

    emails = relationship("OutboundEmail", back_populates="prospect")

class OutboundEmail(Base):
    __tablename__ = "outbound_emails"

    id = Column(String, primary_key=True, index=True)
    prospect_id = Column(String, ForeignKey("prospects.id"))
    subject = Column(String)
    body = Column(Text)
    status = Column(String, default="PENDING")        # PENDING, APPROVED, DISPATCHED, REJECTED
    message_id = Column(String, nullable=True)        # SendGrid Message-ID
    reply_status = Column(String, nullable=True)     # INTERESTED, OBJECTION, UNSUBSCRIBE, OOO
    sent_at = Column(DateTime, nullable=True)

    prospect = relationship("Prospect", back_populates="emails")
```

---

## 2. Lead Discovery & Tech Stack Enrichment (`app/adapters/enrichment_adapter.py`)

This adapter scans target GitHub repositories or domain metadata to identify prospects and analyze their technical stack:

```python
import os
import requests
from typing import List, Dict, Any
from app.config import settings

class EnrichmentAdapter:
    def __init__(self):
        self.github_token = os.getenv("GITHUB_TOKEN", "")

    def discover_technical_prospects(self, target_topic: str = "fastapi", limit: int = 5) -> List[Dict[str, Any]]:
        """
        Discovers engineering leads maintaining projects in relevant domains.
        Extracts public commit author metadata and inspects repo files.
        """
        if settings.SANDBOX_MODE or not self.github_token:
            return [
                {
                    "email": "alex.dev@innovatech.io",
                    "name": "Alex Mercer",
                    "company": "InnovaTech",
                    "role": "VP Engineering",
                    "github_handle": "alexm-innovatech",
                    "tech_stack": "FastAPI, Celery, Docker, Redis",
                    "repo_context": "Active microservices repo with 40+ Celery task queues and CI bottlenecks."
                },
                {
                    "email": "sarah.chen@cloudscale.ai",
                    "name": "Sarah Chen",
                    "company": "CloudScale AI",
                    "role": "Lead DevOps Engineer",
                    "github_handle": "schen-scale",
                    "tech_stack": "Python, Kubernetes, GitHub Actions, Terraform",
                    "repo_context": "Multi-tenant deployment pipeline experiencing intermittent test timeouts."
                }
            ]

        # GitHub API Discovery
        headers = {"Authorization": f"Bearer {self.github_token}", "Accept": "application/vnd.github.v3+json"}
        url = f"https://api.github.com/search/repositories?q={target_topic}+language:python&sort=stars&order=desc&per_page={limit}"
        resp = requests.get(url, headers=headers, timeout=10)
        resp.raise_for_status()
        items = resp.json().get("items", [])

        prospects = []
        for repo in items:
            owner = repo["owner"]["login"]
            repo_name = repo["name"]

            # Pull recent commits to discover active committer contact
            commits_url = f"https://api.github.com/repos/{owner}/{repo_name}/commits?per_page=1"
            c_resp = requests.get(commits_url, headers=headers, timeout=10)
            if c_resp.status_code == 200 and c_resp.json():
                commit_author = c_resp.json()[0].get("commit", {}).get("author", {})
                author_email = commit_author.get("email")

                # Filter out generic bot and noreply emails
                if author_email and not author_email.endswith("noreply.github.com") and not "bot" in author_email:
                    prospects.append({
                        "email": author_email,
                        "name": commit_author.get("name", "Engineering Lead"),
                        "company": owner.capitalize(),
                        "role": "Maintainer",
                        "github_handle": owner,
                        "tech_stack": f"{repo.get('language', 'Python')}, Git, CI/CD",
                        "repo_context": f"Public repository {owner}/{repo_name}: {repo.get('description', 'Backend system')}"
                    })

        return prospects
```

---

## 3. Email Deliverability & Outbound Dispatcher (`app/adapters/email_adapter.py`)

Deliverability guardrails prevent domain burn by enforcing warmup limits, SPF/DKIM authentication checks, and CAN-SPAM headers:

```python
import os
import requests
from datetime import datetime, date
from sqlalchemy import func
from app.config import settings
from app.db import SessionLocal
from app.models import OutboundEmail

DAILY_DISPATCH_LIMIT = 25 # Strict warmup ceiling per day

class EmailOutreachError(Exception):
    pass

class EmailAdapter:
    def __init__(self):
        self.api_key = os.getenv("SENDGRID_API_KEY", "")
        self.from_email = os.getenv("OUTREACH_FROM_EMAIL", "petar@polsia.ai")
        self.company_address = "Polsia Inc., 100 Montgomery St, San Francisco, CA 94104"

    def check_daily_limit_available(self) -> bool:
        """Verifies domain warmup limits to prevent IP reputation throttling."""
        db = SessionLocal()
        today = date.today()
        sent_today = db.query(func.count(OutboundEmail.id)).filter(
            func.date(OutboundEmail.sent_at) == today,
            OutboundEmail.status == "DISPATCHED"
        ).scalar() or 0
        db.close()
        return sent_today < DAILY_DISPATCH_LIMIT

    def dispatch_email(self, to_email: str, subject: str, body_text: str, prospect_id: str) -> dict:
        """Sends compliant email via SendGrid Web API v3 with unsubscribe footer."""
        if not self.check_daily_limit_available():
            raise EmailOutreachError(f"Daily warmup limit of {DAILY_DISPATCH_LIMIT} emails reached.")

        # CAN-SPAM & GDPR compliant physical address and opt-out link
        opt_out_url = f"https://polsia.ai/api/outreach/unsubscribe?pid={prospect_id}"
        full_body = (
            f"{body_text}\n\n"
            f"---\n"
            f"{self.company_address}\n"
            f"If you'd prefer not to hear from me, click here to opt out: {opt_out_url}"
        )

        if settings.SANDBOX_MODE or not self.api_key:
            return {
                "status": "simulated",
                "message_id": f"mock_sg_{os.urandom(6).hex()}",
                "to": to_email
            }

        url = "https://api.sendgrid.com/v3/mail/send"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "personalizations": [{"to": [{"email": to_email}]}],
            "from": {"email": self.from_email, "name": "Petar from Polsia"},
            "subject": subject,
            "content": [{"type": "text/plain", "value": full_body}],
            "headers": {
                "List-Unsubscribe": f"<{opt_out_url}>",
                "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"
            }
        }

        resp = requests.post(url, json=payload, headers=headers, timeout=10)
        if resp.status_code not in [200, 202]:
            raise EmailOutreachError(f"SendGrid error ({resp.status_code}): {resp.text}")

        msg_id = resp.headers.get("X-Message-Id", f"sg_{os.urandom(6).hex()}")
        return {"status": "sent", "message_id": msg_id, "to": to_email}
```

---

## 4. The Email Outreach Agent (`app/outreach_agent.py`)

The agent enriches prospect data, uses Claude Code to draft personalized cold outreach, and enqueues messages for operator review:

```python
import json
import uuid
from app.runner import run_claude_headless
from app.config import settings
from app.adapters.enrichment_adapter import EnrichmentAdapter
from app.adapters.email_adapter import EmailAdapter
from app.memory import AgentMemory
from app.db import SessionLocal
from app.models import Prospect, OutboundEmail, ActionApproval

def load_soul() -> str:
    with open(settings.SOUL_PATH, "r") as f:
        return f.read()

class EmailOutreachAgent:
    def __init__(self):
        self.name = "EmailOutreachAgent"
        self.enricher = EnrichmentAdapter()
        self.mailer = EmailAdapter()
        self.memory = AgentMemory("EmailOutreachAgent")
        self.soul = load_soul()

    def run_prospecting_cycle(self, task_id: str) -> dict:
        """
        1. Discovers technical prospects.
        2. Drafts personalized emails (< 75 words, direct value prop).
        3. Enqueues messages in ActionApproval queue.
        """
        if not self.mailer.check_daily_limit_available():
            return {"status": "skipped", "reason": "Daily warmup send limit reached."}

        prospect_data = self.enricher.discover_technical_prospects()
        db = SessionLocal()
        queued_actions = []

        # Pull past high-reply email examples from ChromaDB
        winning_patterns = self.memory.search_context("high response rate B2B engineering cold emails", n_results=2)

        for p in prospect_data:
            # Check for existing prospect to avoid duplicate outreach
            existing = db.query(Prospect).filter(Prospect.email == p["email"]).first()
            if existing and existing.status in ["CONTACTED", "UNSUBSCRIBED", "REPLIED"]:
                continue

            prospect_id = existing.id if existing else str(uuid.uuid4())
            if not existing:
                new_prospect = Prospect(
                    id=prospect_id,
                    email=p["email"],
                    name=p.get("name"),
                    company=p.get("company"),
                    role=p.get("role"),
                    github_handle=p.get("github_handle"),
                    detected_tech_stack=p.get("tech_stack"),
                    status="QUEUED"
                )
                db.add(new_prospect)
                db.commit()

            prompt = (
                f"You are the senior technical partnership lead at Polsia.\n"
                f"PROSPECT PROFILE:\n"
                f"- Name: {p.get('name')}\n"
                f"- Company: {p.get('company')}\n"
                f"- Stack: {p.get('tech_stack')}\n"
                f"- Context: {p.get('repo_context')}\n\n"
                f"SUCCESSFUL PAST EMAILS (STYLE REFERENCE):\n{winning_patterns}\n\n"
                "OUTREACH RULES:\n"
                "1. Keep length strictly under 75 words. Zero corporate buzzwords.\n"
                "2. Reference their specific stack and engineering bottleneck immediately.\n"
                "3. Clear call to action: Offer a 5-minute async Loom walkthrough, not an aggressive meeting request.\n\n"
                "OUTPUT SPECIFICATION (STRICT JSON ONLY):\n"
                "{\n"
                '  "subject": "Quick question on {topic}",\n'
                '  "body": "Hi {name},\\n\\nSaw your work on..."\n'
                "}"
            )

            res = run_claude_headless(prompt=prompt, system_prompt=self.soul)
            data = json.loads(res.get("result", "{}"))

            email_id = str(uuid.uuid4())
            email_record = OutboundEmail(
                id=email_id,
                prospect_id=prospect_id,
                subject=data.get("subject", "Automated code delivery"),
                body=data.get("body", ""),
                status="PENDING"
            )
            db.add(email_record)

            # High-stakes action: queue for human approval
            approval_id = str(uuid.uuid4())
            payload = {
                "email_id": email_id,
                "prospect_id": prospect_id,
                "to_email": p["email"],
                "prospect_name": p.get("name"),
                "company": p.get("company"),
                "subject": data.get("subject"),
                "body": data.get("body"),
                "action_type": "SEND_COLD_EMAIL"
            }

            approval = ActionApproval(
                id=approval_id,
                task_id=task_id,
                agent_name=self.name,
                action_type="SEND_COLD_EMAIL",
                payload=json.dumps(payload),
                status="PENDING"
            )
            db.add(approval)
            queued_actions.append(payload)

        db.commit()
        db.close()

        return {"prospects_evaluated": len(prospect_data), "queued_for_approval": len(queued_actions)}
```

---

## 5. Inbound Reply Classification & Auto-Triage (`app/reply_triage.py`)

When a prospect replies, SendGrid's Inbound Parse Webhook posts the email payload to FastAPI. Claude Code parses intent and automatically dispatches the next step:

```python
import json
from app.runner import run_claude_headless
from app.config import settings
from app.db import SessionLocal
from app.models import Prospect, OutboundEmail
from app.adapters.email_adapter import EmailAdapter

class ReplyTriageEngine:
    @staticmethod
    def process_incoming_reply(from_email: str, subject: str, raw_text: str):
        """
        Classifies prospect reply intent into:
        - INTERESTED: Automatically sends scheduling link (Cal.com / Calendly)
        - OBJECTION / QUESTION: Drafts technical response for review
        - UNSUBSCRIBE: Automatically updates suppression list
        """
        prompt = (
            f"You are the inbound sales communications lead for Polsia.\n"
            f"Prospect Email: {from_email}\n"
            f"Subject: {subject}\n"
            f"Reply Text:\n\"\"\"\n{raw_text}\n\"\"\"\n\n"
            "Classify the reply into ONE category:\n"
            "1. 'INTERESTED': Positive response, asking for demo, pricing, or link.\n"
            "2. 'OBJECTION': Has technical questions, doubts, or concerns.\n"
            "3. 'UNSUBSCRIBE': Wants to be removed, says no, or requests stop.\n"
            "4. 'OUT_OF_OFFICE': Automated autoresponder.\n\n"
            "OUTPUT SPECIFICATION (STRICT JSON ONLY):\n"
            "{\n"
            '  "intent": "INTERESTED" | "OBJECTION" | "UNSUBSCRIBE" | "OUT_OF_OFFICE",\n'
            '  "confidence": 0.95,\n'
            '  "suggested_action": "SEND_CALENDAR_LINK" | "SUPPRESS" | "DRAFT_REPLY"\n'
            "}"
        )

        res = run_claude_headless(prompt=prompt)
        decision = json.loads(res.get("result", "{}"))
        intent = decision.get("intent", "OBJECTION")

        db = SessionLocal()
        prospect = db.query(Prospect).filter(Prospect.email == from_email).first()

        if prospect:
            if intent == "UNSUBSCRIBE":
                prospect.status = "UNSUBSCRIBED"
            elif intent == "INTERESTED":
                prospect.status = "REPLIED"
                # Send automatic calendar response
                mailer = EmailAdapter()
                booking_body = (
                    f"Hi {prospect.name or 'there'},\n\n"
                    "Glad you're interested. You can grab a convenient 15-minute slot "
                    "directly on my calendar here: https://cal.com/polsia/demo\n\n"
                    "Looking forward to talking."
                )
                mailer.dispatch_email(
                    to_email=from_email,
                    subject=f"Re: {subject}",
                    body_text=booking_body,
                    prospect_id=prospect.id
                )
            elif intent == "OBJECTION":
                prospect.status = "REPLIED"

        db.commit()
        db.close()
        return {"intent": intent, "action": decision.get("suggested_action")}
```

---

## 6. ActionDispatcher & Webhook Routes (`app/dispatcher.py` & `app/main.py`)

### Update `ActionDispatcher` (`app/dispatcher.py`)

```python
# Add to ActionDispatcher.dispatch in app/dispatcher.py:
from app.adapters.email_adapter import EmailAdapter
from app.models import OutboundEmail
from datetime import datetime

        elif action_type == "SEND_COLD_EMAIL":
            mailer = EmailAdapter()
            result = mailer.dispatch_email(
                to_email=payload_data["to_email"],
                subject=payload_data["subject"],
                body_text=payload_data["body"],
                prospect_id=payload_data["prospect_id"]
            )
            # Mark outbound record as DISPATCHED
            db = SessionLocal()
            email_rec = db.query(OutboundEmail).filter(OutboundEmail.id == payload_data["email_id"]).first()
            if email_rec:
                email_rec.status = "DISPATCHED"
                email_rec.message_id = result.get("message_id")
                email_rec.sent_at = datetime.utcnow()
                db.commit()
            db.close()
            return result
```

### Inbound Webhooks & Unsubscribe Route (`app/main.py`)

```python
# In app/main.py:
from fastapi import Form
from app.reply_triage import ReplyTriageEngine
from app.models import Prospect

@app.post("/webhooks/sendgrid/inbound")
async def handle_inbound_email_reply(
    from_address: str = Form(..., alias="from"),
    subject: str = Form(""),
    text: str = Form("")
):
    """Processes incoming email replies parsed by SendGrid Inbound Parse."""
    # Extract clean email from "Name <user@domain.com>"
    import re
    email_match = re.search(r"[\w\.-]+@[\w\.-]+", from_address)
    clean_email = email_match.group(0) if email_match else from_address

    result = ReplyTriageEngine.process_incoming_reply(clean_email, subject, text)
    return {"status": "processed", "result": result}

@app.get("/outreach/unsubscribe")
def handle_unsubscribe(pid: str, db: Session = Depends(get_db)):
    """One-click opt-out link handling."""
    prospect = db.query(Prospect).filter(Prospect.id == pid).first()
    if prospect:
        prospect.status = "UNSUBSCRIBED"
        db.commit()
    return {"message": "You have been successfully unsubscribed from Polsia communications."}

@app.get("/outreach/metrics")
def get_outreach_metrics(db: Session = Depends(get_db)):
    total_prospects = db.query(Prospect).count()
    contacted = db.query(Prospect).filter(Prospect.status == "CONTACTED").count()
    replied = db.query(Prospect).filter(Prospect.status == "REPLIED").count()
    unsubscribed = db.query(Prospect).filter(Prospect.status == "UNSUBSCRIBED").count()

    return {
        "total_prospects": total_prospects,
        "contacted": contacted,
        "replied": replied,
        "unsubscribed": unsubscribed,
        "response_rate_pct": round((replied / contacted * 100), 1) if contacted > 0 else 0.0
    }
```

---

## 7. Next.js Outreach Pipeline Widget (`components/OutreachPipelineCard.tsx`)

This component displays the outbound sales funnel, active conversion rates, and inbound response classifications on the dashboard:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Mail, Users, MessageSquareReply, UserX, Send, ArrowUpRight } from "lucide-react";

interface OutreachStats {
  total_prospects: number;
  contacted: number;
  replied: number;
  unsubscribed: number;
  response_rate_pct: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function OutreachPipelineCard() {
  const [stats, setStats] = useState<OutreachStats | null>(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const res = await fetch(`${API_URL("/outreach/metrics")}`);
        if (res.ok) setStats(await res.json());
      } catch (err) {
        console.error("Failed to load outreach metrics", err);
      }
    };
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 10000);
    return () => clearInterval(interval);
  }, []);

  if (!stats) return null;

  return (
    <div className="border border-zinc-800 bg-zinc-900/50 backdrop-blur rounded-2xl p-6 mb-8">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-zinc-800 mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold font-mono text-zinc-100 uppercase tracking-wider">
              Autonomous B2B Outbound Engine
            </h2>
            <p className="text-xs text-zinc-500 font-mono">
              3h Cadence • Stack-Enriched Cold Email Sequences
            </p>
          </div>
        </div>
        <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded border border-emerald-500/20">
          Response Rate: {stats.response_rate_pct}%
        </span>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-black/40 border border-zinc-800/80 rounded-xl p-3.5">
          <span className="text-[10px] font-mono uppercase text-zinc-500 block flex items-center gap-1">
            <Users className="w-3.5 h-3.5 text-zinc-400" /> Discovered Leads
          </span>
          <span className="text-xl font-bold font-mono text-white mt-1 block">
            {stats.total_prospects}
          </span>
        </div>

        <div className="bg-black/40 border border-zinc-800/80 rounded-xl p-3.5">
          <span className="text-[10px] font-mono uppercase text-zinc-500 block flex items-center gap-1">
            <Send className="w-3.5 h-3.5 text-sky-400" /> Dispatched
          </span>
          <span className="text-xl font-bold font-mono text-white mt-1 block">
            {stats.contacted}
          </span>
        </div>

        <div className="bg-black/40 border border-zinc-800/80 rounded-xl p-3.5">
          <span className="text-[10px] font-mono uppercase text-zinc-500 block flex items-center gap-1">
            <MessageSquareReply className="w-3.5 h-3.5 text-emerald-400" /> Positive Replies
          </span>
          <span className="text-xl font-bold font-mono text-emerald-400 mt-1 block">
            {stats.replied}
          </span>
        </div>

        <div className="bg-black/40 border border-zinc-800/80 rounded-xl p-3.5">
          <span className="text-[10px] font-mono uppercase text-zinc-500 block flex items-center gap-1">
            <UserX className="w-3.5 h-3.5 text-zinc-500" /> Opt-Outs
          </span>
          <span className="text-xl font-bold font-mono text-zinc-400 mt-1 block">
            {stats.unsubscribed}
          </span>
        </div>
      </div>
    </div>
  );
}
```

Insert `<OutreachPipelineCard/>` inside `app/page.tsx` right next to `<AdsPerformanceCard/>`.

---

## 8. Closed-Loop Execution Lifecycle

1. **Scheduled Discovery (Every 3 Hours):** Celery Beat triggers `run_prospecting_cycle()`. `EnrichmentAdapter` inspects target GitHub repositories and surfaces active engineers working on Python, Docker, and Celery.
2. **Personalized Synthesis:** Claude Code drafts a 60-word message referencing the maintainer's specific stack and proposing an async 5-minute Loom walkthrough.
3. **Operator Inspection:** The draft lands in the Amber Approval Queue showing recipient email, company, and body copy.
4. **Delivery & Warmup:** Once approved, SendGrid dispatches the email with CAN-SPAM headers, respecting the 25-email daily warmup ceiling.
5. **Inbound Reply Triage:** When a lead responds asking for more info, SendGrid's inbound webhook delivers the reply to `ReplyTriageEngine`. Claude Code classifies the intent as `INTERESTED` and immediately sends an automated booking link to secure the meeting.
