# How can I use Claude Code and ChromaDB to synthesize an updated competitive feature comparison matrix comparing Polsia to all tracked rivals?

> Status in this repo: Deferred: ChromaDB feature matrix

Synthesizing a competitive feature comparison matrix requires solving a common RAG limitation: a single naive similarity query across all rivals will blend context and hallucinate parity. 

To produce an accurate matrix, we use a **two-phase structured retrieval and synthesis pipeline**:
1. **Targeted Multi-Entity Extraction (ChromaDB):** Query ChromaDB across predefined capability axes, segmenting chunks by entity (`Polsia` vs. each competitor in metadata filters).
2. **Deterministic Evaluation (Claude Code CLI):** Feed structured evidence into headless Claude Code (`claude -p --output-format json`) to grade each capability (`FULL`, `PARTIAL`, `NONE`, or `PLANNED`) with source citations.

---

### Pipeline Architecture

```
 ┌────────────────────────────────────────────────────────────────────────┐
 │ 1. ChromaDB Multi-Entity Semantic Retrieval                            │
 │    Dimension Axes:                                                     │
 │    • Sandbox Isolation (gVisor/Firecracker)                            │
 │    • Code Generation & Self-Healing PRs                                │
 │    • Dynamic Ad Optimization (Bandit Algorithms)                       │
 │    • Inbound Customer Support RAG                                      │
 │    • Autonomy Level (Zero-Human vs. Copilot)                           │
 └───────────────────┬────────────────────────────────┬───────────────────┘
                     │                                │
    Polsia Evidence  │                                │ Competitor Evidence
    (docs_collection)│                                │ (competitor_collection)
                     ▼                                ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │ 2. Headless Claude Code Matrix Synthesizer                             │
 │    - Cross-references evidence per cell                                │
 │    - Evaluates support status + concise justification                 │
 │    - Emits structured JSON schema matching UI contract                 │
 └──────────────────────────────────┬─────────────────────────────────────┘
                                    │
        ┌───────────────────────────┴───────────────────────────┐
        ▼                                                       ▼
 [ Relational Snapshot DB ]                               [ Next.js Matrix ]
 - Stores MatrixVersion history                           - Dynamic Status Pills
 - Injected into CEO 06:00 Strategy                       - Category Grouping
```

---

## 1. ChromaDB Multi-Entity Context Retriever (`app/matrix_retriever.py`)

This module queries Polsia's internal knowledge base alongside competitor snapshots previously scraped and indexed into ChromaDB:

```python
from typing import Dict, List, Any
import chromadb
from app.knowledge_base import docs_collection # Polsia's product documentation
from app.scraper import client as chroma_client

# Competitor intel collection where snapshots and changelogs are stored
competitor_collection = chroma_client.get_or_create_collection(
    name="competitor_intelligence",
    metadata={"hnsw:space": "cosine"}
)

FEATURE_AXES = [
    {
        "category": "Architecture & Security",
        "features": [
            {"id": "microvm_sandbox", "name": "Hardware/Syscall Sandbox", "query": "gVisor Firecracker sandbox untrusted code isolation"},
            {"id": "egress_filtering", "name": "Strict Network Egress Filtering", "query": "SNI proxy mTLS firewall network whitelist"}
        ]
    },
    {
        "category": "Software Engineering",
        "features": [
            {"id": "automated_prs", "name": "Autonomous GitHub PR Creation", "query": "automated pull request git commit branch push bug fix"},
            {"id": "self_healing", "name": "Support Ticket to Bugfix Loop", "query": "customer support self-healing automatic bug patch"}
        ]
    },
    {
        "category": "Growth & Autonomous Marketing",
        "features": [
            {"id": "bandit_ads", "name": "Bayesian Ad Budget Optimization", "query": "multi armed bandit Thompson sampling ROAS budget reallocation"},
            {"id": "ad_creative_gen", "name": "Autonomous Ad Banner Generation", "query": "diffusion image ad banner typography compositor generation"}
        ]
    },
    {
        "category": "Operations & Autonomy",
        "features": [
            {"id": "zero_human_ops", "name": "Unattended Autonomous Scheduler", "query": "scheduled cron autonomous CEO master orchestrator Celery"},
            {"id": "hitl_controls", "name": "Human-in-the-Loop Safeguards", "query": "approval queue operator safety guardrails budget ceiling"}
        ]
    }
]

class CompetitiveMatrixRetriever:
    @staticmethod
    def gather_evidence_for_feature(feature_query: str, competitor_names: List[str]) -> Dict[str, str]:
        """
        Retrieves relevant textual evidence for a specific feature query
        across Polsia and all tracked competitor names.
        """
        evidence = {}

        # 1. Retrieve Polsia internal capability evidence
        polsia_docs = docs_collection.query(query_texts=[feature_query], n_results=2)
        polsia_chunks = polsia_docs.get("documents", [[]])[0]
        evidence["Polsia"] = " ".join(polsia_chunks) if polsia_chunks else "No documentation found."

        # 2. Retrieve competitor evidence via metadata filtering
        for comp in competitor_names:
            try:
                comp_docs = competitor_collection.query(
                    query_texts=[feature_query],
                    where={"competitor": comp},
                    n_results=2
                )
                comp_chunks = comp_docs.get("documents", [[]])[0]
                evidence[comp] = " ".join(comp_chunks) if comp_chunks else "No evidence found on landing pages or changelogs."
            except Exception:
                evidence[comp] = "No data available."

        return evidence
```

---

## 2. Matrix Synthesis Engine via Claude Code (`app/matrix_synthesizer.py`)

We feed the retrieved capability evidence into headless Claude Code (`claude -p`). The prompt enforces a uniform evaluation rubric:

```python
import json
import uuid
from typing import Dict, Any, List
from app.runner import run_claude_headless
from app.config import settings
from app.matrix_retriever import CompetitiveMatrixRetriever, FEATURE_AXES
from app.db import SessionLocal
from app.models import CompetitorTarget, CompetitiveMatrixSnapshot

class MatrixSynthesizer:
    @classmethod
    def generate_matrix(cls) -> Dict[str, Any]:
        db = SessionLocal()
        # Find unique competitor names currently tracked
        targets = db.query(CompetitorTarget.name).distinct().all()
        competitor_names = [t[0] for t in targets] if targets else ["DevAgent.ai", "SwarmCode"]

        # Collect evidence across all feature dimensions
        structured_evidence = []
        for group in FEATURE_AXES:
            category_data = {"category": group["category"], "features": []}
            for feat in group["features"]:
                evidence_map = CompetitiveMatrixRetriever.gather_evidence_for_feature(
                    feat["query"], competitor_names
                )
                category_data["features"].append({
                    "id": feat["id"],
                    "name": feat["name"],
                    "evidence": evidence_map
                })
            structured_evidence.append(category_data)

        # Headless Claude Code analysis pass
        prompt = (
            "You are a principal technical product analyst.\n"
            "Evaluate the evidence below to build an objective Competitive Feature Matrix "
            "comparing Polsia to tracked competitors.\n\n"
            f"STRUCTURED EVIDENCE BY CAPABILITY:\n{json.dumps(structured_evidence, indent=2)}\n\n"
            "EVALUATION RUBRIC FOR STATUS:\n"
            "- 'FULL': Actively supported, automated, and documented in evidence.\n"
            "- 'PARTIAL': Manual, basic, copilot-only, or limited functionality.\n"
            "- 'NONE': No evidence or feature confirmed missing.\n"
            "- 'PLANNED': Mentioned on roadmap/changelog as upcoming.\n\n"
            "OUTPUT SPECIFICATION (STRICT JSON ONLY):\n"
            "{\n"
            '  "competitors": ["DevAgent.ai", "SwarmCode"],\n'
            '  "summary_verdict": "Executive strategic overview of Polsia vs. competitors",\n'
            '  "matrix": [\n'
            '    {\n'
            '      "category": "Architecture & Security",\n'
            '      "rows": [\n'
            '        {\n'
            '          "feature_name": "Hardware/Syscall Sandbox",\n'
            '          "evaluations": {\n'
            '            "Polsia": {"status": "FULL", "note": "gVisor runsc isolation with mTLS Envoy proxy"},\n'
            '            "DevAgent.ai": {"status": "NONE", "note": "Runs directly in host container"}\n'
            '          }\n'
            '        }\n'
            '      ]\n'
            '    }\n'
            '  ]\n'
            "}"
        )

        res = run_claude_headless(
            prompt=prompt,
            system_prompt="Return raw JSON only. Do not wrap in markdown fences.",
            allowed_tools=[]
        )

        try:
            matrix_data = json.loads(res.get("result", "{}"))
        except Exception:
            matrix_data = {
                "competitors": competitor_names,
                "summary_verdict": "Fallback generation due to parsing error.",
                "matrix": []
            }

        # Persist generated snapshot to database
        snapshot_id = str(uuid.uuid4())
        snapshot = CompetitiveMatrixSnapshot(
            id=snapshot_id,
            competitors=json.dumps(competitor_names),
            matrix_json=json.dumps(matrix_data),
            summary_verdict=matrix_data.get("summary_verdict", "")
        )
        db.add(snapshot)
        db.commit()
        db.close()

        return {"snapshot_id": snapshot_id, "data": matrix_data}
```

---

## 3. Relational Persistence Schema (`app/models.py`)

Store generated matrices for historical tracking and version diffing:

```python
# Add to app/models.py:
from sqlalchemy import Column, String, Text, DateTime
from datetime import datetime
from app.db import Base

class CompetitiveMatrixSnapshot(Base):
    __tablename__ = "competitive_matrix_snapshots"

    id = Column(String, primary_key=True, index=True)
    competitors = Column(Text)         # JSON list of competitor names
    matrix_json = Column(Text)         # Full structured evaluation matrix
    summary_verdict = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
```

---

## 4. API & Orchestrator Integration (`app/main.py`)

Expose endpoints to fetch the latest matrix or trigger a new evaluation:

```python
# In app/main.py:
from app.matrix_synthesizer import MatrixSynthesizer
from app.models import CompetitiveMatrixSnapshot

@app.get("/competitors/matrix/latest")
def get_latest_feature_matrix(db: Session = Depends(get_db)):
    snapshot = db.query(CompetitiveMatrixSnapshot)\
        .order_by(CompetitiveMatrixSnapshot.created_at.desc())\
        .first()
    
    if not snapshot:
        # Generate on-demand if no historical snapshot exists
        result = MatrixSynthesizer.generate_matrix()
        return result["data"]

    return json.loads(snapshot.matrix_json)

@app.post("/competitors/matrix/generate")
def generate_feature_matrix():
    """Manual trigger to regenerate matrix using latest ChromaDB state."""
    result = MatrixSynthesizer.generate_matrix()
    return result
```

Update `MasterOrchestrator` (`app/orchestrator.py`) to review the matrix weekly (every Monday) to identify feature gaps and automatically queue corresponding GitHub issues to `CodeGenerationAgent`.

---

## 5. Next.js Feature Matrix Table UI (`components/CompetitiveMatrixCard.tsx`)

This component renders an executive feature matrix with clear status indicators, hoverable technical citations, and category filters:

```tsx
"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, XCircle, Clock, TableProperties, Sparkles, RefreshCw } from "lucide-react";

interface CellEvaluation {
  status: "FULL" | "PARTIAL" | "NONE" | "PLANNED";
  note: string;
}

interface MatrixRow {
  feature_name: string;
  evaluations: Record<string, CellEvaluation>;
}

interface MatrixCategory {
  category: string;
  rows: MatrixRow[];
}

interface MatrixData {
  competitors: string[];
  summary_verdict: string;
  matrix: MatrixCategory[];
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function CompetitiveMatrixCard() {
  const [data, setData] = useState<MatrixData | null>(null);
  const [loading, setLoading] = useState(false);

  const loadMatrix = async () => {
    try {
      const res = await fetch(`${API_URL}/competitors/matrix/latest`);
      if (res.ok) setData(await res.json());
    } catch (err) {
      console.error("Failed to load feature matrix", err);
    }
  };

  const regenerateMatrix = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/competitors/matrix/generate`, { method: "POST" });
      if (res.ok) {
        const result = await res.json();
        setData(result.data);
      }
    } catch (err) {
      console.error("Failed to regenerate matrix", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMatrix();
  }, []);

  if (!data || !data.matrix) return null;

  const entities = ["Polsia", ...data.competitors];

  const renderStatus = (evaluation?: CellEvaluation) => {
    if (!evaluation) return <span className="text-zinc-600">-</span>;

    const { status, note } = evaluation;
    return (
      <div className="group relative flex items-center gap-1.5 cursor-pointer">
        {status === "FULL" && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
        {status === "PARTIAL" && <AlertCircle className="w-4 h-4 text-amber-400" />}
        {status === "NONE" && <XCircle className="w-4 h-4 text-zinc-600" />}
        {status === "PLANNED" && <Clock className="w-4 h-4 text-sky-400" />}

        <span className={`text-xs font-mono font-medium ${
          status === "FULL" ? "text-emerald-300" :
          status === "PARTIAL" ? "text-amber-300" :
          status === "PLANNED" ? "text-sky-300" : "text-zinc-500"
        }`}>
          {status}
        </span>

        {/* Hover Tooltip showing extracted ChromaDB justification */}
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-48 p-2 bg-zinc-900 border border-zinc-700 text-[11px] font-sans text-zinc-200 rounded-lg shadow-xl z-30">
          {note}
        </div>
      </div>
    );
  };

  return (
    <div className="border border-zinc-800 bg-zinc-900/60 backdrop-blur rounded-2xl p-6 mb-8">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-zinc-800 mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <TableProperties className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold font-mono text-zinc-100 uppercase tracking-wider">
              Autonomous Competitive Feature Matrix
            </h2>
            <p className="text-xs text-zinc-400 font-mono">
              Synthesized by Claude Code from indexed ChromaDB snapshots
            </p>
          </div>
        </div>

        <button
          onClick={regenerateMatrix}
          disabled={loading}
          className="text-xs font-mono text-zinc-400 hover:text-zinc-200 border border-zinc-800 hover:border-zinc-700 bg-zinc-900 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Regenerate Matrix
        </button>
      </div>

      {/* Strategic Executive Verdict Banner */}
      <div className="mb-6 p-4 rounded-xl bg-indigo-950/30 border border-indigo-500/20 flex items-start gap-2.5">
        <Sparkles className="w-4 h-4 text-indigo-400 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-zinc-300 leading-relaxed font-sans">
          <strong className="text-indigo-300 font-mono">Strategic Summary: </strong>
          {data.summary_verdict}
        </p>
      </div>

      {/* Responsive Comparison Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-zinc-800 text-xs font-mono text-zinc-400 uppercase">
              <th className="py-3 px-4 w-1/3">Capability</th>
              {entities.map((ent) => (
                <th key={ent} className={`py-3 px-4 ${ent === "Polsia" ? "text-indigo-400 font-bold" : "text-zinc-300"}`}>
                  {ent}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.matrix.map((category) => (
              <React.Fragment key={category.category}>
                {/* Category Header Row */}
                <tr className="bg-black/40">
                  <td colSpan={entities.length + 1} className="py-2.5 px-4 text-xs font-mono font-bold text-zinc-400 uppercase tracking-wider">
                    {category.category}
                  </td>
                </tr>

                {/* Feature Rows */}
                {category.rows.map((row) => (
                  <tr key={row.feature_name} className="border-b border-zinc-800/40 hover:bg-zinc-800/20 transition-colors">
                    <td className="py-3 px-4 text-xs text-zinc-300 font-medium">
                      {row.feature_name}
                    </td>
                    {entities.map((ent) => (
                      <td key={ent} className="py-3 px-4">
                        {renderStatus(row.evaluations[ent])}
                      </td>
                    ))}
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

---

## 6. How the Feedback Loop Closes

1. **Snapshots Accumulate:** As `CompetitorResearchAgent` scans competitor URLs every 12 hours, new diffs are appended to the ChromaDB `competitor_intelligence` collection.
2. **Matrix Generation:** Calling `/competitors/matrix/generate` runs `CompetitiveMatrixRetriever`, isolating grounded excerpts for each feature dimension.
3. **Claude Code Evaluates Parity:** Headless Claude Code compares the excerpts and returns unambiguous `FULL`, `PARTIAL`, or `NONE` statuses, complete with source citations.
4. **CEO Action:** When the Master Orchestrator runs on Monday morning, it inspects features where Polsia is `NONE` while a rival is `FULL`. It then schedules an autonomous research and development task directly to `CodeGenerationAgent` to close the feature gap.
