import base64
import hashlib
import hmac
import json
import time
from datetime import timedelta

import pytest

from app import bandit, competitors, db, sales
from app.adapters.email import CampaignPausedError, send_email
from app.models import CustomerAccount, DemoBooking, OutboundEmail, Prospect, utcnow
from app.webfetch import FetchError, fetch_text

# --- Stripe -----------------------------------------------------------------------


def _stripe_sig(body: bytes, secret: str, ts: int | None = None) -> str:
    ts = ts or int(time.time())
    return f"t={ts},v1={hmac.new(secret.encode(), f'{ts}.'.encode() + body, hashlib.sha256).hexdigest()}"


def test_stripe_webhook_verifies_and_is_idempotent(client, configure):
    configure(STRIPE_WEBHOOK_SECRET="whsec_test")
    event = {"id": "evt_1", "type": "invoice.paid", "data": {"object": {"amount_paid": 4900, "customer": "cus_1"}}}
    body = json.dumps(event).encode()

    assert client.post("/webhooks/stripe", content=body, headers={"stripe-signature": "t=1,v1=bad"}).status_code == 400
    stale = _stripe_sig(body, "whsec_test", ts=int(time.time()) - 3600)
    assert client.post("/webhooks/stripe", content=body, headers={"stripe-signature": stale}).status_code == 400

    ok = client.post("/webhooks/stripe", content=body, headers={"stripe-signature": _stripe_sig(body, "whsec_test")})
    assert ok.json() == {"received": True, "new": True}
    redelivery = client.post("/webhooks/stripe", content=body, headers={"stripe-signature": _stripe_sig(body, "whsec_test")})
    assert redelivery.json()["new"] is False
    assert client.get("/finance/summary").json()["net_revenue_30d_usd"] == 49.0


def test_webhooks_refuse_unsigned_traffic_outside_sandbox(client, configure):
    configure(SANDBOX_MODE=False)
    assert client.post("/webhooks/stripe", json={"id": "evt"}).status_code == 503
    assert client.post("/webhooks/sentry", json={}).status_code == 503


# --- Support --------------------------------------------------------------------


def test_bug_ticket_files_a_fix_pr_for_approval(client, configure):
    configure(DEFAULT_REPO="acme/app")
    out = client.post(
        "/support/tickets", json={"customer_email": "cto@startup.io", "subject": "Checkout crash", "body": "Clicking pay throws TypeError."}
    ).json()
    assert out["is_bug"] is True and out["status"] == "TRIAGED"
    pending = client.get("/approvals/pending").json()
    assert pending[0]["id"] == out["approval_id"]
    assert pending[0]["payload"]["repo"] == "acme/app"

    client.post(f"/approvals/{out['approval_id']}/resolve", json={"decision": "APPROVE"})
    assert client.get("/support/tickets").json()[0]["status"] == "FIX_PR_OPENED"


def test_bug_without_a_repo_escalates_and_questions_are_triaged(client):
    bug = client.post("/support/tickets", json={"customer_email": "a@b.io", "subject": "App crash", "body": "500 error on save"}).json()
    assert bug["status"] == "ESCALATED" and bug["approval_id"] is None
    question = client.post("/support/tickets", json={"customer_email": "a@b.io", "subject": "Refunds", "body": "How do refunds work?"}).json()
    assert question == {**question, "status": "TRIAGED", "is_bug": False}


def test_support_prompt_is_grounded_in_the_knowledge_base(client, script_model):
    prompts = []
    script_model(lambda prompt, agent: prompts.append(prompt) or {"reply_draft": "r", "is_bug": False, "escalate": False})
    client.post("/support/tickets", json={"customer_email": "a@b.io", "subject": "Refund", "body": "Can I get a refund on billing?"})
    assert "Refunds within 14 days" in prompts[0]


# --- Outreach deliverability ----------------------------------------------------------


def _bounce(i: int, email: str, message_id: str) -> dict:
    return {"event": "bounce", "email": email, "sg_event_id": f"evt-{i}", "sg_message_id": f"{message_id}.filter0001", "reason": "550"}


def test_bounces_mark_prospects_and_trip_the_breaker(client, configure):
    configure(BOUNCE_MIN_SAMPLE=50, BOUNCE_RATE_THRESHOLD=0.02)
    sent = [send_email(f"p{i}@corp{i}.com", "Quick question", "A body long enough to validate.", campaign="q3") for i in range(50)]

    first = client.post("/webhooks/sendgrid", json=[_bounce(0, sent[0]["to"], sent[0]["message_id"])]).json()
    assert first == {"processed": 1, "paused_campaigns": []}  # 1/50 = 2% is not above threshold
    with db.session_scope() as s:
        assert s.query(Prospect).filter_by(email=sent[0]["to"]).one().status == "BOUNCED"

    # Redelivery of the same event is ignored.
    assert client.post("/webhooks/sendgrid", json=[_bounce(0, sent[0]["to"], sent[0]["message_id"])]).json()["processed"] == 0

    second = client.post("/webhooks/sendgrid", json=[_bounce(1, sent[1]["to"], sent[1]["message_id"])]).json()
    assert second["paused_campaigns"] == ["q3"]
    with pytest.raises(CampaignPausedError):
        send_email("new@corp.com", "Hi", "A body long enough to validate.", campaign="q3")

    health = client.get("/deliverability").json()[0]
    assert health["paused"] and health["bounce_rate"] == 0.04
    assert client.post("/deliverability/q3/resume").json()["paused"] is False


def test_bounced_prospects_are_never_emailed_again(client):
    first = send_email("gone@corp.com", "Hi", "A body long enough to validate.")
    client.post("/webhooks/sendgrid", json=[_bounce(9, "gone@corp.com", first["message_id"])])
    assert send_email("gone@corp.com", "Hi again", "A body long enough to validate.")["status"] == "skipped"


def test_sendgrid_ecdsa_signature(client, configure):
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import ec

    key = ec.generate_private_key(ec.SECP256R1())
    public = key.public_key().public_bytes(serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo)
    configure(SENDGRID_WEBHOOK_PUBLIC_KEY=base64.b64encode(public).decode())
    body, ts = b"[]", "1700000000"
    signature = base64.b64encode(key.sign(ts.encode() + body, ec.ECDSA(hashes.SHA256()))).decode()

    headers = {"x-twilio-email-event-webhook-signature": signature, "x-twilio-email-event-webhook-timestamp": ts}
    assert client.post("/webhooks/sendgrid", content=body, headers=headers).status_code == 200
    tampered = {**headers, "x-twilio-email-event-webhook-timestamp": "1700000001"}
    assert client.post("/webhooks/sendgrid", content=body, headers=tampered).status_code == 403


# --- Cal.com and pre-demo briefings ---------------------------------------------------


def _booking(uid: str, start, email="dana@acme-robotics.com", **extra) -> dict:
    return {
        "triggerEvent": extra.pop("trigger", "BOOKING_CREATED"),
        "payload": {
            "uid": uid,
            "title": "Polsia demo",
            "startTime": start.isoformat(),
            "endTime": (start + timedelta(minutes=30)).isoformat(),
            "attendees": [{"email": email, "name": "Dana"}],
            **extra,
        },
    }


def test_calcom_booking_lifecycle(client, configure):
    configure(CALCOM_WEBHOOK_SECRET="cal_secret")
    with db.session_scope() as s:
        s.add(Prospect(email="dana@acme-robotics.com", company="Acme Robotics", status="CONTACTED"))
    start = utcnow() + timedelta(days=1)
    body = json.dumps(_booking("uid-1", start)).encode()

    assert client.post("/webhooks/calcom", content=body, headers={"x-cal-signature-256": "00"}).status_code == 401
    sig = hmac.new(b"cal_secret", body, hashlib.sha256).hexdigest()
    assert client.post("/webhooks/calcom", content=body, headers={"x-cal-signature-256": sig}).json()["status"] == "accepted"

    with db.session_scope() as s:
        customer = s.query(CustomerAccount).one()
        assert customer.company_name == "Acme Robotics"  # from the prospect record, not the domain
        assert customer.website == "https://acme-robotics.com"
        assert s.query(Prospect).one().status == "DEMO_BOOKED"

    configure(CALCOM_WEBHOOK_SECRET="")
    moved = start + timedelta(hours=3)
    client.post("/webhooks/calcom", json=_booking("uid-2", moved, trigger="BOOKING_RESCHEDULED", rescheduleUid="uid-1"))
    with db.session_scope() as s:
        booking = s.query(DemoBooking).one()
        assert booking.cal_booking_uid == "uid-2"

    client.post("/webhooks/calcom", json=_booking("uid-2", moved, trigger="BOOKING_CANCELLED"))
    with db.session_scope() as s:
        assert s.query(DemoBooking).one().status == "CANCELLED"


def test_briefing_is_generated_for_demos_starting_within_the_hour(client, monkeypatch):
    fetched = []
    monkeypatch.setattr(sales, "fetch_text", lambda url, max_chars: fetched.append(url) or "Acme builds warehouse robots.")
    client.post("/webhooks/calcom", json=_booking("soon", utcnow() + timedelta(minutes=60)))
    client.post("/webhooks/calcom", json=_booking("later", utcnow() + timedelta(days=2), email="x@later.io"))

    due = sales.due_bookings()
    assert len(due) == 1
    from app.tasks import generate_due_briefings

    assert generate_due_briefings() == due
    assert sales.due_bookings() == []  # not generated twice
    assert fetched == ["https://acme-robotics.com"]

    demo = next(d for d in client.get("/demos").json() if d["briefing_id"])
    briefing = client.get(f"/briefings/{demo['briefing_id']}").json()
    assert briefing["markdown"].startswith("# Pre-demo briefing: Acme Robotics")


def test_briefing_survives_a_blocked_website(client):
    # The attendee's domain resolves nowhere public, so the fetch is refused but the briefing still lands.
    client.post("/webhooks/calcom", json=_booking("b1", utcnow() + timedelta(hours=5), email="ops@localhost.localdomain"))
    booking_id = client.get("/demos").json()[0]["id"]
    assert client.post(f"/demos/{booking_id}/briefing").json()["company_name"] == "Localhost"


def test_webfetch_refuses_internal_targets():
    for url in ("http://127.0.0.1/", "http://169.254.169.254/latest/meta-data", "file:///etc/passwd", "http://localhost:8000/"):
        with pytest.raises(FetchError):
            fetch_text(url)


# --- Ads bandit ------------------------------------------------------------------------


def test_bandit_shifts_budget_to_the_better_campaign(client, configure):
    configure(ADS_DAILY_BUDGET_USD=100.0, ADS_MIN_ARM_SHARE=0.05)
    client.post("/ads/arms", json={"campaign_id": "c_good", "name": "Good"})
    client.post("/ads/arms", json={"campaign_id": "c_bad", "name": "Bad"})
    for _ in range(5):
        client.post("/ads/arms/c_good/observations", json={"spend_usd": 100, "revenue_usd": 400})
        client.post("/ads/arms/c_bad/observations", json={"spend_usd": 100, "revenue_usd": 60})

    plan = {p["campaign_id"]: p for p in bandit.recommend(seed=1)}
    assert plan["c_good"]["daily_budget_usd"] > 90
    assert plan["c_bad"]["share"] >= 0.05  # exploration floor
    assert abs(sum(p["share"] for p in plan.values()) - 1) < 1e-6
    assert plan["c_good"]["roas_90ci"][0] > 2

    run_id = client.post("/agents/run", json={"agent": "AdsAgent", "instruction": "Rebalance"}).json()["run_id"]
    approval = client.get("/approvals/pending").json()[0]
    assert approval["action_type"] == "UPDATE_AD_BUDGETS"
    client.post(f"/approvals/{approval['id']}/resolve", json={"decision": "APPROVE"})
    assert client.get(f"/runs/{run_id}").json()["status"] == "EXECUTED"
    arms = {a["campaign_id"]: a for a in client.get("/ads/arms").json()["arms"]}
    assert arms["c_good"]["daily_budget_usd"] > arms["c_bad"]["daily_budget_usd"]


def test_ad_budget_above_cap_is_invalid():
    from app.dispatcher import InvalidActionError, validate

    with pytest.raises(InvalidActionError):
        validate("UPDATE_AD_BUDGETS", {"allocations": [{"campaign_id": "c", "daily_budget_usd": 10_000}]})


# --- Competitors ------------------------------------------------------------------------


def test_competitor_change_detection():
    target = competitors.add_target("RivalCo", "https://rival.example", "pricing")
    pages = iter(["Pro plan costs $49. Contact sales.", "Pro plan costs $49. Contact sales.", "Pro plan costs $29. New free tier. Contact sales."])
    fetch = lambda url: next(pages)  # noqa: E731

    assert competitors.check_target(target["id"], fetcher=fetch)["status"] == "baseline_captured"
    assert competitors.check_target(target["id"], fetcher=fetch)["status"] == "unchanged"
    changed = competitors.check_target(target["id"], fetcher=fetch)
    assert changed["status"] == "changed"
    assert changed["intel"]["threat_level"] == "MEDIUM"
    assert competitors.recent_intel()[0]["competitor"] == "RivalCo"


def test_outbound_email_rows_are_recorded():
    send_email("new@lead.io", "Hello", "A body long enough to validate.", campaign="c1")
    with db.session_scope() as s:
        email = s.query(OutboundEmail).one()
        assert email.campaign == "c1" and email.prospect.status == "CONTACTED"
