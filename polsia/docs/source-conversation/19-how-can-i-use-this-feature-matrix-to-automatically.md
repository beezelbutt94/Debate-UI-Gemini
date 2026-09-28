# How can I use this feature matrix to automatically generate SEO-optimized Markdown comparison pages like 'Polsia vs DevAgent'?

> Status in this repo: Deferred: SEO comparison pages

To automatically turn your competitive feature matrix into SEO-optimized comparison pages, implement a **Programmatic SEO (pSEO) pipeline**. Whenever the matrix updates, an automated task filters the latest evaluations for a target rival, generates a structured MDX/Markdown file with search-intent frontmatter and FAQ schema, and writes it directly into your Next.js content directory.

---

### Pipeline Architecture

```
 ┌──────────────────────────────────────┐
 │ CompetitiveMatrixSnapshot (Database) │
 └──────────────────┬───────────────────┘
                    │ Triggers when matrix updates or competitor diff detected
                    ▼
 ┌──────────────────────────────────────┐
 │ SEO Comparison Generator Task        │
 │  1. Extracts (Polsia vs Rival) rows  │
 │  2. Fetches competitor pricing/diffs │
 │  3. Prompts Claude Code (pSEO rules) │
 └──────────────────┬───────────────────┘
                    │ Generates frontmatter + MDX + JSON-LD
                    ▼
 ┌──────────────────────────────────────┐
 │ File System / Static Content Store   │
 │ content/comparisons/polsia-vs-{slug} │
 └──────────────────┬───────────────────┘
                    │
                    ▼
 ┌──────────────────────────────────────┐
 │ Next.js Dynamic Route (SSG)          │
 │ app/vs/[competitor]/page.tsx         │
 │ (Pre-rendered via generateStaticParams)
 └──────────────────────────────────────┘
```

---

## 1. The SEO Comparison Page Generator (`app/seo_generator.py`)

This module pulls the latest matrix snapshot, isolates the target competitor against Polsia, and prompts Claude Code to generate an MDX document adhering to search-intent criteria (high-intent search terms like *"alternative to X"*, *"X vs Y pricing"*, and *"why switch"*).

```python
import os
import json
import re
from datetime import datetime
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from app.runner import run_claude_headless
from app.config import settings
from app.db import SessionLocal
from app.models import CompetitiveMatrixSnapshot, MarketIntelligence

CONTENT_OUTPUT_DIR = os.path.abspath("./frontend/content/comparisons")
os.makedirs(CONTENT_OUTPUT_DIR, exist_ok=True)

class SEOComparisonGenerator:
    @classmethod
    def generate_page_for_competitor(cls, competitor_name: str) -> str:
        """
        Generates an SEO-optimized MDX comparison page against a specific competitor
        and writes it to frontend/content/comparisons/polsia-vs-{slug}.mdx.
        """
        db: Session = SessionLocal()

        # 1. Fetch latest matrix
        snapshot = db.query(CompetitiveMatrixSnapshot)\
            .order_by(CompetitiveMatrixSnapshot.created_at.desc())\
            .first()

        if not snapshot:
            db.close()
            raise ValueError("No competitive matrix snapshot available to generate SEO pages.")

        matrix_data = json.loads(snapshot.matrix_json)
        
        # 2. Extract only rows relevant to Polsia vs this competitor
        isolated_matrix = []
        for category in matrix_data.get("matrix", []):
            category_rows = []
            for row in category.get("rows", []):
                polsia_eval = row.get("evaluations", {}).get("Polsia", {"status": "NONE", "note": ""})
                comp_eval = row.get("evaluations", {}).get(competitor_name, {"status": "NONE", "note": ""})
                
                category_rows.append({
                    "feature": row["feature_name"],
                    "polsia": polsia_eval,
                    "competitor": comp_eval
                })
            isolated_matrix.append({
                "category": category["category"],
                "comparisons": category_rows
            })

        # 3. Pull latest intelligence/pricing shifts for this competitor
        recent_intel = db.query(MarketIntelligence)\
            .filter(MarketIntelligence.competitor_name == competitor_name)\
            .order_by(MarketIntelligence.created_at.desc())\
            .limit(3)\
            .all()

        intel_summary = "\n".join([f"- [{i.change_type}] {i.headline}: {i.summary}" for i in recent_intel])
        db.close()

        # 4. Generate structured MDX via Claude Code
        slug = re.sub(r"[^a-z0-9]+", "-", competitor_name.lower()).strip("-")
        current_year = datetime.utcnow().year

        prompt = (
            f"You are a principal technical marketer and SEO strategist.\n"
            f"Write an exhaustive, authoritative, high-intent B2B comparison article:\n"
            f"TARGET KEYWORDS: 'Polsia vs {competitor_name}', 'Best {competitor_name} alternative', '{competitor_name} pricing vs Polsia'\n\n"
            f"EVALUATION DATA (Grounded Evidence):\n{json.dumps(isolated_matrix, indent=2)}\n\n"
            f"RECENT REVELANT MARKET INTEL:\n{intel_summary or 'Standard baseline parity.'}\n\n"
            "SEO & EDITORIAL SPECIFICATIONS:\n"
            "1. Format: Complete MDX document with YAML frontmatter.\n"
            "2. Tone: Objective, technical, and grounded. Emphasize Polsia's verifiable advantages (e.g., gVisor microVM sandbox, zero-human autonomous dispatch, self-healing git loops) without marketing fluff.\n"
            "3. Required Sections:\n"
            "   - YAML frontmatter with title, metaDescription, competitor, date, and schemaJson (SoftwareApplication + FAQPage JSON-LD).\n"
            "   - TL;DR Executive Verdict & Quick Comparison Table.\n"
            "   - Deep Dives by category (Architecture & Security, Engineering Workflow, Autonomy).\n"
            "   - When to choose Polsia vs When to choose {competitor_name}.\n"
            "   - Detailed FAQ addressing migration and pricing.\n"
            "Return the raw MDX text directly."
        )

        res = run_claude_headless(
            prompt=prompt,
            system_prompt="Output raw MDX only. Do not wrap in extra markdown fences."
        )

        mdx_content = res.get("result", "")
        # Clean any accidental wrapping
        if mdx_content.startswith("```markdown"):
            mdx_content = mdx_content[len("```markdown"):].strip()
        if mdx_content.startswith("```mdx"):
            mdx_content = mdx_content[len("```mdx"):].strip()
        if mdx_content.endswith("```"):
            mdx_content = mdx_content[:-3].strip()

        file_path = os.path.join(CONTENT_OUTPUT_DIR, f"polsia-vs-{slug}.mdx")
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(mdx_content)

        return file_path
```

---

## 2. Sample Generated MDX Output (`content/comparisons/polsia-vs-devagent-ai.mdx`)

The generator writes a self-contained, pre-formatted file with JSON-LD schema ready for search engine indexing:

```markdown
---
title: "Polsia vs DevAgent.ai (2026 Comparison): Which Autonomous Platform Wins?"
metaTitle: "Polsia vs DevAgent.ai: In-Depth Architecture & Feature Breakdown"
metaDescription: "Comparing Polsia and DevAgent.ai across microVM sandboxing, autonomous GitHub PR generation, Bayesian ad allocation, and zero-human operations."
competitor: "DevAgent.ai"
slug: "polsia-vs-devagent-ai"
lastUpdated: "2026-09-19"
faqSchema:
  - question: "What is the primary architectural difference between Polsia and DevAgent.ai?"
    answer: "Polsia runs all untrusted code execution within ephemeral gVisor user-space sandboxes with strict SNI mTLS egress proxying, whereas DevAgent.ai executes directly within host containers."
  - question: "Can Polsia self-heal customer-reported bugs?"
    answer: "Yes. Polsia's support agent automatically diagnoses bug reports, triggers the CodeGenerationAgent to open an automated GitHub PR, and tests the fix before human review."
---

# Polsia vs DevAgent.ai: Autonomous Software Engine Comparison

Engineering teams evaluating autonomous software platforms typically weigh two architectures: copilot workspaces that require human steering, versus closed-loop autonomous swarms.

This comparison breaks down how **Polsia** and **DevAgent.ai** differ across system security, autonomous git workflows, marketing automation, and total operational cost.

## Executive Summary: Quick Comparison

| Capability | Polsia | DevAgent.ai |
| :--- | :--- | :--- |
| **Execution Sandboxing** | **Full** (gVisor `runsc` + mTLS) | **None** (Host container runtime) |
| **Network Egress Guardrails** | **Full** (L7 SNI Egress Proxy + mTLS) | **Partial** (Basic IP whitelisting) |
| **Bug-to-PR Self-Healing** | **Full** (Support ticket -> Tested PR) | **Partial** (Slack alerts only) |
| **Autonomous Growth Operations**| **Full** (Bayesian MAB ad budgeting) | **None** (Requires manual marketing) |
| **Autonomous Model** | **Zero-Human** (Celery Beat Orchestrator) | **Human-in-the-Loop Assist** |

## Architectural Deep Dive

### 1. Hardware & Syscall Sandboxing
Polsia treats all agent tool execution as hostile. Claude Code runs inside an ephemeral **gVisor** sandbox container, intercepting Linux system calls at the user-space level. Network egress is strictly isolated to internal networks with mTLS attestation.

In contrast, DevAgent.ai runs tools directly on containerized runner pods without user-space kernel interception, leaving systems susceptible to container escape vulnerabilities when auditing third-party code.

### 2. Autonomous Git & Self-Healing
While DevAgent.ai focuses on chat-based code assistance, Polsia features an automated customer support loop:
1. Inbound bug tickets are evaluated against indexed ChromaDB technical docs.
2. If confirmed as reproducible, the `CustomerSupportAgent` dispatches tasks directly to the `CodeGenerationAgent`.
3. Claude Code clones the repo in isolation, writes tests, commits to an ephemeral branch, and opens a GitHub Pull Request.

## When to Choose Which Platform

### Choose Polsia if:
* You require fully unattended operations with hard safety guardrails.
* You need comprehensive security isolation (gVisor microVMs and restricted network egress) for proprietary codebases.
* You want continuous growth operations (Bayesian ad allocation and creative generation) managed alongside software development.

### Choose DevAgent.ai if:
* You prefer an interactive IDE copilot experience where an engineer reviews code line-by-line before commit.
* Your workflow is focused purely on conversational pair programming rather than scheduled operations.
```

---

## 3. Celery Task Fan-Out (`app/tasks.py`)

Hook generation into the Celery task runner. Whenever a competitive scan or matrix regeneration finishes, pages for all tracked rivals are updated:

```python
# In app/tasks.py:
from app.seo_generator import SEOComparisonGenerator
from app.models import CompetitorTarget

@celery_app.task
def generate_all_seo_comparison_pages():
    """Iterates through all tracked competitors and regenerates their SEO MDX pages."""
    db = SessionLocal()
    targets = db.query(CompetitorTarget.name).distinct().all()
    competitors = [t[0] for t in targets] if targets else ["DevAgent.ai"]
    db.close()

    generated_files = []
    for comp in competitors:
        try:
            path = SEOComparisonGenerator.generate_page_for_competitor(comp)
            generated_files.append(path)
        except Exception as e:
            print(f"[SEO Generator] Failed for {comp}: {e}")

    return {"status": "completed", "files": generated_files}
```

Trigger this task automatically inside `MatrixSynthesizer.generate_matrix()` or on-demand via a dedicated FastAPI endpoint:

```python
# In app/main.py:
from app.tasks import generate_all_seo_comparison_pages

@app.post("/seo/regenerate-comparisons")
def trigger_seo_regeneration():
    task = generate_all_seo_comparison_pages.delay()
    return {"status": "enqueued", "task_id": task.id}
```

---

## 4. Next.js Dynamic Routing & SSG Renderer (`app/vs/[competitor]/page.tsx`)

This Next.js 14 page automatically pre-renders all generated MDX pages at build time (`generateStaticParams`), injects Google-compliant FAQ and SoftwareApplication JSON-LD schema, and displays an updated comparison:

```tsx
import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { notFound } from "next/navigation";
import { Metadata } from "next";

const COMPARISONS_DIR = path.join(process.cwd(), "content/comparisons");

interface PageProps {
  params: {
    competitor: string;
  };
}

// 1. Static site generation: pre-build all comparisons found on disk
export async function generateStaticParams() {
  if (!fs.existsSync(COMPARISONS_DIR)) return [];
  const files = fs.readdirSync(COMPARISONS_DIR);

  return files
    .filter((f) => f.endsWith(".mdx") || f.endsWith(".md"))
    .map((file) => ({
      competitor: file.replace(/^polsia-vs-/, "").replace(/\.mdx?$/, ""),
    }));
}

// 2. Dynamic SEO Metadata
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const filePath = path.join(COMPARISONS_DIR, `polsia-vs-${params.competitor}.mdx`);
  if (!fs.existsSync(filePath)) return {};

  const fileContents = fs.readFileSync(filePath, "utf8");
  const { data } = matter(fileContents);

  return {
    title: data.metaTitle || data.title,
    description: data.metaDescription,
    alternates: {
      canonical: `[https://polsia.ai/vs/$](https://polsia.ai/vs/$){params.competitor}`,
    },
    openGraph: {
      title: data.title,
      description: data.metaDescription,
      url: `[https://polsia.ai/vs/$](https://polsia.ai/vs/$){params.competitor}`,
      type: "article",
    },
  };
}

// 3. Page Component with Structured Data Injection
export default async function ComparisonPage({ params }: PageProps) {
  const filePath = path.join(COMPARISONS_DIR, `polsia-vs-${params.competitor}.mdx`);
  if (!fs.existsSync(filePath)) notFound();

  const fileContents = fs.readFileSync(filePath, "utf8");
  const { data, content } = matter(fileContents);

  // Generate FAQ JSON-LD Schema
  const faqJsonLd = data.faqSchema
    ? {
        "@context": "[https://schema.org](https://schema.org)",
        "@type": "FAQPage",
        mainEntity: data.faqSchema.map((item: { question: string; answer: string }) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.answer,
          },
        })),
      }
    : null;

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 py-16 px-6">
      {faqJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      )}

      <article className="max-w-3xl mx-auto prose prose-invert prose-indigo prose-headings:font-mono prose-table:border-zinc-800">
        <div className="flex items-center gap-2 text-xs font-mono text-indigo-400 mb-6 uppercase tracking-wider">
          <span>Official Benchmark</span>
          <span>•</span>
          <span>Updated {data.lastUpdated}</span>
        </div>

        {/* Render markdown body using your preferred parser (e.g., next-mdx-remote) */}
        <div className="whitespace-pre-wrap leading-relaxed text-zinc-300">
          {content}
        </div>
      </article>
    </main>
  );
}
```

---

## 5. Automated Operational Workflow

1. **Competitor Scan Executes (04:00 UTC):** `CompetitorResearchAgent` detects that `DevAgent.ai` added a new pricing plan or feature.
2. **Matrix Synthesizer Runs (04:30 UTC):** `MatrixSynthesizer` updates the feature status and justifications across both internal docs and competitor diffs in ChromaDB.
3. **SEO Generator Triggers (05:00 UTC):** `SEOComparisonGenerator` creates an updated `polsia-vs-devagent-ai.mdx` reflecting recent changes, adjusting the comparison table and FAQ schema.
4. **Static Regeneration & Deployment:** Next.js rebuilds the `/vs/devagent-ai` static route or revalidates via Incremental Static Regeneration (ISR), providing up-to-date comparison pages for search engines.
