"""Consolidated SQLAlchemy models for the Viral Trending platform service.

This merges the per-feature model definitions scattered across the design
docs (workspaces/users, video pipeline, marketplace, analytics, A/B
testing, trends, competitor intel, brand collaborations, mentorship,
community events, and video review) onto the single `Base` declared in
`database.py`, so `Base.metadata.create_all()` / Alembic see one schema.
"""
import uuid
from datetime import datetime
from enum import Enum

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum as SQLEnum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from app.core.database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class WorkspaceRole(str, Enum):
    OWNER = "owner"
    ADMIN = "admin"
    EDITOR = "editor"
    VIEWER = "viewer"
    GUEST = "guest"


class Workspace(Base):
    __tablename__ = "workspaces"

    id = Column(String(36), primary_key=True, default=_uuid)
    name = Column(String(128), nullable=False)
    slug = Column(String(64), unique=True, nullable=False)
    tier = Column(String(32), default="standard", nullable=False)
    custom_domain = Column(String(255), unique=True, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    users = relationship("User", back_populates="workspace", cascade="all, delete-orphan")


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=_uuid)
    workspace_id = Column(String(36), ForeignKey("workspaces.id", ondelete="SET NULL"), nullable=True)
    email = Column(String(255), unique=True, nullable=False)
    api_key = Column(String(128), unique=True, nullable=True)
    role = Column(SQLEnum(WorkspaceRole), default=WorkspaceRole.EDITOR, nullable=False)
    stripe_customer_id = Column(String(128), nullable=True)
    stripe_connected_account_id = Column(String(128), nullable=True)
    is_verified_creator = Column(Boolean, default=False, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    tiktok_access_token = Column(String(512), nullable=True)
    meta_access_token = Column(String(512), nullable=True)
    instagram_user_id = Column(String(128), nullable=True)
    google_access_token = Column(String(512), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    workspace = relationship("Workspace", back_populates="users")
    brand_kits = relationship("BrandKit", back_populates="user", cascade="all, delete-orphan")
    video_files = relationship("VideoFile", back_populates="user", cascade="all, delete-orphan")


class BrandKit(Base):
    __tablename__ = "brand_kits"

    id = Column(String(36), primary_key=True, default=_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    logo_url = Column(String(1024), nullable=True)
    logo_position = Column(String(32), default="bottom_right", nullable=False)
    logo_size = Column(Float, default=0.15, nullable=False)
    logo_opacity = Column(Float, default=0.85, nullable=False)
    primary_color = Column(String(7), default="#f59e0b", nullable=False)
    accent_color = Column(String(7), default="#10b981", nullable=False)
    text_color = Column(String(7), default="#ffffff", nullable=False)
    header_font_id = Column(String(64), nullable=True)
    body_font_id = Column(String(64), nullable=True)
    intro_video_url = Column(String(1024), nullable=True)
    outro_video_url = Column(String(1024), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="brand_kits")


class VideoFile(Base):
    __tablename__ = "video_files"

    id = Column(String(36), primary_key=True, default=_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    quality_tier = Column(String(32), default="standard", nullable=False)  # draft, standard, premium
    status = Column(String(32), default="queued", nullable=False)  # queued, processing, completed, failed
    source_url = Column(String(1024), nullable=True)
    output_url = Column(String(1024), nullable=True)
    brand_kit_id = Column(String(36), ForeignKey("brand_kits.id", ondelete="SET NULL"), nullable=True)
    duration_seconds = Column(Float, nullable=True)
    render_time_seconds = Column(Float, nullable=True)
    retry_count = Column(Integer, default=0, nullable=False)
    error_summary = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="video_files")
    analytics = relationship("VideoAnalytics", uselist=False, back_populates="video", cascade="all, delete-orphan")


class VideoAnalytics(Base):
    __tablename__ = "video_analytics"

    id = Column(String(36), primary_key=True, default=_uuid)
    video_id = Column(String(36), ForeignKey("video_files.id", ondelete="CASCADE"), unique=True, nullable=False)
    total_views = Column(Integer, default=0, nullable=False)
    views_by_day = Column(JSONB, default=dict, nullable=False)
    likes = Column(Integer, default=0, nullable=False)
    comments = Column(Integer, default=0, nullable=False)
    shares = Column(Integer, default=0, nullable=False)
    watch_time_seconds = Column(Integer, default=0, nullable=False)
    avg_watch_time = Column(Float, default=0.0, nullable=False)
    completion_rate = Column(Float, default=0.0, nullable=False)
    retention_curve = Column(JSONB, default=dict, nullable=False)
    traffic_sources = Column(JSONB, default=dict, nullable=False)
    audience_demographics = Column(JSONB, default=dict, nullable=False)
    predicted_views = Column(Integer, nullable=True)
    predicted_engagement_rate = Column(Float, nullable=True)
    viral_score = Column(Float, nullable=True)
    synced_at = Column(DateTime, nullable=True)

    video = relationship("VideoFile", back_populates="analytics")


class VideoTemplate(Base):
    __tablename__ = "video_templates"

    id = Column(String(36), primary_key=True, default=_uuid)
    creator_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(64), nullable=False, index=True)
    tags = Column(JSONB, default=list, nullable=False)
    template_file_url = Column(String(1024), nullable=False)
    preview_video_url = Column(String(1024), nullable=True)
    price = Column(Float, default=0.0, nullable=False)
    downloads = Column(Integer, default=0, nullable=False)
    revenue_total = Column(Float, default=0.0, nullable=False)
    rating = Column(Float, default=5.0, nullable=False)
    review_count = Column(Integer, default=0, nullable=False)
    published = Column(Boolean, default=False, nullable=False)
    approved = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class TemplatePurchase(Base):
    __tablename__ = "template_purchases"

    id = Column(String(36), primary_key=True, default=_uuid)
    template_id = Column(String(36), ForeignKey("video_templates.id", ondelete="RESTRICT"), nullable=False)
    buyer_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    purchase_price = Column(Float, nullable=False)
    creator_revenue = Column(Float, nullable=False)
    platform_revenue = Column(Float, nullable=False)
    purchased_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    payout_processed = Column(Boolean, default=False, nullable=False)
    payout_date = Column(DateTime, nullable=True)


class ABExperiment(Base):
    __tablename__ = "ab_experiments"

    id = Column(String(36), primary_key=True, default=_uuid)
    title = Column(String(255), nullable=False)
    status = Column(String(32), default="active", nullable=False)  # active, concluded
    winner_variant_id = Column(String(36), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    concludes_at = Column(DateTime, nullable=False)


class VideoVariant(Base):
    __tablename__ = "video_variants"

    id = Column(String(36), primary_key=True, default=_uuid)
    experiment_id = Column(String(36), ForeignKey("ab_experiments.id", ondelete="CASCADE"), nullable=False)
    variant_label = Column(String(16), nullable=False)  # "A", "B", ...
    hook_type = Column(String(64), nullable=False)
    video_file_id = Column(String(36), nullable=False)
    impressions = Column(Integer, default=0, nullable=False)
    hook_views_3s = Column(Integer, default=0, nullable=False)
    completions = Column(Integer, default=0, nullable=False)
    shares = Column(Integer, default=0, nullable=False)
    engagement_rate = Column(Float, default=0.0, nullable=False)


class WebhookSubscription(Base):
    __tablename__ = "webhook_subscriptions"

    id = Column(String(36), primary_key=True, default=_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    target_url = Column(String(1024), nullable=False)
    secret_key = Column(String(128), nullable=False)
    subscribed_events = Column(JSONB, default=lambda: ["*"], nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class BatchJob(Base):
    __tablename__ = "batch_jobs"

    id = Column(String(36), primary_key=True, default=_uuid)
    user_id = Column(String(36), nullable=False)
    total_count = Column(Integer, default=0, nullable=False)
    completed_count = Column(Integer, default=0, nullable=False)
    failed_count = Column(Integer, default=0, nullable=False)
    status = Column(String(32), default="pending", nullable=False)  # pending, processing, completed, partial_failure
    error_summary = Column(Text, nullable=True)


class TrendRecord(Base):
    __tablename__ = "trend_records"

    id = Column(String(36), primary_key=True, default=_uuid)
    platform = Column(String(32), nullable=False)  # tiktok, reels, shorts
    trend_type = Column(String(32), nullable=False)  # sound, hashtag, format
    external_identifier = Column(String(255), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    velocity_score = Column(Float, default=1.0, nullable=False)
    current_post_count = Column(Integer, default=0, nullable=False)
    previous_post_count = Column(Integer, default=0, nullable=False)
    is_rising = Column(Boolean, default=True, nullable=False)
    detected_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    last_updated_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class CompetitorBenchmark(Base):
    __tablename__ = "competitor_benchmarks"

    id = Column(String(36), primary_key=True, default=_uuid)
    workspace_id = Column(String(36), nullable=False, index=True)
    competitor_handle = Column(String(128), nullable=False)
    platform = Column(String(32), nullable=False)
    avg_views = Column(Integer, default=0, nullable=False)
    avg_engagement_rate = Column(Float, default=0.0, nullable=False)
    hook_patterns = Column(JSONB, default=list, nullable=False)
    content_gap_topics = Column(JSONB, default=list, nullable=False)


class BrandBrief(Base):
    __tablename__ = "brand_briefs"

    id = Column(String(36), primary_key=True, default=_uuid)
    brand_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    budget_usd = Column(Float, nullable=False)
    requirements = Column(Text, nullable=False)
    target_creators = Column(Integer, default=1, nullable=False)
    status = Column(String(32), default="open", nullable=False)  # open, filled, archived
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class BriefSubmission(Base):
    __tablename__ = "brief_submissions"

    id = Column(String(36), primary_key=True, default=_uuid)
    brief_id = Column(String(36), ForeignKey("brand_briefs.id", ondelete="CASCADE"), nullable=False)
    creator_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    video_file_id = Column(String(36), nullable=True)
    pitch_text = Column(Text, nullable=True)
    proposal_notes = Column(Text, nullable=True)
    payout_amount = Column(Float, nullable=True)
    commission_fee = Column(Float, nullable=True)
    status = Column(String(32), default="submitted", nullable=False)  # submitted, approved, rejected, paid
    payout_released = Column(Boolean, default=False, nullable=False)
    submitted_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class MentorshipSlot(Base):
    __tablename__ = "mentorship_slots"

    id = Column(String(36), primary_key=True, default=_uuid)
    mentor_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    hourly_rate_usd = Column(Float, default=150.0, nullable=False)
    is_booked = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class MentorshipBooking(Base):
    __tablename__ = "mentorship_bookings"

    id = Column(String(36), primary_key=True, default=_uuid)
    slot_id = Column(String(36), ForeignKey("mentorship_slots.id", ondelete="CASCADE"), unique=True, nullable=False)
    mentor_id = Column(String(36), nullable=False)
    mentee_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    status = Column(String(32), default="confirmed", nullable=False)  # confirmed, completed, refunded
    meeting_link = Column(String(1024), nullable=False)
    booked_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class ConferenceSessionRecord(Base):
    __tablename__ = "conference_sessions"

    id = Column(String(36), primary_key=True, default=_uuid)
    host_id = Column(String(36), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(String(1024), nullable=True)
    room_name = Column(String(128), unique=True, nullable=False)
    is_live = Column(Boolean, default=False, nullable=False)
    max_participants = Column(Integer, default=100, nullable=False)
    scheduled_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class VideoReviewComment(Base):
    __tablename__ = "video_review_comments"

    id = Column(String(36), primary_key=True, default=_uuid)
    video_id = Column(String(36), nullable=False, index=True)
    author_id = Column(String(36), nullable=False)
    second_mark = Column(Float, nullable=False)
    comment_text = Column(Text, nullable=False)
    resolved = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class VideoApprovalRecord(Base):
    __tablename__ = "video_approval_records"

    id = Column(String(36), primary_key=True, default=_uuid)
    video_id = Column(String(36), unique=True, nullable=False, index=True)
    approver_id = Column(String(36), nullable=False)
    status = Column(String(32), default="pending", nullable=False)  # approved, changes_requested
    decision_notes = Column(Text, nullable=True)
    decided_at = Column(DateTime, default=datetime.utcnow, nullable=False)
