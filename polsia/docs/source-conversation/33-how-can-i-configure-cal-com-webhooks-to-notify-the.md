# How can I configure Cal.com webhooks to notify the Master Orchestrator and create customer records whenever an outbound prospect books a demo?

> Status in this repo: Implemented: Cal.com webhook + customer records

To integrate Cal.com webhooks into Polsia’s autonomous pipeline, set up an ingestion flow that:

1. **Cryptographically verifies** inbound webhook signatures using Cal.com’s `X-Cal-Signature-256` HMAC-SHA256 header.
2. **Promotes existing `Prospect` records** to `CustomerAccount` records while updating cold-outreach conversion attribution.
3. **Injects high-intent prospect context into ChromaDB** and signals the **Master Orchestrator (CEO)** to schedule pre-call briefing preparation.

---

### Pipeline Architecture

```
 Prospect Books via Cal.com
               │
               ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ 1. Webhook Ingestion & HMAC Verification                    │
 │    `POST /webhooks/calcom`                                  │
 │    - Verifies HMAC-SHA256 (`X-Cal-Signature-256`)           │
 │    - Filters trigger: `BOOKING_CREATED`                     │
 └──────────────────────────────┬──────────────────────────────┘
                                │
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ 2. Customer Transition & Database Storage                   │
 │    - Matches booker email against `prospects` table         │
 │    - Status updated: `CONTACTED` -> `CONVERTED_DEMO_BOOKED` │
 │    - Creates entry in `customer_accounts` & `demo_bookings` │
 └──────────────────────────────┬──────────────────────────────┘
                                │
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ 3. Executive Briefing & Memory Injection                    │
 │    - Embeds prospect notes & tech stack into ChromaDB       │
 │    - Emits real-time `DEMO_BOOKED` event over Redis WS      │
 │    - CEO 06:00 Strategy Cycle aggregates upcoming calls     │
 └─────────────────────────────────────────────────────────────┘
```

---

## 1. Database Schema (`app/models.py`)

Add tracking models for customer accounts and scheduled demo bookings:

```python
# Add to app/models.py:
from sqlalchemy import Column, String, Text, DateTime, Integer, Boolean, ForeignKey, JSON
from datetime import datetime, timezone
from sqlalchemy.orm import relationship
from app.db import Base

class CustomerAccount(Base):
    __tablename__ = "customer_accounts"

    id = Column(String, primary_key=True, index=True)
    company_name = Column(String, index=True, nullable=False)
    primary_email = Column(String, unique=True, index=True, nullable=False)
    contact_name = Column(String, nullable=True)
    lifecycle_stage = Column(String, default="LEAD_DEMO_SCHEDULED") # LEAD_DEMO_SCHEDULED, TRIAL, ACTIVE, CHURNED
    detected_tech_stack = Column(Text, nullable=True)
    original_prospect_id = Column(String, ForeignKey("prospects.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    bookings = relationship("DemoBooking", back_populates="customer")

class DemoBooking(Base):
    __tablename__ = "demo_bookings"

    id = Column(String, primary_key=True, index=True)
    customer_id = Column(String, ForeignKey("customer_accounts.id"), nullable=False)
    cal_booking_id = Column(String, unique=True, index=True)
    event_title = Column(String)
    start_time = Column(DateTime(timezone=True), nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=False)
    meeting_url = Column(String, nullable=True)
    responses_json = Column(JSON, default=dict) # Answers to Cal.com custom booking form fields
    status = Column(String, default="ACCEPTED") # ACCEPTED, CANCELLED, RESCHEDULED
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    customer = relationship("CustomerAccount", back_populates="bookings")
```

---

## 2. Webhook HMAC-SHA256 Signature Verification (`app/calcom_verifier.py`)

Cal.com signs webhook payloads using HMAC-SHA256, transmitted via the `X-Cal-Signature-256` header. Verify the signature against the raw body bytes before JSON decoding:

```python
import hmac
import hashlib
import os
from fastapi import HTTPException, Request

CALCOM_WEBHOOK_SECRET = os.getenv("CALCOM_WEBHOOK_SECRET", "")

class CalcomVerifier:
    @staticmethod
    async def verify(request: Request) -> bytes:
        """Validates Cal.com HMAC-SHA256 signature against the raw request body."""
        body = await request.body()
        if not CALCOM_WEBHOOK_SECRET:
            return body

        signature = request.headers.get("X-Cal-Signature-256") or request.headers.get("x-cal-signature-256")
        if not signature:
            raise HTTPException(status_code=401, detail="Missing X-Cal-Signature-256 header")

        computed = hmac.new(
            CALCOM_WEBHOOK_SECRET.encode("utf-8"),
            body,
            hashlib.sha256
        ).hexdigest()

        if not hmac.compare_digest(computed, signature):
            raise HTTPException(status_code=403, detail="Invalid Cal.com HMAC signature")

        return body
```

---

## 3. Fast-Path Webhook Ingestion Route (`app/calcom_router.py`)

Parse incoming `BOOKING_CREATED` (and `BOOKING_CANCELLED`) events and enqueue processing via Celery:

```python
import json
from fastapi import APIRouter, Request, Depends
from app.calcom_verifier import CalcomVerifier

router = APIRouter(prefix="/webhooks/calcom", tags=["Cal.com Webhooks"])

@router.post("")
async def handle_calcom_webhook(request: Request):
    """Ingests Cal.com webhook events and queues processing."""
    body_bytes = await CalcomVerifier.verify(request)
    payload = json.loads(body_bytes.decode("utf-8"))

    # Cal.com payloads typically provide the event trigger type
    trigger_event = payload.get("triggerEvent") or payload.get("event")

    if trigger_event == "BOOKING_CREATED":
        booking_data = payload.get("payload", payload)
        
        # Enqueue background processing
        from app.tasks import process_calcom_booking
        process_calcom_booking.delay(booking_data)
        
        return {"status": "enqueued", "event": trigger_event}

    elif trigger_event in ["BOOKING_CANCELLED", "BOOKING_RESCHEDULED"]:
        booking_data = payload.get("payload", payload)
        from app.tasks import handle_calcom_cancellation
        handle_calcom_cancellation.delay(trigger_event, booking_data)
        return {"status": "enqueued", "event": trigger_event}

    return {"status": "ignored", "event": trigger_event}
```

Include the router in `app/main.py`:
```python
from app.calcom_router import router as calcom_router
app.include_router(calcom_router)
```

---

## 4. Background Celery Processing & Attribution (`app/tasks.py`)

When a booking arrives, this task transitions the prospect record, provisions the `CustomerAccount`, seeds customer context into ChromaDB, and broadcasts the event:

```python
# Add to app/tasks.py:
import uuid
from datetime import datetime, timezone
from dateutil import parser
from app.models import Prospect, CustomerAccount, DemoBooking
from app.memory import AgentMemory

@celery_app.task(bind=True)
def process_calcom_booking(self, booking_payload: dict):
    db = SessionLocal()
    
    # Extract booker details
    # Cal.com returns attendees as a list or a primary booker object
    attendees = booking_payload.get("attendees", [])
    if attendees:
        booker_email = attendees[0].get("email", "").lower().strip()
        booker_name = attendees[0].get("name", "Unknown Contact")
    else:
        booker_email = booking_payload.get("email", "").lower().strip()
        booker_name = booking_payload.get("name", "Unknown Contact")

    if not booker_email:
        db.close()
        return {"status": "error", "message": "No attendee email found"}

    cal_booking_id = str(booking_payload.get("id") or booking_payload.get("uid"))
    start_time = parser.parse(booking_payload.get("startTime") or booking_payload.get("start"))
    end_time = parser.parse(booking_payload.get("endTime") or booking_payload.get("end"))
    meeting_url = booking_payload.get("metadata", {}).get("videoCallUrl") or booking_payload.get("meetingUrl")

    # 1. Match against existing outbound prospecting record
    prospect = db.query(Prospect).filter(Prospect.email == booker_email).first()
    company_name = prospect.company if prospect and prospect.company else booker_email.split("@")[-1].split(".")[0].capitalize()
    detected_stack = prospect.detected_tech_stack if prospect else "Not Detected"

    if prospect:
        prospect.status = "CONVERTED_DEMO_BOOKED"

    # 2. Upsert CustomerAccount
    customer = db.query(CustomerAccount).filter(CustomerAccount.primary_email == booker_email).first()
    if not customer:
        customer_id = str(uuid.uuid4())
        customer = CustomerAccount(
            id=customer_id,
            company_name=company_name,
            primary_email=booker_email,
            contact_name=booker_name,
            lifecycle_stage="LEAD_DEMO_SCHEDULED",
            detected_tech_stack=detected_stack,
            original_prospect_id=prospect.id if prospect else None
        )
        db.add(customer)
        db.commit()
        db.refresh(customer)

    # 3. Create DemoBooking Record (Idempotent by cal_booking_id)
    existing_booking = db.query(DemoBooking).filter(DemoBooking.cal_booking_id == cal_booking_id).first()
    if not existing_booking:
        booking = DemoBooking(
            id=str(uuid.uuid4()),
            customer_id=customer.id,
            cal_booking_id=cal_booking_id,
            event_title=booking_payload.get("title", f"Demo with {company_name}"),
            start_time=start_time,
            end_time=end_time,
            meeting_url=meeting_url,
            responses_json=booking_payload.get("responses", {}),
            status="ACCEPTED"
        )
        db.add(booking)
        db.commit()

    # 4. Inject Customer Intelligence into ChromaDB for CEO & Support Agents
    memory = AgentMemory("CustomerIntelligence")
    memory.record_memory(
        content=(
            f"Confirmed Demo Booking: {booker_name} ({company_name} - {booker_email})\n"
            f"Scheduled Time: {start_time.isoformat()}\n"
            f"Known Stack: {detected_stack}\n"
            f"Form Responses: {json.dumps(booking_payload.get('responses', {}))}"
        ),
        metadata={"customer_id": customer.id, "email": booker_email, "type": "DEMO_BOOKING"}
    )

    # 5. Broadcast Event to Real-Time Dashboard
    r.publish("polsia:events", json.dumps({
        "event": "DEMO_BOOKED",
        "company": company_name,
        "contact_name": booker_name,
        "email": booker_email,
        "start_time": start_time.isoformat(),
        "meeting_url": meeting_url,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }))

    db.close()
    return {"status": "success", "customer_id": customer.id, "booking_id": cal_booking_id}
```

---

## 5. Master Orchestrator (CEO) Integration (`app/analytics.py`)

Update `SystemTelemetry` so that the daily 06:00 UTC morning strategy cycle aggregates all upcoming demos for the day:

```python
# In app/analytics.py (inside SystemTelemetry.get_24h_summary):
from app.models import DemoBooking, CustomerAccount

        now = datetime.now(timezone.utc)
        today_end = now.replace(hour=23, minute=59, second=59)

        # Retrieve demos scheduled for today
        upcoming_demos = db.query(DemoBooking).join(CustomerAccount).filter(
            DemoBooking.start_time.between(now, today_end),
            DemoBooking.status == "ACCEPTED"
        ).all()

        demos_summary = [
            {
                "company": d.customer.company_name,
                "contact": d.customer.contact_name,
                "email": d.customer.primary_email,
                "time": d.start_time.strftime("%H:%M UTC"),
                "stack": d.customer.detected_tech_stack
            }
            for d in upcoming_demos
        ]

        # Add to telemetry return dict
        telemetry_data["scheduled_demos_today"] = demos_summary
```

When `MasterOrchestrator` runs its morning planning pass, Claude Code recognizes upcoming calls and automatically drafts research tasks:

```json
{
  "briefing_type": "MORNING_STRATEGY",
  "okr_focus": "Execute scheduled enterprise demos and close pilot trials",
  "summary": "2 high-priority demos scheduled today (InnovaTech, CloudScale AI).",
  "delegated_tasks": [
    {
      "agent": "CustomerSupportAgent",
      "instruction": "Compile a 1-page architecture brief on InnovaTech's Celery queue bottleneck before the 14:00 demo."
    }
  ]
}
```

---

## 6. Next.js Dashboard Demo Booking Toast (`components/DemoBookedToast.tsx`)

Render an immediate celebration toast and schedule alert when a booking arrives:

```tsx
"use client";

import { useEffect, useState } from "react";
import { CalendarCheck, Video, ExternalLink, X } from "lucide-react";

interface DemoEvent {
  company: string;
  contact_name: string;
  email: string;
  start_time: string;
  meeting_url?: string;
}

export function DemoBookedToast({ wsEvent }: { wsEvent: any }) {
  const [demo, setDemo] = useState<DemoEvent | null>(null);

  useEffect(() => {
    if (wsEvent?.event === "DEMO_BOOKED") {
      setDemo({
        company: wsEvent.company,
        contact_name: wsEvent.contact_name,
        email: wsEvent.email,
        start_time: wsEvent.start_time,
        meeting_url: wsEvent.meeting_url,
      });
    }
  }, [wsEvent]);

  if (!demo) return null;

  return (
    <div className="border border-emerald-500/40 bg-emerald-950/80 text-emerald-100 rounded-2xl p-5 mb-6 shadow-2xl backdrop-blur animate-in slide-in-from-top-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <CalendarCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500 text-zinc-950 font-bold uppercase">
                New Demo Scheduled
              </span>
              <span className="text-xs font-mono text-emerald-300">
                {new Date(demo.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
            <h3 className="text-base font-bold text-white mt-1">
              {demo.company} ({demo.contact_name})
            </h3>
            <p className="text-xs text-emerald-300 font-mono mt-0.5">
              Prospect converted from autonomous B2B outbound sequence.
            </p>
          </div>
        </div>

        <button onClick={() => setDemo(null)} className="text-emerald-400 hover:text-white p-1">
          <X className="w-4 h-4" />
        </button>
      </div>

      {demo.meeting_url && (
        <div className="mt-3 pt-3 border-t border-emerald-800/60 flex justify-end">
          <a
            href={demo.meeting_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-mono font-bold transition-colors"
          >
            <Video className="w-3.5 h-3.5" /> Join Room <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}
    </div>
  );
}
```

---

## 7. Configuring Cal.com Dashboard

1. Navigate to **Cal.com > Settings > Developer > Webhooks > New Webhook**.
2. **Subscriber URL:** `[https://api.polsia.ai/webhooks/calcom](https://api.polsia.ai/webhooks/calcom)`.
3. **Secret:** Set a secure random string (copy into `CALCOM_WEBHOOK_SECRET` in Polsia's `.env`).
4. **Trigger Events:** Check **Booking Created**, **Booking Rescheduled**, and **Booking Cancelled**.
5. Complete a test booking. The prospect's record in PostgreSQL updates from `CONTACTED` to `CONVERTED_DEMO_BOOKED`, a `CustomerAccount` is created, and the CEO Orchestrator flags the call for the day's OKRs.
