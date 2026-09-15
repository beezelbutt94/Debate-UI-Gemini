Trend Detection & Sound Velocity Dashboard (app/dashboard/trends/page.tsx)
Connects to the TrendAnalyzer service to surface breakout sounds, hashtags, and format blueprints, displaying real-time velocity curves and offering 1-click video script generation.
"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Flame, TrendingUp, Music, Hash, Sparkles, ExternalLink, ArrowUpRight, Play, Loader2 } from "lucide-react";

interface TrendItem {
  id: string;
  platform: "tiktok" | "reels" | "shorts";
  trend_type: "sound" | "hashtag" | "format";
  external_identifier: string;
  title: string;
  velocity_score: number;
  current_post_count: number;
  is_rising: boolean;
  detected_at: string;
}

export default function TrendDetectionDashboard() {
  const [trends, setTrends] = useState<TrendItem[]>([]);
  const [filterType, setFilterType] = useState<string>("all");
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadTrends() {
      setLoading(true);
      try {
        const query = filterType !== "all" ? `?type=${filterType}` : "";
        const res = await fetch(`/api/v1/analytics/trends${query}`);
        if (res.ok) {
          setTrends(await res.json());
        }
      } catch (err) {
        console.error("Failed to load trends", err);
      } finally {
        setLoading(false);
      }
    }
    loadTrends();
  }, [filterType]);

  const filteredTrends = trends.filter((t) =>
    filterType === "all" ? true : t.trend_type === filterType
  );

  return (
    <div className="max-w-6xl mx-auto p-8 text-neutral-100 min-h-screen space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-800 pb-6">
        <div>
          <span className="text-[10px] font-mono text-amber-500 uppercase tracking-widest flex items-center gap-1">
            <Flame className="w-3.5 h-3.5" /> Predictive Algorithmic Intelligence
          </span>
          <h1 className="text-3xl font-black mt-1">Real-Time Trend & Velocity Radar</h1>
          <p className="text-xs text-neutral-400 mt-1">
            Monitor breakout audio, rising hashtags, and viral format archetypes before they saturate.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {["all", "sound", "hashtag", "format"].map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium uppercase font-mono transition-all ${
                filterType === type
                  ? "bg-amber-500 text-neutral-950 font-bold"
                  : "bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white"
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center text-neutral-500 text-xs">
          <Loader2 className="w-6 h-6 animate-spin text-amber-500 mb-2" />
          Scanning social graphs for breakout velocities...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTrends.map((trend) => (
            <div
              key={trend.id}
              className="bg-neutral-950 border border-neutral-800 hover:border-neutral-700 rounded-2xl p-5 flex flex-col justify-between space-y-4 transition-all"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-[10px] font-mono text-neutral-400 uppercase flex items-center gap-1">
                    {trend.trend_type === "sound" && <Music className="w-3 h-3 text-amber-400" />}
                    {trend.trend_type === "hashtag" && <Hash className="w-3 h-3 text-blue-400" />}
                    {trend.platform}
                  </span>
                  <span className="text-xs font-mono font-bold text-emerald-400 flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5" /> {trend.velocity_score}x Velocity
                  </span>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-white line-clamp-1">{trend.title}</h3>
                  <span className="text-[11px] font-mono text-neutral-500">
                    {trend.current_post_count.toLocaleString()} posts indexed
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t border-neutral-800/80 flex items-center justify-between">
                <span className="text-[10px] font-mono text-amber-400/90">
                  {trend.is_rising ? "Breakout Phase (Early)" : "Plateau Detected"}
                </span>
                <Link href={`/dashboard/generate?prompt=${encodeURIComponent(`Create a viral video using ${trend.title}`)}`}>
                  <Button size="sm" className="bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold h-8">
                    <Sparkles className="w-3 h-3 mr-1" /> Create Video
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

Creator Template Builder & Monetization Studio (app/templates/create/page.tsx)
Enables video creators to upload timeline JSON structures, assign preview demo renders, set price tiers ($0, $9.99, $19.99, $49.99), and verify their 70% Stripe Connect payout allocation.
"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Upload, DollarSign, Tag, FileText, CheckCircle2, ShieldAlert, Sparkles, Loader2 } from "lucide-react";

export default function CreateTemplateStudio() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("business");
  const [tagsInput, setTagsInput] = useState("saas, tech, reels");
  const [price, setPrice] = useState<number>(19.99);
  const [templateJsonUrl, setTemplateJsonUrl] = useState("");
  const [previewVideoUrl, setPreviewVideoUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const tags = tagsInput
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);

    try {
      const res = await fetch("/api/v1/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          category,
          tags,
          price,
          template_file_url: templateJsonUrl,
          preview_video_url: previewVideoUrl,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Failed to publish template");
      }

      router.push("/templates");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-8 text-neutral-100 min-h-screen space-y-8">
      <div>
        <span className="text-[10px] font-mono text-amber-500 uppercase tracking-widest flex items-center gap-1">
          <Sparkles className="w-3 h-3" /> Creator Economy Engine
        </span>
        <h1 className="text-3xl font-black mt-1">Publish & Monetize Template</h1>
        <p className="text-xs text-neutral-400 mt-1">
          List your high-converting short-form timeline blueprints on the ViralVision marketplace and earn 70% recurring royalties.
        </p>
      </div>

      {error && (
        <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-xl text-xs text-rose-300 font-mono">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="p-6 bg-neutral-950 border border-neutral-800 rounded-2xl space-y-6">
        <div>
          <label className="text-xs uppercase font-semibold text-neutral-400 block mb-1">
            Template Title
          </label>
          <input
            type="text"
            required
            placeholder="e.g., Dynamic Split-Screen Reaction with Pop Kinetic Subtitles"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-2.5 text-xs text-neutral-100 outline-none focus:border-amber-500 font-sans"
          />
        </div>

        <div>
          <label className="text-xs uppercase font-semibold text-neutral-400 block mb-1">
            Description & Optimal Use Case
          </label>
          <textarea
            rows={3}
            required
            placeholder="Describe visual pacing, ideal audio BPM, and target audience niches..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-2.5 text-xs text-neutral-100 outline-none focus:border-amber-500 font-sans"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs uppercase font-semibold text-neutral-400 block mb-1">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-2.5 text-xs text-neutral-200 outline-none"
            >
              <option value="business">Business & SaaS</option>
              <option value="education">Education & Documentary</option>
              <option value="fitness">Health & Fitness</option>
              <option value="ecommerce">E-Commerce & Dropshipping</option>
              <option value="tech">Technology</option>
            </select>
          </div>

          <div>
            <label className="text-xs uppercase font-semibold text-neutral-400 block mb-1">
              Tags (Comma separated)
            </label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="minimal, viral, fast-cut"
              className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-2.5 text-xs text-neutral-100 font-mono outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {/* Pricing Selection */}
        <div>
          <label className="text-xs uppercase font-semibold text-neutral-400 block mb-2">
            Pricing License Tier
          </label>
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Free Grant", price: 0.0, split: "$0.00" },
              { label: "Starter", price: 9.99, split: "$6.99 (70%)" },
              { label: "Pro", price: 19.99, split: "$13.99 (70%)" },
              { label: "Enterprise", price: 49.99, split: "$34.99 (70%)" },
            ].map((tier) => (
              <div
                key={tier.price}
                onClick={() => setPrice(tier.price)}
                className={`p-3 rounded-xl border cursor-pointer text-center transition-all ${
                  price === tier.price
                    ? "bg-neutral-900 border-amber-500 shadow-md shadow-amber-500/10"
                    : "bg-neutral-950 border-neutral-800 hover:border-neutral-700"
                }`}
              >
                <div className="text-sm font-bold font-mono text-white">
                  {tier.price === 0 ? "FREE" : `$${tier.price.toFixed(2)}`}
                </div>
                <span className="text-[10px] text-emerald-400 font-mono mt-1 block">
                  {tier.split}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Cloud Media Assets */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs uppercase font-semibold text-neutral-400 block mb-1">
              Timeline Blueprint URL (.json)
            </label>
            <input
              type="url"
              required
              placeholder="https://storage.viralvision.io/templates/schema.json"
              value={templateJsonUrl}
              onChange={(e) => setTemplateJsonUrl(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-2.5 text-xs text-neutral-100 font-mono outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="text-xs uppercase font-semibold text-neutral-400 block mb-1">
              Demo MP4 Preview URL (9:16)
            </label>
            <input
              type="url"
              required
              placeholder="https://storage.viralvision.io/previews/demo.mp4"
              value={previewVideoUrl}
              onChange={(e) => setPreviewVideoUrl(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-2.5 text-xs text-neutral-100 font-mono outline-none focus:border-amber-500"
            />
          </div>
        </div>

        <Button
          type="submit"
          disabled={submitting}
          className="w-full bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs py-3"
        >
          {submitting ? (
            <>
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Verifying & Publishing...
            </>
          ) : (
            "Publish Template to Marketplace"
          )}
        </Button>
      </form>
    </div>
  );
}

Virtual Conference Schedule & Live Broadcasting Hub (app/dashboard/events/page.tsx)
Enables creators and enterprise teams to schedule live masterclasses, generate LiveKit WebRTC tokens, and enter broadcasting breakout stages.
"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { LiveStageRoom } from "@/components/conference/LiveStageRoom";
import { Radio, Calendar, Users, Plus, Play, Clock, ArrowRight, Loader2 } from "lucide-react";

interface ConferenceSession {
  id: string;
  title: string;
  description: string;
  room_name: string;
  is_live: boolean;
  max_participants: number;
  scheduled_at: string;
}

export default function ConferenceHubPage() {
  const [events, setEvents] = useState<ConferenceSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStage, setActiveStage] = useState<{ serverUrl: string; token: string } | null>(null);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  useEffect(() => {
    async function loadEvents() {
      try {
        const res = await fetch("/api/v1/community/events/rooms");
        if (res.ok) setEvents(await res.json());
      } catch (err) {
        console.error("Failed to load events", err);
      } finally {
        setLoading(false);
      }
    }
    loadEvents();
  }, []);

  const handleJoinStage = async (eventId: string, asSpeaker: boolean = false) => {
    setJoiningId(eventId);
    try {
      const res = await fetch(`/api/v1/community/events/rooms/${eventId}/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ as_speaker: asSpeaker }),
      });
      if (res.ok) {
        const data = await res.json();
        setActiveStage({ serverUrl: data.server_url, token: data.token });
      }
    } finally {
      setJoiningId(null);
    }
  };

  if (activeStage) {
    return (
      <LiveStageRoom
        serverUrl={activeStage.serverUrl}
        token={activeStage.token}
        onLeave={() => setActiveStage(null)}
      />
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-8 text-neutral-100 min-h-screen space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-800 pb-6">
        <div>
          <span className="text-[10px] font-mono text-rose-500 uppercase tracking-widest flex items-center gap-1">
            <Radio className="w-3.5 h-3.5" /> WebRTC Interactive Broadcasts
          </span>
          <h1 className="text-3xl font-black mt-1">Creator Conferences & Masterclasses</h1>
          <p className="text-xs text-neutral-400 mt-1">
            Host live short-form video critiques, growth workshops, and stage presentations.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="py-24 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
        </div>
      ) : events.length === 0 ? (
        <div className="py-16 text-center border border-neutral-800 bg-neutral-950 rounded-2xl p-6">
          <Calendar className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
          <p className="text-sm font-bold text-neutral-300">No scheduled sessions active</p>
          <p className="text-xs text-neutral-500 mt-1">Check back soon for community events.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {events.map((evt) => (
            <div
              key={evt.id}
              className="p-6 bg-neutral-950 border border-neutral-800 rounded-2xl flex flex-col justify-between space-y-4"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  {evt.is_live ? (
                    <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-rose-950/60 border border-rose-800 text-rose-400 font-mono font-bold uppercase text-[10px]">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" /> Live Now
                    </span>
                  ) : (
                    <span className="text-neutral-500 font-mono flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(evt.scheduled_at).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </span>
                  )}
                  <span className="text-neutral-400 font-mono text-[11px] flex items-center gap-1">
                    <Users className="w-3 h-3" /> Max {evt.max_participants}
                  </span>
                </div>
                <h3 className="text-base font-bold text-white">{evt.title}</h3>
                <p className="text-xs text-neutral-400 leading-relaxed">{evt.description}</p>
              </div>

              <div className="pt-4 border-t border-neutral-800/80 flex items-center justify-between">
                <span className="text-xs font-mono text-neutral-500">Room: {evt.room_name}</span>
                <Button
                  size="sm"
                  disabled={joiningId === evt.id}
                  onClick={() => handleJoinStage(evt.id, true)}
                  className="bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs px-4"
                >
                  {joiningId === evt.id ? "Connecting..." : "Enter Stage"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

Enterprise Workspace & Compliance Audit Router (workspace_routes.py)
Serves team member management, invitation workflows, audit trail filtering, and streaming CSV compliance report generation for SOC 2 and GDPR record retention.
import io
import csv
from datetime import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Response
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from database import get_db
from models import User, WorkspaceRole
from auth import get_current_user, RoleChecker
from audit import AuditLog

router = APIRouter(prefix="/api/v1/workspace", tags=["Workspace Management"])

class InviteMemberPayload(BaseModel):
    email: EmailStr
    role: WorkspaceRole = WorkspaceRole.EDITOR

@router.get("/members")
def list_workspace_members(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    members = (
        db.query(User)
        .filter(User.workspace_id == current_user.workspace_id)
        .order_by(User.created_at.desc())
        .all()
    )
    return [
        {
            "id": m.id,
            "email": m.email,
            "role": m.role,
            "is_verified_creator": m.is_verified_creator,
            "created_at": m.created_at.strftime("%Y-%m-%d"),
        }
        for m in members
    ]

@router.post("/members/invite", status_code=status.HTTP_201_CREATED)
def invite_workspace_member(
    payload: InviteMemberPayload,
    current_user: User = Depends(RoleChecker(WorkspaceRole.ADMIN)),
    db: Session = Depends(get_db)
):
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="User with this email already belongs to a workspace")

    import uuid
    new_member = User(
        id=str(uuid.uuid4()),
        workspace_id=current_user.workspace_id,
        email=payload.email,
        role=payload.role,
        is_active=True,
    )
    db.add(new_member)
    db.commit()
    db.refresh(new_member)
    return {"status": "invited", "user_id": new_member.id}

@router.get("/audit-logs")
def get_audit_trail(
    limit: int = 50,
    current_user: User = Depends(RoleChecker(WorkspaceRole.ADMIN)),
    db: Session = Depends(get_db)
):
    logs = (
        db.query(AuditLog)
        .filter(AuditLog.workspace_id == current_user.workspace_id)
        .order_by(AuditLog.timestamp.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": l.id,
            "actor_id": l.actor_id,
            "action": l.action,
            "target_resource": l.target_resource,
            "ip_address": l.ip_address or "127.0.0.1",
            "timestamp": l.timestamp.strftime("%Y-%m-%d %H:%M:%S UTC"),
        }
        for l in logs
    ]

@router.get("/audit-logs/export")
def export_audit_logs_csv(
    current_user: User = Depends(RoleChecker(WorkspaceRole.ADMIN)),
    db: Session = Depends(get_db)
):
    logs = (
        db.query(AuditLog)
        .filter(AuditLog.workspace_id == current_user.workspace_id)
        .order_by(AuditLog.timestamp.desc())
        .all()
    )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Timestamp (UTC)", "Actor ID", "Action", "Target Resource", "IP Address"])

    for l in logs:
        writer.writerow([
            l.id,
            l.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
            l.actor_id,
            l.action,
            l.target_resource,
            l.ip_address,
        ])

    csv_data = output.getvalue()
    filename = f"audit_trail_{current_user.workspace_id}_{datetime.utcnow().strftime('%Y%m%d')}.csv"

    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

Collaborative Timeline Review & Approval Player (components/timeline/VideoReviewPlayer.tsx)
Provides video playback with an interactive playhead, timestamped pins for revision notes, and approval sign-off toggles.
"use client";

import React, { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Play, Pause, MessageSquare, CheckCircle2, RotateCcw, Check, Send, AlertTriangle } from "lucide-react";

interface CommentPin {
  id: string;
  second_mark: number;
  comment_text: string;
  resolved: boolean;
  created_at: string;
}

export function VideoReviewPlayer({
  videoId,
  videoUrl,
  initialComments,
}: {
  videoId: string;
  videoUrl: string;
  initialComments: CommentPin[];
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [comments, setComments] = useState<CommentPin[]>(initialComments);
  const [newComment, setNewComment] = useState("");
  const [approvalStatus, setApprovalStatus] = useState<string | null>(null);

  const togglePlayback = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (sec: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = sec;
      setCurrentTime(sec);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      const res = await fetch(`/api/v1/videos/${videoId}/reviews/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          second_mark: Math.round(currentTime * 10) / 10,
          comment_text: newComment,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setComments([...comments, data]);
        setNewComment("");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleResolveComment = async (commentId: string) => {
    try {
      const res = await fetch(`/api/v1/videos/${videoId}/reviews/comments/${commentId}/resolve`, {
        method: "PATCH",
      });
      if (res.ok) {
        setComments(
          comments.map((c) => (c.id === commentId ? { ...c, resolved: true } : c))
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSignOff = async (approved: boolean) => {
    try {
      const res = await fetch(`/api/v1/videos/${videoId}/reviews/approval`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved }),
      });
      if (res.ok) {
        setApprovalStatus(approved ? "Approved" : "Changes Requested");
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-6xl mx-auto p-6 bg-neutral-950 border border-neutral-800 rounded-2xl text-neutral-100">
      {/* Video Player & Scrub Bar */}
      <div className="lg:col-span-7 flex flex-col items-center">
        <div className="w-full max-w-[340px] aspect-[9/16] bg-black rounded-xl overflow-hidden border border-neutral-800 relative shadow-2xl">
          <video
            ref={videoRef}
            src={videoUrl}
            playsInline
            onTimeUpdate={() => videoRef.current && setCurrentTime(videoRef.current.currentTime)}
            onLoadedMetadata={() => videoRef.current && setDuration(videoRef.current.duration)}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Timeline Bar with Comment Marker Pins */}
        <div className="w-full max-w-[340px] mt-4 space-y-2">
          <div className="relative w-full h-4 flex items-center">
            <input
              type="range"
              min={0}
              max={duration || 100}
              step={0.1}
              value={currentTime}
              onChange={(e) => handleSeek(parseFloat(e.target.value))}
              className="w-full h-1 bg-neutral-800 rounded appearance-none cursor-pointer accent-amber-500 z-10"
            />
            {/* Render Pinned Marker Badges */}
            {duration > 0 &&
              comments.map((c) => {
                const leftPct = (c.second_mark / duration) * 100;
                return (
                  <div
                    key={c.id}
                    onClick={() => handleSeek(c.second_mark)}
                    className={`absolute top-0.5 w-2.5 h-2.5 rounded-full cursor-pointer transition-transform hover:scale-125 z-20 ${
                      c.resolved ? "bg-emerald-500" : "bg-amber-400"
                    }`}
                    style={{ left: `${leftPct}%` }}
                    title={`@${c.second_mark}s: ${c.comment_text}`}
                  />
                );
              })}
          </div>

          <div className="flex items-center justify-between text-xs font-mono text-neutral-400">
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={togglePlayback}
                className="h-8 w-8 p-0 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </Button>
              <span>{currentTime.toFixed(1)}s / {duration.toFixed(1)}s</span>
            </div>
            {approvalStatus && (
              <span className={`font-bold ${approvalStatus === "Approved" ? "text-emerald-400" : "text-amber-400"}`}>
                {approvalStatus}
              </span>
            )}
          </div>
        </div>

        {/* Client Sign-off Buttons */}
        <div className="flex gap-2 w-full max-w-[340px] mt-4">
          <Button
            size="sm"
            onClick={() => handleSignOff(true)}
            className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
          >
            <Check className="w-3.5 h-3.5 mr-1" /> Approve Video
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleSignOff(false)}
            className="flex-1 border-neutral-800 bg-neutral-900 text-neutral-300 text-xs"
          >
            <AlertTriangle className="w-3.5 h-3.5 mr-1" /> Request Changes
          </Button>
        </div>
      </div>

      {/* Review Comments Feed */}
      <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
        <div>
          <h3 className="text-sm font-bold text-neutral-200 uppercase tracking-wide flex items-center gap-2 mb-3">
            <MessageSquare className="w-4 h-4 text-amber-400" /> Timestamped Review Notes ({comments.length})
          </h3>

          <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
            {comments.length === 0 ? (
              <p className="text-xs text-neutral-500 py-8 text-center">No feedback markers pinned yet.</p>
            ) : (
              comments.map((c) => (
                <div
                  key={c.id}
                  className={`p-3 rounded-xl border text-xs flex flex-col space-y-1 transition-all ${
                    c.resolved ? "bg-neutral-900/30 border-neutral-800 text-neutral-500" : "bg-neutral-900 border-neutral-800"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => handleSeek(c.second_mark)}
                      className="font-mono text-amber-400 hover:underline font-bold"
                    >
                      @{c.second_mark}s
                    </button>
                    {!c.resolved && (
                      <button
                        onClick={() => handleResolveComment(c.id)}
                        className="text-[10px] text-neutral-400 hover:text-emerald-400 flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3 h-3" /> Mark Resolved
                      </button>
                    )}
                  </div>
                  <p className={c.resolved ? "line-through text-neutral-500" : "text-neutral-200"}>
                    {c.comment_text}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Add Pinned Comment Form */}
        <form onSubmit={handleAddComment} className="pt-3 border-t border-neutral-800 flex gap-2">
          <input
            type="text"
            placeholder={`Add revision note at ${currentTime.toFixed(1)}s...`}
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-100 outline-none focus:border-amber-500 font-sans"
          />
          <Button type="submit" size="sm" className="bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold px-3">
            <Send className="w-3.5 h-3.5" />
          </Button>
        </form>
      </div>

    </div>
  );
}

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

