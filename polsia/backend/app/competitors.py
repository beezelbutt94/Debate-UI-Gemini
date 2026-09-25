"""Competitor monitoring: detect page changes and assess what they mean."""

import difflib
import hashlib
from typing import Any

from sqlalchemy import select

from app import db, events
from app.models import CompetitorTarget, MarketIntelligence, iso, utcnow
from app.runner import run_claude
from app.webfetch import fetch_text

NAME = "CompetitorResearchAgent"
THREAT_LEVELS = ("LOW", "MEDIUM", "HIGH")


def add_target(name: str, url: str, page_type: str = "landing") -> dict[str, Any]:
    with db.session_scope() as session:
        target = CompetitorTarget(name=name, url=url, page_type=page_type)
        session.add(target)
        session.flush()
        return {"id": target.id, "name": name, "url": url, "page_type": page_type}


def list_targets() -> list[dict[str, Any]]:
    with db.session_scope() as session:
        return [
            {
                "id": t.id,
                "name": t.name,
                "url": t.url,
                "page_type": t.page_type,
                "last_checked_at": iso(t.last_checked_at),
            }
            for t in session.scalars(select(CompetitorTarget).order_by(CompetitorTarget.name))
        ]


def _diff(old: str, new: str, limit: int = 6000) -> str:
    # Pages are flattened to one line of text; diff on sentences instead.
    split = lambda s: [p.strip() for p in s.replace("? ", "?\n").replace(". ", ".\n").splitlines() if p.strip()]  # noqa: E731
    lines = difflib.unified_diff(split(old), split(new), lineterm="", n=0)
    return "\n".join(line for line in lines if line.startswith(("+", "-")) and not line.startswith(("+++", "---")))[:limit]


def check_target(target_id: str, fetcher=fetch_text) -> dict[str, Any]:
    with db.session_scope() as session:
        target = session.get(CompetitorTarget, target_id)
        if target is None:
            raise LookupError(target_id)
        name, url, page_type, old_hash, old_text = target.name, target.url, target.page_type, target.last_hash, target.last_text

    text = fetcher(url)
    new_hash = hashlib.sha256(text.encode()).hexdigest()
    with db.session_scope() as session:
        target = session.get(CompetitorTarget, target_id)
        target.last_hash, target.last_text, target.last_checked_at = new_hash, text, utcnow()

    if old_hash is None:
        return {"target": name, "status": "baseline_captured"}
    if old_hash == new_hash:
        return {"target": name, "status": "unchanged"}

    diff = _diff(old_text or "", text)
    if not diff:
        return {"target": name, "status": "unchanged"}
    simulated = {
        "threat_level": "MEDIUM" if page_type in ("pricing", "changelog") else "LOW",
        "headline": f"{name} updated their {page_type} page",
        "summary": f"{diff.count(chr(10)) + 1} lines changed on {url}.",
        "counter_strategy": "Review the change and decide whether positioning or pricing needs a response.",
    }
    prompt = (
        f"You track competitor {name}. Their {page_type} page ({url}) changed. Here is the diff "
        "(- removed, + added). Assess what changed and whether it threatens us. Do not speculate beyond the diff.\n\n"
        f"{diff}\n\n"
        'Reply with ONLY: {"threat_level": "LOW|MEDIUM|HIGH", "headline": "...", "summary": "...", "counter_strategy": "..."}'
    )
    analysis = run_claude(prompt, agent=NAME, simulated_response=simulated).json()
    threat = str(analysis.get("threat_level", "LOW")).upper()
    with db.session_scope() as session:
        intel = MarketIntelligence(
            competitor=name,
            source_url=url,
            threat_level=threat if threat in THREAT_LEVELS else "LOW",
            headline=str(analysis.get("headline", ""))[:500],
            summary=str(analysis.get("summary", "")),
            counter_strategy=analysis.get("counter_strategy"),
        )
        session.add(intel)
        session.flush()
        out = serialize_intel(intel)
    events.publish("MARKET_INTEL", intel=out)
    return {"target": name, "status": "changed", "intel": out}


def serialize_intel(m: MarketIntelligence) -> dict[str, Any]:
    return {
        "id": m.id,
        "competitor": m.competitor,
        "source_url": m.source_url,
        "threat_level": m.threat_level,
        "headline": m.headline,
        "summary": m.summary,
        "counter_strategy": m.counter_strategy,
        "created_at": iso(m.created_at),
    }


def recent_intel(limit: int = 20) -> list[dict[str, Any]]:
    with db.session_scope() as session:
        return [serialize_intel(m) for m in session.scalars(select(MarketIntelligence).order_by(MarketIntelligence.created_at.desc()).limit(limit))]
