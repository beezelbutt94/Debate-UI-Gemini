"""Relational state for the swarm: runs, approvals, spend, and each business domain."""

import uuid
from datetime import UTC, date, datetime
from typing import Any

from sqlalchemy import JSON, Boolean, Date, DateTime, Float, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


def _uuid() -> str:
    return str(uuid.uuid4())


def utcnow() -> datetime:
    return datetime.now(UTC)


def as_utc(value: datetime) -> datetime:
    """SQLite drops tzinfo on read; every stored timestamp is UTC, so restore it."""
    return value if value.tzinfo else value.replace(tzinfo=UTC)


def iso(value: datetime | None) -> str | None:
    return as_utc(value).isoformat() if value else None


def _created() -> Mapped[datetime]:
    return mapped_column(DateTime(timezone=True), default=utcnow, index=True)


# --- Agent execution ---------------------------------------------------------


class AgentRun(Base):
    """One agent invocation. The live feed streams these; the dashboard replays them."""

    __tablename__ = "agent_runs"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    agent: Mapped[str] = mapped_column(String, index=True)
    instruction: Mapped[str] = mapped_column(Text)
    trigger: Mapped[str] = mapped_column(String, default="manual")  # manual | schedule | orchestrator | webhook
    # QUEUED -> RUNNING -> COMPLETED | APPROVAL_REQUIRED | EXECUTED | REJECTED | BLOCKED | FAILED
    status: Mapped[str] = mapped_column(String, default="QUEUED", index=True)
    thought: Mapped[str | None] = mapped_column(Text, nullable=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    action_type: Mapped[str | None] = mapped_column(String, nullable=True)
    action_payload: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    verification: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    result: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    cost_usd: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[datetime] = _created()
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class ActionApproval(Base):
    """A high-stakes action parked until a human approves or rejects it."""

    __tablename__ = "action_approvals"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    run_id: Mapped[str | None] = mapped_column(String, index=True, nullable=True)
    agent: Mapped[str] = mapped_column(String, index=True)
    action_type: Mapped[str] = mapped_column(String, index=True)
    payload: Mapped[dict[str, Any]] = mapped_column(JSON)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String, default="PENDING", index=True)  # PENDING | EXECUTED | REJECTED | FAILED
    result: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = _created()
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class AgentMemoryEntry(Base):
    __tablename__ = "agent_memories"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    agent: Mapped[str] = mapped_column(String, index=True)
    content: Mapped[str] = mapped_column(Text)
    run_id: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = _created()


class LLMTokenRecord(Base):
    __tablename__ = "llm_token_records"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    run_id: Mapped[str | None] = mapped_column(String, index=True, nullable=True)
    agent: Mapped[str] = mapped_column(String, index=True)
    model: Mapped[str] = mapped_column(String)
    input_tokens: Mapped[int] = mapped_column(Integer, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, default=0)
    cache_read_tokens: Mapped[int] = mapped_column(Integer, default=0)
    cache_creation_tokens: Mapped[int] = mapped_column(Integer, default=0)
    cost_usd: Mapped[float] = mapped_column(Numeric(12, 6), default=0)
    simulated: Mapped[bool] = mapped_column(Boolean, default=False)
    day: Mapped[date] = mapped_column(Date, index=True, default=lambda: utcnow().date())
    created_at: Mapped[datetime] = _created()


class ExecutiveBriefing(Base):
    __tablename__ = "executive_briefings"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    okr_focus: Mapped[str] = mapped_column(Text)
    summary: Mapped[str] = mapped_column(Text)
    delegated_tasks: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    metrics_snapshot: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = _created()


# --- Support & finance -------------------------------------------------------


class SupportTicket(Base):
    __tablename__ = "support_tickets"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    customer_email: Mapped[str] = mapped_column(String, index=True)
    subject: Mapped[str] = mapped_column(String)
    body: Mapped[str] = mapped_column(Text)
    reply_draft: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_bug: Mapped[bool] = mapped_column(Boolean, default=False)
    escalate: Mapped[bool] = mapped_column(Boolean, default=False)
    approval_id: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, default="OPEN", index=True)  # OPEN | TRIAGED | ESCALATED
    created_at: Mapped[datetime] = _created()


class FinancialTransaction(Base):
    __tablename__ = "financial_transactions"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    stripe_event_id: Mapped[str] = mapped_column(String, unique=True, index=True)
    event_type: Mapped[str] = mapped_column(String, index=True)
    customer_id: Mapped[str | None] = mapped_column(String, index=True, nullable=True)
    amount_cents: Mapped[int] = mapped_column(Integer, default=0)
    currency: Mapped[str] = mapped_column(String, default="usd")
    created_at: Mapped[datetime] = _created()


# --- Growth: outreach, ads, competitors --------------------------------------


class Prospect(Base):
    __tablename__ = "prospects"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    email: Mapped[str] = mapped_column(String, unique=True, index=True)
    name: Mapped[str | None] = mapped_column(String, nullable=True)
    company: Mapped[str | None] = mapped_column(String, nullable=True)
    website: Mapped[str | None] = mapped_column(String, nullable=True)
    # NEW | CONTACTED | BOUNCED | UNSUBSCRIBED | DEMO_BOOKED
    status: Mapped[str] = mapped_column(String, default="NEW", index=True)
    created_at: Mapped[datetime] = _created()
    emails: Mapped[list["OutboundEmail"]] = relationship(back_populates="prospect")


class OutboundEmail(Base):
    __tablename__ = "outbound_emails"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    prospect_id: Mapped[str] = mapped_column(ForeignKey("prospects.id"), index=True)
    campaign: Mapped[str] = mapped_column(String, default="default", index=True)
    subject: Mapped[str] = mapped_column(String)
    body: Mapped[str] = mapped_column(Text)
    message_id: Mapped[str | None] = mapped_column(String, index=True, nullable=True)
    status: Mapped[str] = mapped_column(String, default="SENT", index=True)  # SENT | DELIVERED | BOUNCED | DROPPED
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    prospect: Mapped[Prospect] = relationship(back_populates="emails")


class EmailEvent(Base):
    __tablename__ = "email_events"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    sg_event_id: Mapped[str] = mapped_column(String, unique=True, index=True)
    event: Mapped[str] = mapped_column(String, index=True)
    email: Mapped[str] = mapped_column(String, index=True)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = _created()


class CampaignState(Base):
    """Deliverability circuit breaker. A paused campaign refuses to send."""

    __tablename__ = "campaign_states"
    campaign: Mapped[str] = mapped_column(String, primary_key=True)
    paused: Mapped[bool] = mapped_column(Boolean, default=False)
    pause_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    paused_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class AdArm(Base):
    """Posterior over log(ROAS) for one campaign (Normal-Normal conjugate model)."""

    __tablename__ = "ad_arms"
    campaign_id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String)
    platform: Mapped[str] = mapped_column(String, default="meta")
    mu: Mapped[float] = mapped_column(Float)
    sigma: Mapped[float] = mapped_column(Float)
    total_spend_usd: Mapped[float] = mapped_column(Float, default=0.0)
    total_revenue_usd: Mapped[float] = mapped_column(Float, default=0.0)
    daily_budget_usd: Mapped[float] = mapped_column(Float, default=0.0)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class CompetitorTarget(Base):
    __tablename__ = "competitor_targets"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String, index=True)
    url: Mapped[str] = mapped_column(String)
    page_type: Mapped[str] = mapped_column(String, default="landing")  # landing | pricing | changelog
    last_hash: Mapped[str | None] = mapped_column(String, nullable=True)
    last_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class MarketIntelligence(Base):
    __tablename__ = "market_intelligence"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    competitor: Mapped[str] = mapped_column(String, index=True)
    source_url: Mapped[str] = mapped_column(String)
    threat_level: Mapped[str] = mapped_column(String, default="LOW")  # LOW | MEDIUM | HIGH
    headline: Mapped[str] = mapped_column(Text)
    summary: Mapped[str] = mapped_column(Text)
    counter_strategy: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = _created()


# --- Sales: demos ------------------------------------------------------------


class CustomerAccount(Base):
    __tablename__ = "customer_accounts"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    company_name: Mapped[str] = mapped_column(String, index=True)
    primary_email: Mapped[str] = mapped_column(String, unique=True, index=True)
    contact_name: Mapped[str | None] = mapped_column(String, nullable=True)
    website: Mapped[str | None] = mapped_column(String, nullable=True)
    lifecycle_stage: Mapped[str] = mapped_column(String, default="DEMO_SCHEDULED")
    prospect_id: Mapped[str | None] = mapped_column(ForeignKey("prospects.id"), nullable=True)
    created_at: Mapped[datetime] = _created()
    bookings: Mapped[list["DemoBooking"]] = relationship(back_populates="customer")


class DemoBooking(Base):
    __tablename__ = "demo_bookings"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    customer_id: Mapped[str] = mapped_column(ForeignKey("customer_accounts.id"), index=True)
    cal_booking_uid: Mapped[str] = mapped_column(String, unique=True, index=True)
    title: Mapped[str] = mapped_column(String, default="Demo")
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    end_time: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    meeting_url: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, default="ACCEPTED", index=True)  # ACCEPTED | CANCELLED
    created_at: Mapped[datetime] = _created()
    customer: Mapped[CustomerAccount] = relationship(back_populates="bookings")


class PreDemoBriefing(Base):
    __tablename__ = "pre_demo_briefings"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    booking_id: Mapped[str] = mapped_column(ForeignKey("demo_bookings.id"), unique=True)
    company_name: Mapped[str] = mapped_column(String)
    executive_summary: Mapped[str] = mapped_column(Text)
    pain_points: Mapped[list[str]] = mapped_column(JSON, default=list)
    talking_points: Mapped[list[str]] = mapped_column(JSON, default=list)
    likely_objections: Mapped[list[str]] = mapped_column(JSON, default=list)
    markdown: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = _created()


# --- SRE: deployments, incidents, canaries -----------------------------------


class DeploymentRecord(Base):
    __tablename__ = "deployment_records"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    repo: Mapped[str] = mapped_column(String, index=True)
    commit_sha: Mapped[str] = mapped_column(String, index=True)
    environment: Mapped[str] = mapped_column(String, default="production")
    pr_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    pr_title: Mapped[str | None] = mapped_column(String, nullable=True)
    files_changed: Mapped[list[str]] = mapped_column(JSON, default=list)
    deployed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)


class IncidentRecord(Base):
    __tablename__ = "incident_records"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    source: Mapped[str] = mapped_column(String)  # sentry | manual
    title: Mapped[str] = mapped_column(Text)
    culprit: Mapped[str | None] = mapped_column(String, nullable=True)
    environment: Mapped[str | None] = mapped_column(String, nullable=True)
    deployment_id: Mapped[str | None] = mapped_column(ForeignKey("deployment_records.id"), nullable=True)
    commit_sha: Mapped[str | None] = mapped_column(String, index=True, nullable=True)
    approval_id: Mapped[str | None] = mapped_column(String, nullable=True)
    revert_pr_url: Mapped[str | None] = mapped_column(String, nullable=True)
    # UNCORRELATED | REVERT_PENDING_APPROVAL | REVERT_OPENED | REVERT_FAILED
    status: Mapped[str] = mapped_column(String, default="UNCORRELATED", index=True)
    created_at: Mapped[datetime] = _created()


class CanaryEvaluation(Base):
    __tablename__ = "canary_evaluations"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    repo: Mapped[str] = mapped_column(String, index=True)
    commit_sha: Mapped[str] = mapped_column(String, index=True)
    environment: Mapped[str] = mapped_column(String, default="staging")
    duration_minutes: Mapped[int] = mapped_column(Integer, default=15)
    max_allowed_errors: Mapped[int] = mapped_column(Integer, default=0)
    observed_errors: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String, default="MONITORING", index=True)  # MONITORING | PASSED | FAILED
    failure_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
