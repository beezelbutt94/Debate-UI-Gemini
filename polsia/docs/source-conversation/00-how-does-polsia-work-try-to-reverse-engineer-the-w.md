# How does polsia work. Try to reverse engineer the workflow, logic and architecture

> Status in this repo: Reference (architecture overview)

**Polsia** (named as an inversion of "AI Slop" by founder Ben Cera) is an autonomous multi-agent operating system designed to run digital businesses with zero human employees. Unlike conversational copilot assistants that wait for user prompts, Polsia runs an asynchronous, scheduled swarm of specialized agents that proactively plan, write code, run marketing, handle support, and reconcile financials.

---

## 1. High-Level Architecture & Tech Stack

Polsia is structured as a distributed task processing pipeline paired with a headless CLI runner and dual persistence layers:

```
                     ┌───────────────────────────┐
                     │   Next.js 14 Dashboard    │ (TypeScript)
                     └─────────────▲─────────────┘
                                   │ WebSocket / REST
                     ┌─────────────▼─────────────┐
                     │    FastAPI Application    │ (Python 3.11 Async)
                     └───────┬───────────▲───────┘
            Task Enqueue     │           │ Redis Pub/Sub (Live Event Stream)
                             ▼           │
                     ┌───────────────────────────┐
                     │   Redis Message Broker    │
                     └─────────────┬─────────────┘
                                   │
              ┌────────────────────┴────────────────────┐
              ▼                                         ▼
   ┌───────────────────────┐                 ┌───────────────────────┐
   │ Celery Beat Scheduler │                 │     Celery Worker     │
   │  (Staggered Cron)     │                 │   (BasePolsiaAgent)   │
   └───────────────────────┘                 └───────────┬───────────┘
                                                         │
                               Subprocess Execution      ▼
                                             ┌───────────────────────┐
                                             │ Claude Code CLI       │
                                             │ (claude -p --format)  │
                                             └───────────┬───────────┘
                                                         │
                     ┌───────────────────────────────────┴───────────────────────────────────┐
                     ▼                                   ▼                                   ▼
          ┌─────────────────────┐             ┌─────────────────────┐             ┌─────────────────────┐
          │     PostgreSQL      │             │      ChromaDB       │             │    External APIs    │
          │ (SQLAlchemy Async)  │             │  (Semantic Memory)  │             │ (Stripe, GitHub,    │
          │ Relational State    │             │   RAG & History     │             │  SendGrid, X, Ads)  │
          └─────────────────────┘             └─────────────────────┘             └─────────────────────┘
```

### Technical Components
* **API & Real-time Layer:** **FastAPI (Python 3.11)** exposes the REST API and WebSocket connections. State updates are pushed to a Redis pub/sub channel, enabling live dashboards (such as Polsia's public `/live` feed) to stream agent actions in real time.
* **Task Queue & Scheduler:** **Celery + Redis** handles distributed task dispatch. Periodic agent runs are governed by **Celery Beat** on predefined staggered schedules.
* **Dual Persistence Layer:**
  * **PostgreSQL (via SQLAlchemy async ORM):** Stores company metadata, task logs, schedules, integration tokens, and financial records.
  * **ChromaDB:** Functions as persistent semantic memory. Agent insights, resolved support tickets, and code summaries are dual-written to ChromaDB to maintain long-term context across runs.
* **Model Execution Mechanism:** Rather than standard direct HTTP calls to Anthropic's REST API, the core `base_agent.py` spawns a headless **Claude Code CLI** subprocess (`claude -p "<prompt>" --output-format json`). This allows agents to natively leverage Claude Code's file manipulation, context management, and terminal sandboxing without separate custom tool-execution wrappers.

---

## 2. The Multi-Agent Swarm

The system divides operational responsibilities into specialized agents managed via an agent factory (`crew_factory.py`) and scheduled via Celery Beat:

| Agent | Cadence | Execution Logic & External Tools |
| :--- | :--- | :--- |
| **Orchestrator** | 06:00 & 20:00 | Acts as the CEO. Generates the morning operational plan, reviews metrics from the previous cycle, sets agent priorities, and compiles the evening summary. |
| **Business Planning** | Daily | Evaluates company OKRs, burn rate, and unit economics to recommend strategic product and pricing pivots. |
| **Competitor Research**| Daily | Uses search APIs (e.g., Tavily) to scrape competitor landing pages, monitor feature releases, and log market shifts into ChromaDB. |
| **Social Media** | Every 2 hours | Scans trending niche topics, drafts short-form content aligned with `soul.md`, and auto-publishes to Twitter/X. |
| **Email Outreach** | Every 3 hours | Identifies B2B prospects, constructs personalized email sequences, and dispatches outbound campaigns via SendGrid. |
| **Customer Support** | Every 3 hours | Connects via IMAP to the inbox, queries ChromaDB documentation for answers, drafts resolutions, and sends replies or flags escalations. |
| **Ads Management** | Every 6 hours | Queries Meta Ads and Google Ads APIs, evaluates ROAS/CAC, reallocates budgets, and pauses low-performing creative assets. |
| **Finance** | Every 6 hours | Pulls Stripe transactions, calculates net MRR/churn, monitors ad spend vs. revenue, and updates the financial dashboard. |
| **Code Generation** | On-Demand / Queued | Inspects backlog issues/feature specs, writes code patches, executes tests, and opens GitHub Pull Requests. |

---

## 3. Core Operational Logic & Control Loops

### Dual-Pass "Generator vs. Verifier" Pattern
To prevent generic outputs or hallucinated actions ("AI slop"), Polsia enforces a two-pass actor-critic architecture:
1. **The Generator Pass:** The primary agent generates the artifact (e.g., marketing copy, cold outreach, PR code, or ad configuration).
2. **The Verifier Pass:** A second model instance acts as a senior reviewer. It audits the output against explicit schema, style guides, and functional constraints (e.g., verifying that code builds or that an ad adheres to budget limits). If constraints fail, specific feedback is routed back to the generator for regeneration.

### Context Governance: `soul.md` and `agents.md`
Agent behavior is governed by structured Markdown configuration files injected into execution contexts:
* **`soul.md` (Brand & Voice Identity):** Dictates company persona, phrasing preferences, stylistic boundaries, and explicit negatives (e.g., "never use buzzwords," "prioritize concise, punchy value propositions").
* **`agents.md` (Organizational Hierarchy & Guardrails):** Defines reporting structures and hard financial/operational ceilings (e.g., maximum daily ad budget, permissions on auto-merging PRs, restrictions on master payment keys).

---

## 4. End-to-End Execution Flow

1. **Trigger:** Celery Beat fires a scheduled interval (e.g., the 2-hour social media run or 6-hour ad optimization).
2. **Context Assembly:** The worker retrieves:
   * Company profiles and API credentials from PostgreSQL.
   * Vector-embedded company history and knowledge from ChromaDB.
   * Tone constraints from `soul.md` and policy limits from `agents.md`.
3. **Headless Invocation:** `call_claude()` spawns the Claude Code CLI in headless mode with the synthesized prompt.
4. **Verification Loop:** Output is parsed as JSON and passed to the verification logic.
5. **Action Dispatch:** If verified and not in `SANDBOX_MODE`, the task calls external APIs (GitHub PR creation, Stripe sync, SendGrid dispatch, X tweet).
6. **Persistence & Broadcast:**
   * Execution metadata is committed to PostgreSQL.
   * Artifacts and learned context are embedded into ChromaDB.
   * An event payload is published to Redis Pub/Sub, updating the real-time Next.js frontend over WebSockets.

---

## 5. Architectural Trade-offs & Failure Modes

* **Headless Subprocess Overhead:** Using `claude -p` via CLI subprocesses avoids SDK complexity and manages file environments easily, but introduces system-level process-spawning overhead compared to pooled HTTP connection clients.
* **Phantom Completions:** In high-autonomy pipelines without strict human-in-the-loop gates, LLM agents occasionally mark tasks as "complete" in task logs when an external dependency (such as a deployment webhook) silently fails or times out.
* **Unsupervised Outbound Risk:** Running fully autonomous outreach (email sequences, social posts, press contacts) without manual review gates leaves no buffer against reputational slip-ups or misaligned commitments.
