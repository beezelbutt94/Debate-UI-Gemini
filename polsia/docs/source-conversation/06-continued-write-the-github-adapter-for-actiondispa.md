# Continue

> Status in this repo: Implemented: knowledge base, support triage, Stripe ledger

To make the autonomous company truly operational, it must be reactive as well as proactive. We will implement the two missing feedback loops that close the business lifecycle:

1. **Inbound Customer Support & RAG Knowledge Engine:** Ingests customer support tickets, retrieves relevant product documentation from ChromaDB, resolves customer issues, and—if a bug is detected—autonomously dispatches a fix request to the `CodeGenerationAgent`.
2. **Stripe Billing & Real-Time Financial Ledger:** Consumes Stripe webhooks, tracks net MRR, churn, and disputes, and updates telemetry so the `FinanceAgent` and `MasterOrchestrator` make budget decisions based on live revenue.
3. **The Self-Healing Loop:** Directly links customer support reports to automated GitHub pull requests.

```text
polsia-core/
├── app/
│   ├── knowledge_base.py        # Product docs ingestion & RAG vector search
│   ├── support.py               # Support agent & automated triage
│   ├── finance.py               # Stripe webhooks & financial ledger
│   ├── models.py                # Transaction & SupportTicket models
│   └── main.py                  # Webhook routes for Stripe & Inbound tickets
frontend/
└── components/
    └── FinancialMetricsPulse.tsx # Real-time MRR, Churn & Support card
```

---

## 1. Product Knowledge Base & Semantic Search (`app/knowledge_base.py`)

The support agent uses ChromaDB to index help markdown files, API specs, and FAQ documentation:

```python
import os
import glob
import chromadb
from typing import List, Dict

CHROMA_PATH = os.path.abspath("./chroma_data")
client = chromadb.PersistentClient(path=CHROMA_PATH)

docs_collection = client.get_or_create_collection(
    name="product_documentation",
    metadata={"hnsw:space": "cosine"}
)

class KnowledgeBase:
    @staticmethod
    def index_markdown_directory(directory_path: str):
        """Scans a directory of Markdown guides/docs and indexes them into ChromaDB."""
        if not os.path.exists(directory_path):
            os.makedirs(directory_path, exist_ok=True)
            return

        files = glob.glob(f"{directory_path}/**/*.md", recursive=True)
        documents = []
        metadatas = []
        ids = []

        for file_path in files:
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()
                filename = os.path.basename(file_path)
                
                # Split documents into 1000-character chunks with overlap
                chunk_size = 1000
                overlap = 150
                for idx in range(0, len(content), chunk_size - overlap):
                    chunk = content[idx:idx + chunk_size]
                    doc_id = f"{filename}_chunk_{idx}"
                    documents.append(chunk)
                    metadatas.append({"source": filename, "chunk_index": idx})
                    ids.append(doc_id)

        if documents:
            docs_collection.upsert(documents=documents, metadatas=metadatas, ids=ids)

    @staticmethod
    def query(question: str, top_k: int = 3) -> str:
        """Finds relevant product documentation for a given customer query."""
        if docs_collection.count() == 0:
            return "No documentation indexed."

        results = docs_collection.query(query_texts=[question], n_results=min(top_k, docs_collection.count()))
        chunks = results.get("documents", [[]])[0]
        return "\n---\n".join(chunks) if chunks else "No relevant documentation found."
```

---

## 2. Customer Support & Self-Healing Loop (`app/support.py`)

The `CustomerSupportAgent` diagnoses customer problems. If an issue is an identified software defect, the agent automatically synthesizes a bug ticket and enqueues the `CodeGenerationAgent` to open a pull request without waiting for operator intervention.

```python
import json
from typing import Dict, Any
from app.runner import run_claude_headless
from app.knowledge_base import KnowledgeBase
from app.config import settings

def load_soul() -> str:
    with open(settings.SOUL_PATH, "r") as f:
        return f.read()

class CustomerSupportAgent:
    def __init__(self):
        self.name = "CustomerSupportAgent"
        self.soul = load_soul()

    def process_ticket(self, customer_email: str, subject: str, body: str) -> Dict[str, Any]:
        """
        1. Queries KnowledgeBase for relevant documentation.
        2. Generates resolution draft.
        3. Triages whether issue requires an engineering bug fix.
        """
        relevant_docs = KnowledgeBase.query(f"{subject} {body}")

        prompt = (
            f"You are the {self.name}.\n"
            f"Customer: {customer_email}\n"
            f"Subject: {subject}\n"
            f"Message:\n{body}\n\n"
            f"RELEVANT DOCUMENTATION:\n{relevant_docs}\n\n"
            "INSTRUCTIONS:\n"
            "1. Formulate a polite, technical, and concise reply.\n"
            "2. Evaluate if this ticket describes a reproducible system bug or code defect.\n"
            "3. If it is a software bug, specify is_bug=true, define target_repo, and write a concrete bug spec.\n\n"
            "OUTPUT FORMAT (STRICT JSON ONLY):\n"
            "{\n"
            '  "reply_draft": "Email text to the customer...",\n'
            '  "is_bug": true | false,\n'
            '  "requires_human_escalation": true | false,\n'
            '  "bug_details": {\n'
            '    "repo": "owner/repo",\n'
            '    "title": "Bug title",\n'
            '    "description": "Reproduction details"\n'
            '  }\n'
            "}"
        )

        result = run_claude_headless(prompt=prompt, system_prompt=self.soul)

        try:
            parsed = json.loads(result.get("result", "{}"))
        except Exception:
            parsed = {
                "reply_draft": "We received your message and are investigating the issue.",
                "is_bug": False,
                "requires_human_escalation": True,
                "bug_details": None
            }

        # THE SELF-HEALING HOOK:
        # If a verified bug is detected, automatically enqueue CodeGenerationAgent
        if parsed.get("is_bug") and parsed.get("bug_details"):
            from app.tasks import execute_agent_task
            bug_info = parsed["bug_details"]
            instruction = (
                f"Automated bug report from customer {customer_email}: {bug_info.get('title')}\n"
                f"Details: {bug_info.get('description')}\n"
                f"Target Repository: {bug_info.get('repo')}"
            )
            # Enqueue the code agent to create an automated PR
            execute_agent_task.delay("CodeGenerationAgent", instruction)

        return parsed
```

---

## 3. Relational Schemas for Support & Billing (`app/models.py`)

Add tracking tables for customer tickets and Stripe ledger records:

```python
# Add to app/models.py:
from sqlalchemy import Column, String, Text, DateTime, Float, Boolean, Integer
from datetime import datetime
from app.db import Base

class SupportTicket(Base):
    __tablename__ = "support_tickets"

    id = Column(String, primary_key=True, index=True)
    customer_email = Column(String, index=True)
    subject = Column(String)
    body = Column(Text)
    reply_draft = Column(Text)
    status = Column(String, default="NEW")  # NEW, RESOLVED, ESCALATED
    is_bug = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class FinancialTransaction(Base):
    __tablename__ = "financial_transactions"

    id = Column(String, primary_key=True)  # Stripe event/charge ID
    customer_id = Column(String, index=True)
    amount_cents = Column(Integer)
    currency = Column(String, default="usd")
    event_type = Column(String)  # invoice.payment_succeeded, customer.subscription.deleted, etc.
    description = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
```

---

## 4. Stripe Webhook Ingestion & Financial Telemetry (`app/finance.py`)

This module ingests real-time events from Stripe, calculates active MRR, monitors churn, and alerts the system when anomalies occur.

```python
from datetime import datetime, timedelta
from sqlalchemy import func
from app.db import SessionLocal
from app.models import FinancialTransaction

class FinancialLedger:
    @staticmethod
    def record_event(event_id: str, customer_id: str, amount_cents: int, event_type: str, description: str):
        """Persists Stripe webhook charges and refunds."""
        db = SessionLocal()
        # Prevent duplicate event processing (idempotency)
        existing = db.query(FinancialTransaction).filter(FinancialTransaction.id == event_id).first()
        if existing:
            db.close()
            return

        tx = FinancialTransaction(
            id=event_id,
            customer_id=customer_id,
            amount_cents=amount_cents,
            event_type=event_type,
            description=description,
            created_at=datetime.utcnow()
        )
        db.add(tx)
        db.commit()
        db.close()

    @staticmethod
    def get_financial_health() -> dict:
        """Calculates current monthly recurring revenue (MRR) and trailing 30-day cashflow."""
        db = SessionLocal()
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)

        # Total revenue in last 30 days
        revenue_cents = db.query(func.sum(FinancialTransaction.amount_cents))\
            .filter(FinancialTransaction.event_type == "invoice.payment_succeeded")\
            .filter(FinancialTransaction.created_at >= thirty_days_ago)\
            .scalar() or 0

        # Cancellations/churn count
        churned_subs = db.query(FinancialTransaction)\
            .filter(FinancialTransaction.event_type == "customer.subscription.deleted")\
            .filter(FinancialTransaction.created_at >= thirty_days_ago)\
            .count()

        # Dispute/chargeback count
        disputes = db.query(FinancialTransaction)\
            .filter(FinancialTransaction.event_type == "charge.dispute.created")\
            .filter(FinancialTransaction.created_at >= thirty_days_ago)\
            .count()

        db.close()

        return {
            "trailing_30d_revenue_usd": round(revenue_cents / 100.0, 2),
            "estimated_mrr_usd": round(revenue_cents / 100.0, 2),
            "churned_subscriptions_30d": churned_subs,
            "disputes_active": disputes
        }
```

---

## 5. Webhook Endpoints & Knowledge Indexing (`app/main.py`)

Add the endpoints to receive inbound tickets, process Stripe webhooks, and index new docs:

```python
# In app/main.py:
import uuid
from fastapi import Request, Header
from app.support import CustomerSupportAgent
from app.finance import FinancialLedger
from app.knowledge_base import KnowledgeBase
from app.models import SupportTicket

support_agent = CustomerSupportAgent()

class InboundTicketPayload(BaseModel):
    customer_email: str
    subject: str
    body: str

@app.post("/support/tickets")
def handle_inbound_ticket(ticket: InboundTicketPayload, db: Session = Depends(get_db)):
    """Receives inbound customer tickets, searches docs, drafts reply, and triggers bugfixes."""
    resolution = support_agent.process_ticket(
        customer_email=ticket.customer_email,
        subject=ticket.subject,
        body=ticket.body
    )

    ticket_id = str(uuid.uuid4())
    record = SupportTicket(
        id=ticket_id,
        customer_email=ticket.customer_email,
        subject=ticket.subject,
        body=ticket.body,
        reply_draft=resolution.get("reply_draft"),
        is_bug=resolution.get("is_bug", False),
        status="RESOLVED" if not resolution.get("requires_human_escalation") else "ESCALATED"
    )
    db.add(record)
    db.commit()

    return {"ticket_id": ticket_id, "resolution": resolution}

@app.post("/webhooks/stripe")
async def handle_stripe_webhook(request: Request):
    """Processes Stripe payment and subscription lifecycle webhooks."""
    payload = await request.json()
    event_type = payload.get("type", "")
    data_object = payload.get("data", {}).get("object", {})
    event_id = payload.get("id", str(uuid.uuid4()))

    if event_type == "invoice.payment_succeeded":
        FinancialLedger.record_event(
            event_id=event_id,
            customer_id=data_object.get("customer", "unknown"),
            amount_cents=data_object.get("amount_paid", 0),
            event_type=event_type,
            description=data_object.get("lines", {}).get("data", [{}])[0].get("description", "Subscription invoice")
        )
    elif event_type in ["customer.subscription.deleted", "charge.dispute.created"]:
        FinancialLedger.record_event(
            event_id=event_id,
            customer_id=data_object.get("customer", "unknown"),
            amount_cents=0,
            event_type=event_type,
            description=f"Risk/Churn event: {event_type}"
        )

    return {"received": True}

@app.get("/finance/overview")
def get_financial_overview():
    return FinancialLedger.get_financial_health()

@app.post("/knowledge/index")
def index_docs():
    """Indexes or updates markdown files located in ./docs directory."""
    KnowledgeBase.index_markdown_directory("./docs")
    return {"status": "indexed"}
```

---

## 6. Feed Telemetry Update (`app/analytics.py`)

Update `SystemTelemetry` so the `MasterOrchestrator` automatically factors live financial stats and customer ticket volume into its daily morning decisions:

```python
# Update app/analytics.py
from app.finance import FinancialLedger
from app.models import SupportTicket

class SystemTelemetry:
    @staticmethod
    def get_24h_summary() -> dict:
        db: Session = SessionLocal()
        since = datetime.utcnow() - timedelta(hours=24)

        approvals = db.query(ActionApproval).filter(ActionApproval.created_at >= since).all()
        support_count = db.query(SupportTicket).filter(SupportTicket.created_at >= since).count()
        bugs_reported = db.query(SupportTicket).filter(SupportTicket.created_at >= since, SupportTicket.is_bug == True).count()
        db.close()

        financial_health = FinancialLedger.get_financial_health()

        return {
            "period": "Last 24 Hours",
            "total_actions_proposed": len(approvals),
            "actions_executed": sum(1 for a in approvals if a.status == "EXECUTED"),
            "actions_pending_approval": sum(1 for a in approvals if a.status == "PENDING"),
            "customer_support": {
                "inbound_tickets_24h": support_count,
                "bugs_surfaced_24h": bugs_reported
            },
            "financial_metrics": financial_health
        }
```

---

## 7. Real-Time Financial & Support Pulse UI (`components/FinancialMetricsPulse.tsx`)

This component lives directly on the Next.js dashboard, providing real-time financial readouts alongside customer issue volume:

```tsx
"use client";

import { useEffect, useState } from "react";
import { DollarSign, UserMinus, LifeBuoy, AlertCircle } from "lucide-react";

interface FinancialStats {
  trailing_30d_revenue_usd: number;
  estimated_mrr_usd: number;
  churned_subscriptions_30d: number;
  disputes_active: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function FinancialMetricsPulse() {
  const [stats, setStats] = useState<FinancialStats | null>(null);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const res = await fetch(`${API_URL}/finance/overview`);
        if (res.ok) setStats(await res.json());
      } catch (err) {
        console.error("Failed to load financial telemetry", err);
      }
    };
    loadStats();
    const interval = setInterval(loadStats, 10000);
    return () => clearInterval(interval);
  }, []);

  if (!stats) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
      {/* MRR Metric */}
      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between text-zinc-400">
          <span className="text-xs font-mono uppercase tracking-wider">30d Revenue</span>
          <DollarSign className="w-4 h-4 text-emerald-400" />
        </div>
        <p className="text-xl font-bold font-mono text-zinc-100 mt-2">
          ${stats.trailing_30d_revenue_usd.toLocaleString("en-US", { minimumFractionDigits: 2 })}
        </p>
      </div>

      {/* MRR Run-rate */}
      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between text-zinc-400">
          <span className="text-xs font-mono uppercase tracking-wider">Est. MRR</span>
          <DollarSign className="w-4 h-4 text-emerald-400" />
        </div>
        <p className="text-xl font-bold font-mono text-zinc-100 mt-2">
          ${stats.estimated_mrr_usd.toLocaleString("en-US", { minimumFractionDigits: 2 })}
        </p>
      </div>

      {/* Churn Rate */}
      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between text-zinc-400">
          <span className="text-xs font-mono uppercase tracking-wider">30d Churn</span>
          <UserMinus className="w-4 h-4 text-amber-400" />
        </div>
        <p className="text-xl font-bold font-mono text-zinc-100 mt-2">
          {stats.churned_subscriptions_30d} <span className="text-xs text-zinc-500 font-normal">users</span>
        </p>
      </div>

      {/* Disputes/Risk */}
      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between text-zinc-400">
          <span className="text-xs font-mono uppercase tracking-wider">Disputes</span>
          <AlertCircle className={`w-4 h-4 ${stats.disputes_active > 0 ? "text-rose-400" : "text-zinc-500"}`} />
        </div>
        <p className={`text-xl font-bold font-mono mt-2 ${stats.disputes_active > 0 ? "text-rose-400" : "text-zinc-100"}`}>
          {stats.disputes_active}
        </p>
      </div>
    </div>
  );
}
```

Insert `<FinancialMetricsPulse/>` into `app/page.tsx` directly below `<ExecutiveBriefingCard/>`:

```tsx
{/* Executive Directive & OKR Focus */}
<ExecutiveBriefingCard />

{/* Live Business Telemetry & Revenue */}
<FinancialMetricsPulse />

{/* Operator Approvals */}
<ApprovalQueue />
```

---

## 8. Verifying the Self-Healing Loop

Simulate an inbound customer reporting a bug:

```bash
curl -X POST http://localhost:8000/support/tickets \
  -H "Content-Type: application/json" \
  -d '{
    "customer_email": "jane@example.com",
    "subject": "Crash on checkout button click",
    "body": "Whenever I click checkout on the pricing page, it throws a TypeError: undefined reading id in owner/repo."
  }'
```

### What Happens Internally:
1. **RAG Search:** `KnowledgeBase` retrieves pricing documentation chunks from ChromaDB.
2. **Diagnosis:** `CustomerSupportAgent` generates an email response explaining the fix is underway, tags `is_bug=True`, and formats the bug report for `owner/repo`.
3. **Autonomous Escalation:** The support agent calls `execute_agent_task.delay("CodeGenerationAgent", ...)` without human prompting.
4. **Code Engine Takes Over:** `CodeGenerationAgent` formulates a `CREATE_PR` proposal, pushes it to the approval queue, and broadcasts it to the dashboard.
5. **PR Opened:** Once the operator clicks **Approve**, `GitHubAdapter` clones the repo, invokes headless Claude Code CLI to patch the bug, pushes the branch, and opens the PR on GitHub.

The system now runs both proactive company planning (via the CEO orchestrator) and reactive customer and revenue operations (via Support RAG, GitHub self-healing, and Stripe billing).
