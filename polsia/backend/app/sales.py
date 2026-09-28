"""Cal.com demo bookings and the pre-demo executive briefing."""

import hashlib
import hmac
from datetime import timedelta
from typing import Any

from dateutil import parser as dateparser
from sqlalchemy import select

from app import db, events
from app.models import CustomerAccount, DemoBooking, PreDemoBriefing, Prospect, as_utc, iso, utcnow
from app.runner import run_claude
from app.webfetch import fetch_text

NAME = "SalesBriefingAgent"
FREE_MAIL = {"gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "yahoo.com", "icloud.com", "proton.me", "protonmail.com", "aol.com"}


class SignatureError(ValueError):
    pass


def verify_calcom_signature(payload: bytes, signature: str | None, secret: str) -> None:
    if not signature:
        raise SignatureError("Missing X-Cal-Signature-256 header")
    expected = hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, signature):
        raise SignatureError("Cal.com signature mismatch")


def _company_from_email(email: str) -> tuple[str, str | None]:
    domain = email.split("@")[-1].lower()
    if domain in FREE_MAIL:
        return email.split("@")[0], None
    return domain.split(".")[0].replace("-", " ").title(), f"https://{domain}"


def handle_booking_event(trigger: str, payload: dict[str, Any]) -> dict[str, Any]:
    uid = payload.get("uid") or payload.get("bookingId")
    if not uid:
        return {"status": "ignored", "reason": "no booking uid"}
    uid = str(uid)

    if trigger == "BOOKING_CANCELLED":
        with db.session_scope() as session:
            booking = session.scalar(select(DemoBooking).where(DemoBooking.cal_booking_uid == uid))
            if booking:
                booking.status = "CANCELLED"
        return {"status": "cancelled" if booking else "unknown_booking", "uid": uid}

    attendees = payload.get("attendees") or []
    if not attendees or not attendees[0].get("email"):
        return {"status": "ignored", "reason": "no attendee email"}
    email = attendees[0]["email"].strip().lower()
    name = attendees[0].get("name")
    start = dateparser.isoparse(payload["startTime"])
    end = dateparser.isoparse(payload["endTime"])
    meeting_url = (payload.get("metadata") or {}).get("videoCallUrl") or payload.get("location")
    company, website = _company_from_email(email)

    with db.session_scope() as session:
        prospect = session.scalar(select(Prospect).where(Prospect.email == email))
        if prospect:
            prospect.status = "DEMO_BOOKED"
        customer = session.scalar(select(CustomerAccount).where(CustomerAccount.primary_email == email))
        if customer is None:
            customer = CustomerAccount(
                company_name=(prospect.company if prospect and prospect.company else company),
                primary_email=email,
                contact_name=name,
                website=(prospect.website if prospect and prospect.website else website),
                prospect_id=prospect.id if prospect else None,
            )
            session.add(customer)
            session.flush()

        # A reschedule arrives as a new uid that points back at the old one.
        previous_uid = payload.get("rescheduleUid") or payload.get("fromReschedule")
        booking = session.scalar(select(DemoBooking).where(DemoBooking.cal_booking_uid == uid))
        if booking is None and previous_uid:
            booking = session.scalar(select(DemoBooking).where(DemoBooking.cal_booking_uid == str(previous_uid)))
        if booking is None:
            booking = DemoBooking(customer_id=customer.id, cal_booking_uid=uid, start_time=start, end_time=end)
            session.add(booking)
        booking.cal_booking_uid = uid
        booking.title = payload.get("title") or "Demo"
        booking.start_time, booking.end_time = start, end
        booking.meeting_url = meeting_url
        booking.status = "ACCEPTED"
        session.flush()
        booking_id, company_name = booking.id, customer.company_name

    events.publish("DEMO_BOOKED", booking_id=booking_id, company=company_name, email=email, start=start.isoformat())
    return {"status": "recorded", "booking_id": booking_id}


def generate_briefing(booking_id: str) -> dict[str, Any]:
    with db.session_scope() as session:
        existing = session.scalar(select(PreDemoBriefing).where(PreDemoBriefing.booking_id == booking_id))
        if existing:
            return serialize_briefing(existing)
        booking = session.get(DemoBooking, booking_id)
        if booking is None:
            raise LookupError(booking_id)
        company = booking.customer.company_name
        contact = booking.customer.contact_name or booking.customer.primary_email
        website = booking.customer.website
        start = as_utc(booking.start_time)

    site_text = "No company website available (personal email domain)."
    if website:
        try:
            site_text = fetch_text(website, max_chars=8000)
        except Exception as exc:  # a dead or blocked site must not block the briefing
            site_text = f"Website fetch failed: {exc}"

    simulated = {
        "executive_summary": f"{company} booked a demo for {start:%Y-%m-%d %H:%M} UTC. Research is limited to their public website.",
        "pain_points": ["Manual operational work competing with product work", "Slow response on customer bugs"],
        "talking_points": ["Human approval gate on every irreversible action", "Per-agent daily spend caps"],
        "likely_objections": ["Trusting agents with production access", "Cost predictability"],
    }
    prompt = (
        "Prepare a pre-demo briefing for our account executive. Use ONLY the facts below; "
        "mark anything inferred as an inference.\n\n"
        f"Company: {company}\nAttendee: {contact}\nDemo start (UTC): {start.isoformat()}\n\n"
        f"Company website text:\n{site_text}\n\n"
        'Reply with ONLY: {"executive_summary": "...", "pain_points": ["..."], "talking_points": ["..."], "likely_objections": ["..."]}'
    )
    data = run_claude(prompt, agent=NAME, simulated_response=simulated).json()

    def _list(key: str) -> list[str]:
        return [str(x) for x in data.get(key) or []][:6]

    markdown = "\n".join(
        [
            f"# Pre-demo briefing: {company}",
            f"**Attendee:** {contact}  \n**When:** {start:%Y-%m-%d %H:%M} UTC",
            "",
            "## Summary",
            str(data.get("executive_summary", "")),
            "",
            "## Likely pain points",
            *[f"- {p}" for p in _list("pain_points")],
            "",
            "## Talking points",
            *[f"- {p}" for p in _list("talking_points")],
            "",
            "## Objections to prepare for",
            *[f"- {p}" for p in _list("likely_objections")],
        ]
    )
    with db.session_scope() as session:
        briefing = PreDemoBriefing(
            booking_id=booking_id,
            company_name=company,
            executive_summary=str(data.get("executive_summary", "")),
            pain_points=_list("pain_points"),
            talking_points=_list("talking_points"),
            likely_objections=_list("likely_objections"),
            markdown=markdown,
        )
        session.add(briefing)
        session.flush()
        out = serialize_briefing(briefing)
    events.publish("BRIEFING_READY", booking_id=booking_id, company=company)
    return out


def due_bookings(lead: timedelta = timedelta(minutes=45), horizon: timedelta = timedelta(minutes=75)) -> list[str]:
    """Bookings starting 45-75 min from now with no briefing yet (polled every 15 min)."""
    now = utcnow()
    with db.session_scope() as session:
        briefed = select(PreDemoBriefing.booking_id)
        rows = session.scalars(
            select(DemoBooking.id).where(
                DemoBooking.status == "ACCEPTED",
                DemoBooking.start_time.between(now + lead, now + horizon),
                DemoBooking.id.not_in(briefed),
            )
        )
        return list(rows)


def serialize_briefing(b: PreDemoBriefing) -> dict[str, Any]:
    return {
        "id": b.id,
        "booking_id": b.booking_id,
        "company_name": b.company_name,
        "executive_summary": b.executive_summary,
        "pain_points": b.pain_points,
        "talking_points": b.talking_points,
        "likely_objections": b.likely_objections,
        "markdown": b.markdown,
        "created_at": iso(b.created_at),
    }


def upcoming_demos() -> list[dict[str, Any]]:
    now = utcnow()
    with db.session_scope() as session:
        rows = session.scalars(
            select(DemoBooking)
            .where(DemoBooking.start_time >= now - timedelta(hours=1), DemoBooking.status == "ACCEPTED")
            .order_by(DemoBooking.start_time)
            .limit(20)
        )
        out = []
        for b in rows:
            briefing = session.scalar(select(PreDemoBriefing.id).where(PreDemoBriefing.booking_id == b.id))
            out.append(
                {
                    "id": b.id,
                    "company": b.customer.company_name,
                    "email": b.customer.primary_email,
                    "title": b.title,
                    "start_time": iso(b.start_time),
                    "meeting_url": b.meeting_url,
                    "briefing_id": briefing,
                }
            )
        return out
