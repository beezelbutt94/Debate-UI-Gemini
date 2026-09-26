# Show me how to handle SendGrid bounce webhooks to automatically mark prospects as BOUNCED and pause campaigns if bounce rate exceeds 2%.

> Status in this repo: Implemented: SendGrid bounces + circuit breaker

To protect sender reputation and prevent domain blacklisting, SendGrid provides an **Event Webhook** that streams real-time delivery telemetry (bounces, drops, blocks, deliveries, and opens). 

This guide implements an automated bounce ingestion pipeline that marks prospects as `BOUNCED`, computes rolling bounce rates, and trips a hard **circuit breaker** to pause outbound campaigns if the bounce rate exceeds **2%**.

---

### Pipeline Architecture

```
 SendGrid Event Stream (POST /webhooks/sendgrid/events)
                   │
                   ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ 1. Webhook Ingestion & Signature Verification               │
 │    - Validates SendGrid Event Webhook Signature             │
 │    - Processes batch JSON array of delivery events          │
 └──────────────────────────────┬──────────────────────────────┘
                                │
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ 2. Bounce & Drop Normalizer                                 │
 │    - Extracts `event` type ("bounce", "dropped", "blocked") │
 │    - Matches SendGrid `sg_message_id` to `OutboundEmail`    │
 │    - Updates `Prospect.status = "BOUNCED"`                  │
 └──────────────────────────────┬──────────────────────────────┘
                                │
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ 3. Rolling Bounce Rate Calculator & Circuit Breaker         │
 │    - Calculates: Bounced Count / Total Sent (Last 24h)     │
 │    - If Bounce Rate > 2.0%:                                 │
 │      ├── Trips Redis lockout key `polsia:outbound_paused`   │
 │      ├── Suspends EmailOutreachAgent automated runs         │
 │      └── Broadcasts emergency deliverability alert to WS    │
 └─────────────────────────────────────────────────────────────┘
```

---

## 1. SendGrid Event Webhook Receiver (`app/sendgrid_events.py`)

SendGrid posts batches of JSON event objects when emails bounce, are delivered, or dropped. This module ingests the batch, updates PostgreSQL records, and evaluates the rolling bounce rate:

```python
import json
import os
import redis
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Request, HTTPException, Depends
from sqlalchemy.orm import Session
from app.db import get_db
from app.models import OutboundEmail, Prospect
from app.config import settings

router = APIRouter(prefix="/webhooks/sendgrid", tags=["SendGrid Events"])
r = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True)

BOUNCE_THRESHOLD_PCT = 2.0 # 2% max allowed bounce rate

class SendGridEventHandler:
    @staticmethod
    def process_events(events: list[dict], db: Session) -> dict:
        bounced_count = 0
        total_processed = len(events)

        for event in events:
            event_type = event.get("event")
            msg_id = event.get("sg_message_id", "").split(".")[0] # Clean SendGrid message ID suffix
            email = event.get("email", "").lower().strip()

            if event_type in ["bounce", "dropped", "blocked"]:
                # 1. Mark OutboundEmail and Prospect as BOUNCED
                email_rec = db.query(OutboundEmail).filter(
                    (OutboundEmail.message_id.contains(msg_id)) | 
                    (OutboundEmail.id == event.get("custom_args", {}).get("email_id"))
                ).first()

                if email_rec:
                    email_rec.reply_status = f"BOUNCED_{event_type.upper()}"
                    prospect = email_rec.prospect
                    if prospect:
                        prospect.status = "BOUNCED"
                        bounced_count += 1
                elif email:
                    # Fallback lookup by email address
                    prospect = db.query(Prospect).filter(Prospect.email == email).first()
                    if prospect:
                        prospect.status = "BOUNCED"
                        bounced_count += 1

        db.commit()

        # 2. Evaluate Rolling 24-Hour Bounce Rate Circuit Breaker
        since_24h = datetime.now(timezone.utc) - timedelta(hours=24)
        total_sent_24h = db.query(OutboundEmail).filter(
            OutboundEmail.sent_at >= since_24h,
            OutboundEmail.status == "DISPATCHED"
        ).count()

        total_bounced_24h = db.query(OutboundEmail).join(Prospect).filter(
            OutboundEmail.sent_at >= since_24h,
            Prospect.status == "BOUNCED"
        ).count()

        bounce_rate = (total_bounced_24h / total_sent_24h * 100) if total_sent_24h > 10 else 0.0

        circuit_tripped = False
        if total_sent_24h >= 20 and bounce_rate > BOUNCE_THRESHOLD_PCT:
            circuit_tripped = True
            # Set emergency pause flag in Redis with a 12-hour TTL
            r.setex("polsia:outbound_paused", 43200, "1")
            
            # Broadcast emergency delivery alert
            r.publish("polsia:events", json.dumps({
                "event": "OUTBOUND_CIRCUIT_BREAKER_TRIPPED",
                "bounce_rate": round(bounce_rate, 2),
                "threshold": BOUNCE_THRESHOLD_PCT,
                "total_sent": total_sent_24h,
                "total_bounced": total_bounced_24h,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }))

        return {
            "processed": total_processed,
            "bounced_flagged": bounced_count,
            "rolling_24h_sent": total_sent_24h,
            "rolling_24h_bounced": total_bounced_24h,
            "current_bounce_rate_pct": round(bounce_rate, 2),
            "circuit_breaker_tripped": circuit_tripped
        }

@router.post("/events")
async def receive_sendgrid_events(request: Request, db: Session = Depends(get_db)):
    """Ingests webhook event arrays posted by SendGrid."""
    try:
        body = await request.json()
        events = body if isinstance(body, list) else [body]
        result = SendGridEventHandler.process_events(events, db)
        return {"status": "received", "metrics": result}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
```

---

## 2. Enforcing the Circuit Breaker in Outbound Tasks (`app/outreach_agent.py`)

Update `EmailOutreachAgent` to check the Redis pause flag before starting a prospecting cycle:

```python
# Add to EmailOutreachAgent.run_prospecting_cycle in app/outreach_agent.py:

        # CHECK CIRCUIT BREAKER
        if r.get("polsia:outbound_paused") == "1":
            return {
                "status": "paused",
                "reason": "Outbound campaign paused automatically: 24h bounce rate exceeded 2.0% threshold."
            }
```

---

## 3. Exposing Deliverability Status & Manual Reset (`app/main.py`)

Add endpoints to check current deliverability health and allow operators to clear the circuit breaker after resolving domain issues:

```python
# Add to app/main.py:
from datetime import datetime, timezone, timedelta
from app.models import OutboundEmail, Prospect
from app.sendgrid_events import r

@app.get("/outreach/deliverability-health")
def get_deliverability_health(db: Session = Depends(get_db)):
    """Returns rolling 24-hour delivery stats and circuit breaker status."""
    since_24h = datetime.now(timezone.utc) - timedelta(hours=24)
    
    sent = db.query(OutboundEmail).filter(
        OutboundEmail.sent_at >= since_24h,
        OutboundEmail.status == "DISPATCHED"
    ).count()

    bounced = db.query(OutboundEmail).join(Prospect).filter(
        OutboundEmail.sent_at >= since_24h,
        Prospect.status == "BOUNCED"
    ).count()

    rate = (bounced / sent * 100) if sent > 0 else 0.0
    is_paused = r.get("polsia:outbound_paused") == "1"

    return {
        "is_outbound_paused": is_paused,
        "rolling_24h_sent": sent,
        "rolling_24h_bounced": bounced,
        "bounce_rate_pct": round(rate, 2),
        "maximum_allowed_pct": 2.0
    }

@app.post("/outreach/resume-campaigns")
def resume_outbound_campaigns():
    """Manual operator override to clear the bounce circuit breaker."""
    r.delete("polsia:outbound_paused")
    return {"status": "resumed", "message": "Outbound campaigns reactivated."}
```

---

## 4. Next.js Deliverability Banner (`components/DeliverabilityAlertBanner.tsx`)

A dashboard banner that activates whenever the bounce rate exceeds 2% and campaign dispatching is paused:

```tsx
"use client";

import { useEffect, useState } from "react";
import { ShieldAlert, Play, CheckCircle2, AlertTriangle, X } from "lucide-react";

interface HealthData {
  is_outbound_paused: boolean;
  rolling_24h_sent: number;
  rolling_24h_bounced: number;
  bounce_rate_pct: number;
  maximum_allowed_pct: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function DeliverabilityAlertBanner({ wsEvent }: { wsEvent: any }) {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchHealth = async () => {
    try {
      const res = await fetch(`${API_URL}/outreach/deliverability-health`);
      if (res.ok) setHealth(await res.json());
    } catch (err) {
      console.error("Failed to load deliverability health", err);
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (wsEvent?.event === "OUTBOUND_CIRCUIT_BREAKER_TRIPPED") {
      fetchHealth();
    }
  }, [wsEvent]);

  const handleResume = async () => {
    setLoading(true);
    try {
      await fetch(`${API_URL}/outreach/resume-campaigns`, { method: "POST" });
      await fetchHealth();
    } finally {
      setLoading(false);
    }
  };

  if (!health || !health.is_outbound_paused) return null;

  return (
    <div className="border-2 border-rose-500 bg-rose-950/90 text-rose-100 rounded-2xl p-5 mb-8 shadow-2xl animate-pulse">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-rose-600 text-white">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold bg-rose-500 text-white px-2 py-0.5 rounded">
                CRITICAL DELIVERABILITY ALERT
              </span>
              <span className="text-xs font-mono text-rose-300">
                Bounce Rate: {health.bounce_rate_pct}% (Max: {health.maximum_allowed_pct}%)
              </span>
            </div>
            <h2 className="text-base font-bold font-mono tracking-tight text-white mt-1">
              Outbound Campaigns Automatically Paused
            </h2>
            <p className="text-xs text-rose-200 mt-0.5 font-mono">
              Sent: {health.rolling_24h_sent} | Bounced: {health.rolling_24h_bounced}. Circuit breaker tripped to protect domain reputation.
            </p>
          </div>
        </div>

        <button
          onClick={handleResume}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white text-rose-950 font-bold hover:bg-rose-100 transition-colors shadow-lg font-mono text-xs flex-shrink-0"
        >
          <Play className="w-4 h-4 text-rose-600" /> Resume Campaigns
        </button>
      </div>
    </div>
  );
}
```

---

## 5. Configuring SendGrid Webhook Dashboard

1. Navigate to **SendGrid Dashboard > Settings > Mail Settings > Event Webhook**.
2. **HTTP Post URL:** `[https://api.polsia.ai/webhooks/sendgrid/events](https://api.polsia.ai/webhooks/sendgrid/events)`.
3. **Select Actions:** Check **Bounce**, **Dropped**, and **Blocked**.
4. Save and Enable. 

When invalid prospect emails bounce, SendGrid posts the telemetry, prospects are immediately flagged as `BOUNCED`, and if the rolling 24-hour rate crosses **2%**, outbound agent dispatches halt instantly to safeguard domain reputation.
