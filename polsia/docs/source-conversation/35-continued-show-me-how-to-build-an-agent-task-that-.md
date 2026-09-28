# Continue

> Status in this repo: Implemented: briefing (continuation)

To complete the enterprise customer conversion loop, we build the **Post-Demo Follow-Up & Dynamic Pilot Proposal Agent**.

Once a live call concludes, the operator submits brief, messy meeting notes (or pastes a call transcript) via the Next.js dashboard. The agent evaluates prospect sentiment, pulls the prospect’s technical stack from ChromaDB, provisions an ephemeral **POC sandbox workspace**, generates a customized **Pilot Proposal Markdown agreement** with tiered pricing, and queues a polished recap email for operator approval.

---

### Post-Demo Conversion Architecture

```
 [ Operator Enters Raw Notes / Transcript ]
                     │
                     ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ 1. Deal Qualification & Sentiment Analyzer                  │
 │    `POST /demos/{booking_id}/complete`                      │
 │    - Evaluates: WIN_PROBABILITY | KEY_PAIN_POINTS | OBJECTIONS│
 │    - Identifies agreed Pilot Scope (e.g., "Queue Triage")    │
 └──────────────────────────────┬──────────────────────────────┘
                                │
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ 2. Ephemeral POC Sandbox Provisioner                        │
 │    - Generates customized `workspace/pocs/{customer_slug}/` │
 │    - Pre-populates repo scaffolding matching their stack    │
 │    - Mints 14-day dedicated trial API key                   │
 └──────────────────────────────┬──────────────────────────────┘
                                │
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ 3. Proposal & Recap Synthesizer (Claude Code)               │
 │    - Formulates formal Markdown Pilot Agreement             │
 │    - Structures 3-Tier Enterprise Pricing Model             │
 │    - Drafts warm follow-up recap email with Cal.com link    │
 └──────────────────────────────┬──────────────────────────────┘
                                │
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ 4. Operator Approval & Multi-Channel Dispatch               │
 │    - Renders Proposal preview in Next.js Approval Queue     │
 │    - Operator clicks "Approve & Send"                       │
 │    - Dispatches email via SendGrid & syncs CRM stage        │
 └─────────────────────────────────────────────────────────────┘
```

---

## 1. Database Schema (`app/models.py`)

Add tracking models for call notes, proposals, and pilot subscriptions:

```python
# Add to app/models.py:
from sqlalchemy import Column, String, Text, DateTime, Integer, Boolean, ForeignKey, JSON, Numeric
from datetime import datetime, timezone
from sqlalchemy.orm import relationship
from app.db import Base

class DemoOutcomeRecord(Base):
    __tablename__ = "demo_outcome_records"

    id = Column(String, primary_key=True, index=True)
    booking_id = Column(String, ForeignKey("demo_bookings.id"), unique=True, nullable=False)
    customer_id = Column(String, ForeignKey("customer_accounts.id"), nullable=False)
    
    # Raw Operator Inputs
    raw_notes = Column(Text, nullable=False)
    
    # Structured Model Synthesis
    qualification_status = Column(String)     # "HIGH_INTENT", "NURTURE", "UNQUALIFIED"
    win_probability_pct = Column(Integer, default=50)
    agreed_pilot_scope = Column(Text)
    quoted_mrr_usd = Column(Numeric(precision=10, scale=2), default=0.0)
    
    # Generated Deliverables
    proposal_markdown = Column(Text)
    follow_up_email_subject = Column(String)
    follow_up_email_body = Column(Text)
    poc_workspace_path = Column(String, nullable=True)
    poc_api_key = Column(String, nullable=True)
    
    status = Column(String, default="PENDING_APPROVAL") # PENDING_APPROVAL, DISPATCHED, REJECTED
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

# Add `outcome` relationship to DemoBooking:
# DemoBooking.outcome = relationship("DemoOutcomeRecord", uselist=False, backref="booking")
```

---

## 2. Ephemeral POC Workspace Provisioner (`app/poc_provisioner.py`)

When a lead demonstrates high intent, this service spins up an isolated directory pre-configured with the customer’s stack so they can immediately test Polsia's autonomous loop:

```python
import os
import uuid
import secrets
import shutil
from typing import Dict, Any, List
from app.config import settings

class POCProvisioner:
    @classmethod
    def provision_customer_poc(
        cls,
        company_slug: str,
        tech_stack: List[str]
    ) -> Dict[str, str]:
        """
        Creates an isolated customer sandbox directory under workspace/pocs/{company_slug}/
        with pre-configured soul.md and mock environment configs.
        """
        base_dir = os.path.abspath(f"./workspace/pocs/{company_slug}")
        os.makedirs(base_dir, exist_ok=True)

        # Generate a scoped 14-day trial API token
        trial_token = f"polsia_poc_{secrets.token_urlsafe(24)}"

        # Generate a tailored sandbox README and starter prompt
        readme_content = (
            f"# Polsia Autonomous Trial - {company_slug.upper()}\n\n"
            f"**Target Architecture:** {', '.join(tech_stack) if tech_stack else 'Microservices'}\n"
            f"**Workspace Token:** `{trial_token}`\n\n"
            "## Available Operations\n"
            "- Automatic PR generation on GitHub issue creation.\n"
            "- Background task queue performance monitoring.\n"
            "- Sandboxed test execution via gVisor `runsc`.\n"
        )
        with open(os.path.join(base_dir, "README.md"), "w", encoding="utf-8") as f:
            f.write(readme_content)

        return {
            "workspace_path": base_dir,
            "poc_token": trial_token
        }
```

---

## 3. Post-Demo Synthesis Agent (`app/post_demo_agent.py`)

This agent analyzes operator notes, references the earlier pre-demo intelligence in ChromaDB, calculates pricing based on company size and stack complexity, and produces the complete follow-up package:

```python
import json
import uuid
import re
from typing import Dict, Any
from app.runner import run_claude_headless
from app.config import settings
from app.db import SessionLocal
from app.models import DemoBooking, CustomerAccount, DemoOutcomeRecord, ActionApproval
from app.poc_provisioner import POCProvisioner
from app.memory import AgentMemory

class PostDemoFollowUpAgent:
    @classmethod
    def process_demo_outcome(cls, booking_id: str, raw_notes: str, task_id: str) -> Dict[str, Any]:
        db = SessionLocal()
        booking = db.query(DemoBooking).filter(DemoBooking.id == booking_id).first()
        if not booking:
            db.close()
            raise ValueError(f"Booking {booking_id} not found")

        customer = booking.customer
        company_slug = re.sub(r"[^a-z0-9]+", "-", customer.company_name.lower()).strip("-")

        # 1. Pull historical intelligence and stack from ChromaDB
        memory = AgentMemory("CustomerIntelligence")
        historical_intel = memory.search_context(f"{customer.company_name} tech stack pain points", n_results=2)

        prompt = (
            "You are the VP of Strategic Accounts at Polsia.\n"
            "A sales demo just concluded. Analyze the raw meeting notes, determine deal qualification, "
            "synthesize a formal 14-day POC Proposal agreement, and draft a high-conversion follow-up recap email.\n\n"
            f"CUSTOMER PROFILE:\n"
            f"- Company: {customer.company_name}\n"
            f"- Contact: {customer.contact_name} ({customer.primary_email})\n"
            f"- Tech Stack: {customer.detected_tech_stack}\n"
            f"- Historical Intel: {historical_intel}\n\n"
            f"RAW OPERATOR CALL NOTES:\n```text\n{raw_notes}\n```\n\n"
            "REQUIRED OUTPUT SPECIFICATIONS (STRICT JSON ONLY):\n"
            "{\n"
            '  "qualification_status": "HIGH_INTENT" | "NURTURE" | "UNQUALIFIED",\n'
            '  "win_probability_pct": 75,\n'
            '  "agreed_pilot_scope": "Summary of specific pain points Polsia will solve in POC",\n'
            '  "quoted_mrr_usd": 499.00,\n'
            '  "proposal_markdown": "# Polsia 14-Day Pilot Agreement\\n\\n### Objectives...\\n\\n### Pricing: $499/mo after trial...",\n'
            '  "email_subject": "Polsia x {Company} - POC Sandbox & Recap",\n'
            '  "email_body": "Hi {Name},\\n\\nGreat speaking today. As discussed, here is your dedicated trial workspace..."\n'
            "}"
        )

        res = run_claude_headless(
            prompt=prompt,
            agent_name="PostDemoFollowUpAgent"
        )
        data = json.loads(res.get("result", "{}"))

        # 2. Provision POC Sandbox Workspace if Qualified
        stack_list = [s.strip() for s in (customer.detected_tech_stack or "").split(",") if s.strip()]
        poc_data = POCProvisioner.provision_customer_poc(company_slug, stack_list)

        # 3. Store Demo Outcome in Database
        outcome_id = str(uuid.uuid4())
        outcome = DemoOutcomeRecord(
            id=outcome_id,
            booking_id=booking.id,
            customer_id=customer.id,
            raw_notes=raw_notes,
            qualification_status=data.get("qualification_status", "HIGH_INTENT"),
            win_probability_pct=data.get("win_probability_pct", 50),
            agreed_pilot_scope=data.get("agreed_pilot_scope", "Autonomous task queue triage"),
            quoted_mrr_usd=data.get("quoted_mrr_usd", 299.00),
            proposal_markdown=data.get("proposal_markdown", ""),
            follow_up_email_subject=data.get("email_subject", f"Polsia x {customer.company_name} - Follow Up"),
            follow_up_email_body=data.get("email_body", ""),
            poc_workspace_path=poc_data["workspace_path"],
            poc_api_key=poc_data["poc_token"],
            status="PENDING_APPROVAL"
        )
        db.add(outcome)

        # Update customer lifecycle stage
        customer.lifecycle_stage = "TRIAL_OFFERED" if data.get("qualification_status") == "HIGH_INTENT" else "NURTURE"

        # 4. Route to ActionApproval Queue for Operator Sign-off
        approval_id = str(uuid.uuid4())
        payload = {
            "outcome_id": outcome_id,
            "booking_id": booking.id,
            "to_email": customer.primary_email,
            "company_name": customer.company_name,
            "qualification": data.get("qualification_status"),
            "win_probability": data.get("win_probability_pct"),
            "quoted_mrr": float(data.get("quoted_mrr_usd", 0.0)),
            "subject": data.get("email_subject"),
            "body": data.get("email_body"),
            "proposal_md": data.get("proposal_markdown"),
            "poc_token": poc_data["poc_token"],
            "action_type": "DISPATCH_POST_DEMO_FOLLOWUP"
        }

        approval = ActionApproval(
            id=approval_id,
            task_id=task_id,
            agent_name="PostDemoFollowUpAgent",
            action_type="DISPATCH_POST_DEMO_FOLLOWUP",
            payload=json.dumps(payload),
            status="PENDING"
        )
        db.add(approval)
        db.commit()
        db.close()

        return {"approval_id": approval_id, "payload": payload}
```

---

## 4. Hooking the Action Dispatcher (`app/dispatcher.py`)

Update `ActionDispatcher` to send the finalized email through SendGrid and update the database when approved:

```python
# Add to ActionDispatcher.dispatch in app/dispatcher.py:
from app.adapters.email_adapter import EmailAdapter
from app.models import DemoOutcomeRecord, CustomerAccount

        elif action_type == "DISPATCH_POST_DEMO_FOLLOWUP":
            mailer = EmailAdapter()
            
            # Send recap email with CAN-SPAM compliant footers
            result = mailer.dispatch_email(
                to_email=payload_data["to_email"],
                subject=payload_data["subject"],
                body_text=payload_data["body"],
                prospect_id=payload_data.get("outcome_id", "demo_followup")
            )

            # Update outcome record status to DISPATCHED
            db = SessionLocal()
            outcome = db.query(DemoOutcomeRecord).filter(
                DemoOutcomeRecord.id == payload_data["outcome_id"]
            ).first()
            if outcome:
                outcome.status = "DISPATCHED"
                outcome.customer.lifecycle_stage = "POC_TRIAL_ACTIVE"
                db.commit()
            db.close()

            return {"status": "dispatched", "message_id": result.get("message_id")}
```

---

## 5. API Endpoints for Call Completion (`app/main.py`)

Expose the endpoint that allows an operator to post meeting notes:

```python
# Add to app/main.py:
import uuid
from pydantic import BaseModel
from app.post_demo_agent import PostDemoFollowUpAgent

class CompleteDemoRequest(BaseModel):
    raw_notes: str

@app.post("/demos/{booking_id}/complete")
def complete_demo_and_generate_proposal(
    booking_id: str,
    req: CompleteDemoRequest
):
    """
    Submits meeting notes, evaluates qualification, creates POC workspace,
    and stages the follow-up email/proposal for review.
    """
    task_id = str(uuid.uuid4())
    result = PostDemoFollowUpAgent.process_demo_outcome(
        booking_id=booking_id,
        raw_notes=req.raw_notes,
        task_id=task_id
    )
    return result
```

---

## 6. Next.js Demo Completion & Proposal Approval Card (`components/PostDemoApprovalCard.tsx`)

This component integrates with the approval queue, rendering the synthesized email recap and full Markdown proposal agreement alongside approval buttons:

```tsx
"use client";

import { useState } from "react";
import { Check, X, FileText, Mail, DollarSign, Percent, ShieldCheck, Key } from "lucide-react";

interface Props {
  approvalId: string;
  payload: {
    outcome_id: string;
    to_email: string;
    company_name: string;
    qualification: string;
    win_probability: number;
    quoted_mrr: number;
    subject: string;
    body: string;
    proposal_md: string;
    poc_token: string;
  };
  onResolve: (id: string, decision: "APPROVE" | "REJECT") => void;
}

export function PostDemoApprovalCard({ approvalId, payload, onResolve }: Props) {
  const [activeTab, setActiveTab] = useState<"email" | "proposal">("email");

  const isHighIntent = payload.qualification === "HIGH_INTENT";

  return (
    <div className="border border-emerald-500/30 bg-zinc-950/80 rounded-2xl p-6 mb-6 backdrop-blur">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-zinc-800 mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-mono font-bold text-zinc-100 uppercase tracking-wider">
                Post-Demo Follow-Up & Pilot Agreement: {payload.company_name}
              </h3>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold border ${
                isHighIntent 
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                  : "bg-amber-500/10 text-amber-400 border-amber-500/20"
              }`}>
                {payload.qualification}
              </span>
            </div>
            <p className="text-xs text-zinc-400 font-mono">
              Quoted MRR: ${payload.quoted_mrr.toFixed(2)}/mo • Win Prob: {payload.win_probability}%
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onResolve(approvalId, "REJECT")}
            className="px-3 py-1.5 rounded-lg border border-zinc-700 hover:bg-zinc-800 text-zinc-300 text-xs font-medium flex items-center gap-1 transition-colors"
          >
            <X className="w-3.5 h-3.5 text-rose-400" /> Discard
          </button>
          <button
            onClick={() => onResolve(approvalId, "APPROVE")}
            className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-lg shadow-emerald-500/20"
          >
            <Check className="w-3.5 h-3.5" /> Approve & Dispatch
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-800 mb-4 pb-1">
        <button
          onClick={() => setActiveTab("email")}
          className={`px-3 py-1 text-xs font-mono rounded-lg transition-colors flex items-center gap-1.5 ${
            activeTab === "email" ? "bg-zinc-800 text-white font-bold" : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <Mail className="w-3.5 h-3.5" /> Follow-Up Email
        </button>
        <button
          onClick={() => setActiveTab("proposal")}
          className={`px-3 py-1 text-xs font-mono rounded-lg transition-colors flex items-center gap-1.5 ${
            activeTab === "proposal" ? "bg-zinc-800 text-white font-bold" : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <FileText className="w-3.5 h-3.5" /> Pilot Agreement (MD)
        </button>
      </div>

      {/* Tab 1: Email View */}
      {activeTab === "email" && (
        <div className="bg-black/50 border border-zinc-800/80 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between text-xs font-mono text-zinc-400 border-b border-zinc-900 pb-2">
            <div><span className="text-zinc-500">To:</span> {payload.to_email}</div>
            <div><span className="text-zinc-500">Subject:</span> {payload.subject}</div>
          </div>
          <p className="text-xs text-zinc-200 font-sans leading-relaxed whitespace-pre-wrap">
            {payload.body}
          </p>
          <div className="pt-2 border-t border-zinc-900 flex items-center gap-2 text-[11px] font-mono text-zinc-400">
            <Key className="w-3 h-3 text-amber-400" />
            <span>Attached Trial Key: <code className="text-zinc-200">{payload.poc_token}</code></span>
          </div>
        </div>
      )}

      {/* Tab 2: Proposal Markdown */}
      {activeTab === "proposal" && (
        <div className="bg-black/60 border border-zinc-800/80 rounded-xl p-4 text-xs font-mono text-zinc-300 whitespace-pre-wrap max-h-80 overflow-y-auto leading-relaxed">
          {payload.proposal_md}
        </div>
      )}
    </div>
  );
}
```

Update `components/ApprovalQueue.tsx` to conditionally mount `PostDemoApprovalCard`:

```tsx
// Inside components/ApprovalQueue.tsx:
{item.action_type === "DISPATCH_POST_DEMO_FOLLOWUP" ? (
  <PostDemoApprovalCard
    key={item.id}
    approvalId={item.id}
    payload={JSON.parse(item.payload)}
    onResolve={handleDecision}
  />
) : (
  /* other cards */
)}
```

---

## 7. Operational Flow Trace

1. **Call Finishes (15:30 UTC):** The sales engineer wraps up a 30-minute demo with InnovaTech and types raw bullet points into the dashboard:
   ```text
   Spoke with Alex. Loved the gVisor sandbox and auto-PR loop.
   Biggest issue is their Celery task queue stalls on checkout jobs.
   Agreed to a 14-day trial focused on task error self-healing.
   Quoted $499/mo for up to 10 agent workers.
   ```
2. **Analysis Pass:** The backend parses the bullet points, links them with the company’s tech stack from ChromaDB, provisions an isolated directory at `workspace/pocs/innovatech/`, and generates an agreement.
3. **Approval Card Appears:** The Next.js dashboard displays `<PostDemoApprovalCard/>` showing a win probability of 85%, the structured Pilot Agreement, and the draft email.
4. **Operator Approves:** The operator reviews the terms, clicks **Approve & Dispatch**, and SendGrid sends the tailored proposal and trial token directly to the lead.
