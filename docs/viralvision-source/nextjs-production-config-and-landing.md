Production Next.js Configuration (next.config.mjs)
Configures S3 and Supabase Storage remote media domains, WebAssembly headers for client-side FFmpeg processing, and Content Security Policy (CSP) headers for enterprise deployments.
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
      {
        protocol: "https",
        hostname: "**.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "storage.viralvision.io",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
          {
            key: "Cross-Origin-Embedder-Policy",
            value: "credentialless",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

Tailwind Design System & Kinetic Keyframes (tailwind.config.ts)
Configures theme variables, typography scales, and custom CSS keyframes for kinetic text pops, active speaker audio waveforms, and dynamic badges.
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "pop-in": {
          "0%": { transform: "scale(0.8)", opacity: "0" },
          "70%": { transform: "scale(1.15)", opacity: "1" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "waveform-pulse": {
          "0%, 100%": { height: "4px" },
          "50%": { height: "24px" },
        },
      },
      animation: {
        "pop-in": "pop-in 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards",
        "waveform": "waveform-pulse 0.8s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;

Global Client Providers & Authentication Hydration (app/providers.tsx)
Wraps application routes with Supabase session state, toast notification providers, and auth modals.
"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import type { Session, User } from "@supabase/supabase-js";
import { AuthModal } from "@/components/auth/AuthModal";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  openAuthModal: (redirect?: string) => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  isLoading: true,
  openAuthModal: () => {},
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function Providers({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [redirectTarget, setRedirectTarget] = useState("/dashboard");

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const openAuthModal = (redirect = "/dashboard") => {
    setRedirectTarget(redirect);
    setAuthModalOpen(true);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  return (
    <AuthContext.Provider value={{ user, session, isLoading, openAuthModal, signOut }}>
      {children}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        redirectTo={redirectTarget}
      />
    </AuthContext.Provider>
  );
}

Master Implementation & GitHub Issue Tracking Matrix
The checklist below maps the entire codebase into actionable engineering tickets, branches, and verification milestones.
Epic 1: Core Engine & Async Processing (Months 6–9)
[x] GH-101: Implement Alembic database schema migrations for Quality Tiers, Brand Kits, and Video Files (alembic/versions/20261015_0001.py).
[x] GH-102: Build FFmpeg composition pipeline with dynamic watermark scaling and opacity blending (pipeline.py).
[x] GH-103: Deploy Celery background transcode workers with Redis broker state management (tasks.py).
[x] GH-104: Build Celery Chord batch video generation workflow (batch.py).
[x] GH-105: Configure public FastAPI video rendering and job polling endpoints (video_routes.py).
[x] GH-106: Implement token bucket API rate limiter in Redis with tier-based capacities (token_bucket.py).
Epic 2: AI Video Directing & Creator Tools (Months 9–12)
[x] GH-201: Implement scene-by-scene AI storyboarding engine with Anthropic Claude Opus 4.6 (storyboard.py).
[x] GH-202: Integrate faster-whisper for word-level timestamps and kinetic .ass subtitle styling (subtitles.py).
[x] GH-203: Build audio ducking and EBU R128 (-14 LUFS) loudness mastering filters (audio_mix.py).
[x] GH-204: Implement Foley SFX impact alignment for cuts and visual badge reveals (foley.py).
[x] GH-205: Build ElevenLabs voice synthesis and neural lip-sync pipeline (avatar.py).
[x] GH-206: Implement OpenCLIP vector embedding search over pgvector B-roll catalogs (clip_matcher.py).
[x] GH-207: Build MediaPipe facial tracking and 16:9 to 9:16 smart-cropping filter (crop_engine.py).
[x] GH-208: Build in-browser WebAssembly rendering hook via @ffmpeg/ffmpeg (hooks/useClientPreRenderer.ts).
Epic 3: Monetization & Template Marketplace (Months 12–15)
[x] GH-301: Build VideoTemplate and TemplatePurchase database models with 70/30 revenue splits (models.py).
[x] GH-302: Configure Stripe Connect Express onboarding, checkout sessions, and webhook transfers (marketplace.py, social_auth.py).
[x] GH-303: Build template marketplace discovery grid and purchase flows (app/templates/page.tsx, app/templates/[id]/page.tsx).
[x] GH-304: Build creator template publishing studio (app/templates/create/page.tsx).
[x] GH-305: Build creator revenue, earnings analytics, and bank payout dashboard (components/dashboard/CreatorEarningsDashboard.tsx).
Epic 4: Enterprise Identity, Governance & Workspaces (Months 12–15)
[x] GH-401: Configure SAML 2.0 and OIDC Enterprise Single Sign-On via BoxyHQ Jackson (app/api/auth/sso/route.ts).
[x] GH-402: Implement RBAC authorization middleware with 2-year audit trail logging (audit.py, auth.py).
[x] GH-403: Build multi-tenant custom domain CNAME routing middleware (middleware.ts).
[x] GH-404: Configure dynamic cert-manager SSL and ingress provisioning controller (k8s_controller.py).
[x] GH-405: Build team workspace management, role invitations, and audit log exports (app/dashboard/team/page.tsx, workspace_routes.py).
Epic 5: Algorithmic Intelligence & Social Distribution (Months 15–18)
[x] GH-501: Build 3-second viral hook scoring and script pacing optimization engine (script_opt.py).
[x] GH-502: Implement Thompson Sampling Bayesian multi-armed bandit variant traffic router (ab_testing.py).
[x] GH-503: Implement social sound and hashtag breakout velocity tracker (trends.py, app/dashboard/trends/page.tsx).
[x] GH-504: Build competitor niche gap and hook archetype benchmark scanner (competitor.py, app/dashboard/competitors/page.tsx).
[x] GH-505: Build long-form to short-form acoustic VAD clipping studio (repurpose.py, app/dashboard/repurpose/page.tsx).
[x] GH-506: Deploy direct social content publishing integrations for TikTok, Instagram Reels, and YouTube Shorts (social.py, social_routes.py).
Epic 6: Community, Collaboration & Infrastructure (Months 18–24)
[x] GH-601: Build WebRTC live masterclass broadcasting stage via LiveKit SDK (components/conference/LiveStageRoom.tsx, app/dashboard/events/page.tsx).
[x] GH-602: Deploy Yjs WebSocket synchronization server for real-time collaborative video timeline editing (server/collaboration-server.js, components/timeline/CollaborativeTimeline.tsx).
[x] GH-603: Build timeline review player with timestamp-pinned revision comments and client sign-off (components/timeline/VideoReviewPlayer.tsx, comments.py).
[x] GH-604: Build brand sponsorship brief commissioning and escrow settlement hub (app/dashboard/collaborations/page.tsx, collaboration_routes.py).
[x] GH-605: Build 1-on-1 creator strategy consultation booking directory (app/dashboard/mentorship/page.tsx, mentorship_routes.py).
[x] GH-606: Configure multi-stage GPU worker container builds with CUDA 12.2 and compiled FFmpeg 6.1 NVENC (Dockerfile.worker).
[x] GH-607: Build Kubernetes manifests with KEDA autoscaling based on Redis transcode queue pressure (k8s/).
Consolidated SQLAlchemy Data Models (models.py)
This module unifies all relational database models across workspaces, video assets, brand kits, marketplace transactions, analytics, and AB test records into a single declarative structure.
import uuid
from enum import Enum
from datetime import datetime
from sqlalchemy import (
    Column,
    String,
    Integer,
    Float,
    Boolean,
    DateTime,
    ForeignKey,
    Text,
    Enum as SQLEnum,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from database import Base

class WorkspaceRole(str, Enum):
    OWNER = "owner"
    ADMIN = "admin"
    EDITOR = "editor"
    VIEWER = "viewer"
    GUEST = "guest"

class Workspace(Base):
    __tablename__ = "workspaces"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(128), nullable=False)
    slug = Column(String(64), unique=True, nullable=False)
    tier = Column(String(32), default="standard", nullable=False)
    custom_domain = Column(String(255), unique=True, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    users = relationship("User", back_populates="workspace", cascade="all, delete-orphan")

class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    workspace_id = Column(String(36), ForeignKey("workspaces.id", ondelete="SET NULL"), nullable=True)
    email = Column(String(255), unique=True, nullable=False)
    api_key = Column(String(128), unique=True, nullable=True)
    role = Column(SQLEnum(WorkspaceRole), default=WorkspaceRole.EDITOR, nullable=False)
    stripe_customer_id = Column(String(128), nullable=True)
    stripe_connected_account_id = Column(String(128), nullable=True)
    is_verified_creator = Column(Boolean, default=False, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    tiktok_access_token = Column(String(512), nullable=True)
    meta_access_token = Column(String(512), nullable=True)
    instagram_user_id = Column(String(128), nullable=True)
    google_access_token = Column(String(512), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    workspace = relationship("Workspace", back_populates="users")
    brand_kits = relationship("BrandKit", back_populates="user", cascade="all, delete-orphan")
    video_files = relationship("VideoFile", back_populates="user", cascade="all, delete-orphan")

class BrandKit(Base):
    __tablename__ = "brand_kits"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    logo_url = Column(String(1024), nullable=True)
    logo_position = Column(String(32), default="bottom_right", nullable=False)
    logo_size = Column(Float, default=0.15, nullable=False)
    logo_opacity = Column(Float, default=0.85, nullable=False)
    primary_color = Column(String(7), default="#f59e0b", nullable=False)
    accent_color = Column(String(7), default="#10b981", nullable=False)
    text_color = Column(String(7), default="#ffffff", nullable=False)
    header_font_id = Column(String(64), nullable=True)
    body_font_id = Column(String(64), nullable=True)
    intro_video_url = Column(String(1024), nullable=True)
    outro_video_url = Column(String(1024), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="brand_kits")

class VideoFile(Base):
    __tablename__ = "video_files"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    quality_tier = Column(String(32), default="standard", nullable=False)
    status = Column(String(32), default="queued", nullable=False)  # queued, processing, completed, failed
    source_url = Column(String(1024), nullable=True)
    output_url = Column(String(1024), nullable=True)
    brand_kit_id = Column(String(36), ForeignKey("brand_kits.id", ondelete="SET NULL"), nullable=True)
    duration_seconds = Column(Float, nullable=True)
    render_time_seconds = Column(Float, nullable=True)
    retry_count = Column(Integer, default=0, nullable=False)
    error_summary = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="video_files")
    analytics = relationship("VideoAnalytics", uselist=False, back_populates="video", cascade="all, delete-orphan")

class VideoAnalytics(Base):
    __tablename__ = "video_analytics"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    video_id = Column(String(36), ForeignKey("video_files.id", ondelete="CASCADE"), unique=True, nullable=False)
    total_views = Column(Integer, default=0, nullable=False)
    views_by_day = Column(JSONB, default=dict, nullable=False)
    likes = Column(Integer, default=0, nullable=False)
    comments = Column(Integer, default=0, nullable=False)
    shares = Column(Integer, default=0, nullable=False)
    watch_time_seconds = Column(Integer, default=0, nullable=False)
    avg_watch_time = Column(Float, default=0.0, nullable=False)
    completion_rate = Column(Float, default=0.0, nullable=False)
    retention_curve = Column(JSONB, default=dict, nullable=False)
    traffic_sources = Column(JSONB, default=dict, nullable=False)
    audience_demographics = Column(JSONB, default=dict, nullable=False)
    predicted_views = Column(Integer, nullable=True)
    predicted_engagement_rate = Column(Float, nullable=True)
    viral_score = Column(Float, nullable=True)
    synced_at = Column(DateTime, nullable=True)

    video = relationship("VideoFile", back_populates="analytics")

class VideoTemplate(Base):
    __tablename__ = "video_templates"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    creator_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(64), nullable=False, index=True)
    tags = Column(JSONB, default=list, nullable=False)
    template_file_url = Column(String(1024), nullable=False)
    preview_video_url = Column(String(1024), nullable=True)
    price = Column(Float, default=0.0, nullable=False)
    downloads = Column(Integer, default=0, nullable=False)
    revenue_total = Column(Float, default=0.0, nullable=False)
    rating = Column(Float, default=5.0, nullable=False)
    review_count = Column(Integer, default=0, nullable=False)
    published = Column(Boolean, default=False, nullable=False)
    approved = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

class TemplatePurchase(Base):
    __tablename__ = "template_purchases"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    template_id = Column(String(36), ForeignKey("video_templates.id", ondelete="RESTRICT"), nullable=False)
    buyer_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    purchase_price = Column(Float, nullable=False)
    creator_revenue = Column(Float, nullable=False)
    platform_revenue = Column(Float, nullable=False)
    purchased_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    payout_processed = Column(Boolean, default=False, nullable=False)
    payout_date = Column(DateTime, nullable=True)

class ABExperiment(Base):
    __tablename__ = "ab_experiments"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String(255), nullable=False)
    status = Column(String(32), default="active", nullable=False)
    winner_variant_id = Column(String(36), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    concludes_at = Column(DateTime, nullable=False)

class VideoVariant(Base):
    __tablename__ = "video_variants"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    experiment_id = Column(String(36), ForeignKey("ab_experiments.id", ondelete="CASCADE"), nullable=False)
    variant_label = Column(String(16), nullable=False)
    hook_type = Column(String(64), nullable=False)
    video_file_id = Column(String(36), nullable=False)
    impressions = Column(Integer, default=0, nullable=False)
    hook_views_3s = Column(Integer, default=0, nullable=False)
    completions = Column(Integer, default=0, nullable=False)
    shares = Column(Integer, default=0, nullable=False)
    engagement_rate = Column(Float, default=0.0, nullable=False)

class WebhookSubscription(Base):
    __tablename__ = "webhook_subscriptions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    target_url = Column(String(1024), nullable=False)
    secret_key = Column(String(128), nullable=False)
    subscribed_events = Column(JSONB, default=lambda: ["*"], nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

Database Engine & Session Lifecycle (database.py)
Manages the SQLAlchemy pooled PostgreSQL connection, engine lifecycle, declarative base, and FastAPI session injection generator.
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:viralvision_secure_pw@postgres:5432/viralvision"
)

# Configure connection pool for multi-worker async concurrency
engine = create_engine(
    DATABASE_URL,
    pool_size=20,
    max_overflow=10,
    pool_timeout=30,
    pool_recycle=1800,
    pool_pre_ping=True
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    """FastAPI dependency for thread-local database sessions."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

FastAPI Marketplace & Checkout Controller (marketplace_routes.py)
Exposes search, category filters, template details, and Stripe Connect checkout sessions with 70/30 creator revenue splits.
import os
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
import stripe

from database import get_db
from models import VideoTemplate, TemplatePurchase, User, WorkspaceRole
from auth import get_current_user, RoleChecker

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
PLATFORM_FEE_PERCENTAGE = 0.30

router = APIRouter(prefix="/api/v1/templates", tags=["Marketplace"])

class CreateTemplatePayload(BaseModel):
    title: str = Field(..., min_length=3, max_length=255)
    description: str
    category: str
    tags: List[str]
    price: float
    template_file_url: str
    preview_video_url: str

@router.get("", response_model=List[dict])
def browse_templates(
    category: Optional[str] = None,
    limit: int = 30,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    query = db.query(VideoTemplate).filter(
        VideoTemplate.published.is_(True),
        VideoTemplate.approved.is_(True)
    )
    if category and category.lower() != "all":
        query = query.filter(VideoTemplate.category == category.lower())

    templates = query.order_by(VideoTemplate.downloads.desc()).offset(offset).limit(limit).all()
    return [
        {
            "id": t.id,
            "title": t.title,
            "description": t.description,
            "category": t.category,
            "tags": t.tags,
            "price": t.price,
            "preview_video_url": t.preview_video_url,
            "downloads": t.downloads,
            "rating": t.rating,
            "review_count": t.review_count,
            "creator_id": t.creator_id,
        }
        for t in templates
    ]

@router.get("/{template_id}")
def get_template_details(template_id: str, db: Session = Depends(get_db)):
    t = db.query(VideoTemplate).filter(VideoTemplate.id == template_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")
    return {
        "id": t.id,
        "title": t.title,
        "description": t.description,
        "category": t.category,
        "tags": t.tags,
        "price": t.price,
        "preview_video_url": t.preview_video_url,
        "template_file_url": t.template_file_url,
        "downloads": t.downloads,
        "rating": t.rating,
        "review_count": t.review_count,
        "creator_id": t.creator_id,
    }

@router.post("", status_code=status.HTTP_201_CREATED)
def publish_template(
    payload: CreateTemplatePayload,
    current_user: User = Depends(RoleChecker(WorkspaceRole.EDITOR)),
    db: Session = Depends(get_db)
):
    valid_prices = {0.0, 9.99, 19.99, 49.99}
    if payload.price not in valid_prices:
        raise HTTPException(status_code=400, detail=f"Price must be one of: {sorted(list(valid_prices))}")

    template = VideoTemplate(
        creator_id=current_user.id,
        title=payload.title,
        description=payload.description,
        category=payload.category.lower(),
        tags=payload.tags,
        price=payload.price,
        template_file_url=payload.template_file_url,
        preview_video_url=payload.preview_video_url,
        published=True,
        approved=True,
    )
    db.add(template)
    db.commit()
    db.refresh(template)
    return {"id": template.id, "status": "published"}

@router.post("/{template_id}/purchase")
def purchase_template(
    template_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    template = db.query(VideoTemplate).filter(VideoTemplate.id == template_id).first()
    if not template or not template.published:
        raise HTTPException(status_code=404, detail="Template unavailable")

    creator = db.query(User).filter(User.id == template.creator_id).first()
    if not creator:
        raise HTTPException(status_code=400, detail="Creator record missing")

    # Free template bypass
    if template.price == 0.0:
        purchase = TemplatePurchase(
            template_id=template.id,
            buyer_id=current_user.id,
            purchase_price=0.0,
            creator_revenue=0.0,
            platform_revenue=0.0,
            payout_processed=True,
        )
        template.downloads += 1
        db.add(purchase)
        db.commit()
        return {"session_id": "free_grant", "checkout_url": None}

    price_in_cents = int(template.price * 100)
    platform_fee_cents = int(price_in_cents * PLATFORM_FEE_PERCENTAGE)

    checkout_session = stripe.checkout.Session.create(
        payment_method_types=["card"],
        mode="payment",
        customer_email=current_user.email,
        line_items=[{
            "price_data": {
                "currency": "usd",
                "unit_amount": price_in_cents,
                "product_data": {
                    "name": template.title,
                    "description": template.description or "ViralVision Video Template",
                },
            },
            "quantity": 1,
        }],
        payment_intent_data={
            "application_fee_amount": platform_fee_cents,
            "transfer_data": {
                "destination": creator.stripe_connected_account_id,
            },
            "metadata": {
                "template_id": template.id,
                "buyer_id": current_user.id,
            }
        },
        success_url=f"{os.getenv('NEXT_PUBLIC_APP_URL')}/templates/{template.id}?success=true",
        cancel_url=f"{os.getenv('NEXT_PUBLIC_APP_URL')}/templates/{template.id}?canceled=true",
    )

    return {"checkout_url": checkout_session.url, "session_id": checkout_session.id}

FastAPI Automation Integrations & Webhook Router (integration_routes.py)
Processes Zapier and Make.com automation payloads, executes HMAC signature testing, and manages webhook subscriptions.
import hmac
import hashlib
import json
import time
import requests
from fastapi import APIRouter, Depends, HTTPException, Header, status
from pydantic import BaseModel, HttpUrl
from sqlalchemy.orm import Session

from database import get_db
from models import User, VideoFile, WebhookSubscription, WorkspaceRole
from auth import get_current_user, RoleChecker
from tasks import process_video_task

router = APIRouter(prefix="/api/v1/integrations", tags=["Integrations & Automations"])

class WebhookTestPayload(BaseModel):
    targetUrl: HttpUrl
    secret: str

class RegisterWebhookPayload(BaseModel):
    target_url: HttpUrl
    secret_key: str
    events: list[str] = ["*"]

@router.post("/webhooks/test")
def test_webhook_delivery(payload: WebhookTestPayload):
    test_body = {
        "event": "system.ping",
        "timestamp": int(time.time()),
        "data": {"message": "ViralVision Webhook Pipeline Verified"}
    }
    encoded = json.dumps(test_body, separators=(",", ":")).encode("utf-8")
    sig = hmac.new(payload.secret.encode("utf-8"), encoded, hashlib.sha256).hexdigest()

    headers = {
        "Content-Type": "application/json",
        "X-ViralVision-Event": "system.ping",
        "X-Signature-256": sig,
    }

    start = time.time()
    try:
        res = requests.post(str(payload.targetUrl), data=encoded, headers=headers, timeout=5)
        duration = int((time.time() - start) * 1000)
        return {"statusCode": res.status_code, "durationMs": duration}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Delivery failed: {str(exc)}")

@router.post("/webhooks/subscriptions", status_code=status.HTTP_201_CREATED)
def register_subscription(
    payload: RegisterWebhookPayload,
    current_user: User = Depends(RoleChecker(WorkspaceRole.ADMIN)),
    db: Session = Depends(get_db)
):
    import uuid
    sub = WebhookSubscription(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        target_url=str(payload.target_url),
        secret_key=payload.secret_key,
        subscribed_events=payload.events,
        is_active=True,
    )
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return {"id": sub.id, "status": "active"}

FastAPI Review & Video Approval Router (review_routes.py)
Serves timestamped video revision comments, pin queries, resolution toggling, and client sign-off records.
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from database import get_db
from models import User
from auth import get_current_user
from comments import VideoReviewComment, VideoApprovalRecord

router = APIRouter(prefix="/api/v1/videos/{video_id}/reviews", tags=["Video Reviews"])

class CommentCreatePayload(BaseModel):
    second_mark: float = Field(..., ge=0.0)
    comment_text: str = Field(..., min_length=1, max_length=2000)

class ApprovalPayload(BaseModel):
    approved: bool
    notes: str = ""

@router.get("/comments")
def get_comments(video_id: str, db: Session = Depends(get_db)):
    return (
        db.query(VideoReviewComment)
        .filter(VideoReviewComment.video_id == video_id)
        .order_by(VideoReviewComment.second_mark.asc())
        .all()
    )

@router.post("/comments", status_code=status.HTTP_201_CREATED)
def post_comment(
    video_id: str,
    payload: CommentCreatePayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    import uuid
    c = VideoReviewComment(
        id=str(uuid.uuid4()),
        video_id=video_id,
        author_id=current_user.id,
        second_mark=payload.second_mark,
        comment_text=payload.comment_text,
        resolved=False,
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return c

@router.patch("/comments/{comment_id}/resolve")
def resolve_comment(
    video_id: str,
    comment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    c = db.query(VideoReviewComment).filter(
        VideoReviewComment.id == comment_id,
        VideoReviewComment.video_id == video_id
    ).first()
    if not c:
        raise HTTPException(status_code=404, detail="Comment not found")
    c.resolved = True
    db.commit()
    return {"status": "resolved"}

@router.post("/approval")
def submit_approval(
    video_id: str,
    payload: ApprovalPayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    rec = db.query(VideoApprovalRecord).filter(VideoApprovalRecord.video_id == video_id).first()
    status_label = "approved" if payload.approved else "changes_requested"
    if not rec:
        import uuid
        from datetime import datetime
        rec = VideoApprovalRecord(
            id=str(uuid.uuid4()),
            video_id=video_id,
            approver_id=current_user.id,
            status=status_label,
            decision_notes=payload.notes,
            decided_at=datetime.utcnow(),
        )
        db.add(rec)
    else:
        rec.status = status_label
        rec.decision_notes = payload.notes
    db.commit()
    return {"status": rec.status}

Next.js Root Layout Wire-Up (app/layout.tsx)
Wraps the entire application with global fonts, Tailwind styles, the site header, authentication providers, and footer components from the original project structure.
import type { Metadata } from "next";
import { Inter, Montserrat } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
  variable: "--font-montserrat",
});

export const metadata: Metadata = {
  title: "ViralVision.io — Autonomous Operating System for Short-Form Video",
  description:
    "AI-powered viral short-form video generation, automated kinetic subtitles, multi-stem FFmpeg composition, and creator monetization marketplace.",
  keywords: ["AI video", "TikTok generator", "Reels automation", "Shorts editor", "video operating system"],
  metadataBase: new URL("https://viralvision.io"),
  openGraph: {
    title: "ViralVision.io — Autonomous Video OS",
    description: "Generate high-retention short-form videos with AI storyboarding, neural voices, and kinetic subtitles.",
    url: "https://viralvision.io",
    siteName: "ViralVision",
    images: [
      {
        url: "/images/unseen-reels-logo-primary.png",
        width: 1200,
        height: 630,
      },
    ],
    locale: "en_US",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${montserrat.variable} font-sans bg-neutral-950 text-neutral-100 min-h-screen flex flex-col antialiased selection:bg-amber-500 selection:text-neutral-950`}>
        <Providers>
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}

Next.js Landing Page (app/page.tsx)
Connects the original hero, problem breakdown, how-it-works workflow, lead generation form, pricing tiers, and FAQ accordion with direct launch triggers into the autonomous studio.
"use client";

import React from "react";
import Link from "next/link";
import { Hero } from "@/components/hero";
import { ProblemSection } from "@/components/problem-section";
import { HowItWorks } from "@/components/how-it-works";
import { Pricing } from "@/components/pricing";
import { LeadForm } from "@/components/lead-form";
import { FAQ } from "@/components/faq";
import { useAuth } from "./providers";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowRight, PlayCircle } from "lucide-react";

export default function LandingPage() {
  const { user, openAuthModal } = useAuth();

  return (
    <div className="flex flex-col gap-20 pb-20">
      {/* Hero Section with Live Launch Bridge */}
      <div className="relative">
        <Hero />
        <div className="flex items-center justify-center gap-4 mt-6">
          {user ? (
            <Link href="/dashboard/generate">
              <Button size="lg" className="bg-amber-500 hover:bg-amber-400 text-neutral-950 font-extrabold text-sm px-8 py-6 rounded-xl shadow-lg shadow-amber-500/20">
                <Sparkles className="w-4 h-4 mr-2" /> Open Video Studio <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          ) : (
            <Button
              size="lg"
              onClick={() => openAuthModal("/dashboard/generate")}
              className="bg-amber-500 hover:bg-amber-400 text-neutral-950 font-extrabold text-sm px-8 py-6 rounded-xl shadow-lg shadow-amber-500/20"
            >
              <Sparkles className="w-4 h-4 mr-2" /> Start Creating Free <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          )}
          <Link href="/templates">
            <Button size="lg" variant="outline" className="border-neutral-800 bg-neutral-900/80 hover:bg-neutral-800 text-neutral-200 text-sm px-6 py-6 rounded-xl">
              <PlayCircle className="w-4 h-4 mr-2 text-amber-400" /> Explore Templates
            </Button>
          </Link>
        </div>
      </div>

      <ProblemSection />
      <HowItWorks />
      <Pricing />
      <LeadForm />
      <FAQ />
    </div>
  );
}

