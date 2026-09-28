"""Long-term agent memory and product knowledge retrieval.

Retrieval is lexical (term-overlap scoring) over rows in the main database, so
it needs no extra services. Swap `_score` for an embedding store (pgvector,
Chroma) if recall quality starts to matter more than operational simplicity.
"""

import math
import re
from collections import Counter
from pathlib import Path

from sqlalchemy import select

from app import db
from app.config import settings
from app.models import AgentMemoryEntry

_TOKEN = re.compile(r"[a-z0-9]{3,}")
_STOP = {"the", "and", "for", "with", "that", "this", "from", "are", "was", "you", "your", "our"}


def _terms(text: str) -> Counter[str]:
    return Counter(t for t in _TOKEN.findall(text.lower()) if t not in _STOP)


def _score(query: Counter[str], doc: Counter[str]) -> float:
    overlap = sum(min(query[t], doc[t]) for t in query if t in doc)
    return overlap / math.sqrt(1 + sum(doc.values())) if overlap else 0.0


def _rank(query: str, docs: list[tuple[str, str]], k: int) -> list[tuple[str, str]]:
    q = _terms(query)
    scored = [(s, key, text) for key, text in docs if (s := _score(q, _terms(text))) > 0]
    scored.sort(key=lambda item: -item[0])
    return [(key, text) for _, key, text in scored[:k]]


class AgentMemory:
    def __init__(self, agent: str, scan_limit: int = 500):
        self.agent = agent
        self.scan_limit = scan_limit

    def remember(self, content: str, run_id: str | None = None) -> None:
        with db.session_scope() as session:
            session.add(AgentMemoryEntry(agent=self.agent, content=content, run_id=run_id))

    def recall(self, query: str, k: int = 3) -> str:
        stmt = (
            select(AgentMemoryEntry.id, AgentMemoryEntry.content)
            .where(AgentMemoryEntry.agent == self.agent)
            .order_by(AgentMemoryEntry.created_at.desc())
            .limit(self.scan_limit)
        )
        with db.session_scope() as session:
            rows = [(r.id, r.content) for r in session.execute(stmt)]
        hits = _rank(query, rows, k)
        if not hits:
            return "No relevant prior runs."
        return "\n".join(f"- {text}" for _, text in hits)


class KnowledgeBase:
    """Markdown docs under KNOWLEDGE_DIR, split by heading, searched per question."""

    def __init__(self, directory: Path | None = None):
        self.directory = directory or settings.KNOWLEDGE_DIR

    def _sections(self) -> list[tuple[str, str]]:
        sections: list[tuple[str, str]] = []
        for path in sorted(self.directory.glob("**/*.md")):
            text = path.read_text(encoding="utf-8")
            for i, chunk in enumerate(re.split(r"\n(?=#{1,3} )", text)):
                if chunk.strip():
                    sections.append((f"{path.name}#{i}", chunk.strip()))
        return sections

    def search(self, question: str, k: int = 3) -> str:
        hits = _rank(question, self._sections(), k)
        if not hits:
            return "No matching documentation."
        return "\n---\n".join(f"[{key}]\n{text}" for key, text in hits)
