# Polsia clone: an autonomous company-operations swarm

An open-source take on [Polsia](https://polsia.com)'s idea: a swarm of agents that runs the
operational side of a software business on a schedule (engineering fixes, support, outreach,
ads, finance, SRE) while a human approves anything irreversible. Built from the design in
[`docs/source-conversation/`](docs/source-conversation/README.md).

- **Backend** (`backend/`): FastAPI, Celery + Redis, SQLAlchemy (SQLite or Postgres). Every
  model call goes through the headless **Claude Code CLI** (`claude -p --output-format json`).
- **Frontend** (`frontend/`): Next.js 16 command center with a live WebSocket feed, approval
  queue, spend tracking and domain panels.

It runs end to end with **zero credentials**: `LLM_MODE=simulated` gives each agent a
deterministic, schema-valid decision, and `SANDBOX_MODE=true` turns every external side effect
(PRs, emails, posts, ad budgets) into a recorded simulation.

## How it works

```
 Celery beat ──┐                       ┌──────────── Next.js command center
 (schedule)    │                       │   live feed · approvals · spend · panels
               ▼                       │            ▲ WebSocket /ws/live
 webhooks ──► FastAPI ──enqueue──► Celery worker    │
 (Stripe,      │                       │            │
  Cal.com,     │                  Agent.run()       │
  SendGrid,    │     recall ─► generate ─► verify ─► gate ──► dispatch ──► adapters
  Sentry)      │    (memory)  (claude -p) (claude -p)  │                   (GitHub, SendGrid,
               │                                       ▼                    X, Meta Ads)
               └──────────── Postgres ◄─────── ActionApproval (PENDING) ◄── human approves
                                   events ──► Redis pub/sub ──► API relay ──► browsers
```

Every agent run follows the same loop (`backend/app/agents.py`):

1. **Recall**: pull relevant notes from the agent's earlier runs.
2. **Generate**: Claude Code proposes one decision: `{thought, action_type, payload, summary}`.
3. **Check**: the action must be on the agent's allow-list and its payload must validate
   against a Pydantic schema. A separate **verifier pass** then audits the proposal against
   [`soul.md`](backend/soul.md) (no invented facts, no hype, within spend limits).
   A rejected proposal gets one retry with the verifier's feedback, then it's dropped.
4. **Gate**: high-stakes actions become a pending `ActionApproval`; approving it in the
   dashboard dispatches the action. Resolution is an atomic claim, so a double click can't
   execute twice.
5. **Budget**: before every model call, the agent's and the swarm's spend for today is checked
   against `DAILY_AGENT_BUDGET_USD` / `DAILY_GLOBAL_BUDGET_USD`. Cost comes from the CLI's own
   `total_cost_usd`, with a per-model price table as fallback.

### Agents and actions

| Agent | Does | Action (gate) |
|---|---|---|
| `MasterOrchestrator` | Reads 24h telemetry at 06:00 UTC, sets the day's focus, delegates up to 5 tasks to real agents | none |
| `CodeGenerationAgent` | Turns bugs into PRs: clones the repo, lets Claude Code make and test the change, pushes, opens a PR | `CREATE_PR` (approval) |
| `SupportAgent` | Answers tickets from `backend/knowledge/*.md`; real bugs become a `CREATE_PR` approval against `DEFAULT_REPO` | none |
| `OutreachAgent` | Writes first-touch emails; the send path refuses bounced/unsubscribed prospects and paused campaigns | `SEND_EMAIL` (approval) |
| `SocialMediaAgent` | Build-in-public threads (≤280 chars per post) | `POST_THREAD` (approval) |
| `AdsAgent` | Reallocates the daily ad budget with Thompson sampling over log-ROAS posteriors, 5% exploration floor per campaign | `UPDATE_AD_BUDGETS` (approval, capped at `ADS_DAILY_BUDGET_USD`) |
| `FinanceAgent` | Audits Stripe revenue, churn and failed payments | none |
| `CompetitorResearchAgent` | Diffs tracked competitor pages every 6h and grades the threat | none |
| `SalesBriefingAgent` | Writes a briefing ~1h before each Cal.com demo from the prospect's public website | none |
| `SRESentinel` | Correlates Sentry alerts with the deploy that caused them and files one revert per bad deploy | `REVERT_COMMIT` (approval, or immediate with `AUTO_REVERT=true`) |

## Run it

### Locally, no Docker (simulated, inline tasks)

```bash
cd backend
python -m venv .venv && . .venv/bin/activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload          # http://localhost:8000/docs

cd ../frontend
npm install
npm run dev                            # http://localhost:3000
```

With `REDIS_URL` unset, Celery tasks run inline inside the API process and the live feed
stays in-process, so this needs nothing else running.

### Full stack with Docker Compose

```bash
cp .env.example .env
docker compose up --build              # Postgres, Redis, API, worker, beat, web
```

### Tests

```bash
cd backend && ruff check . && pytest   # 39 tests, all hermetic
cd frontend && npm run lint && npm run typecheck && npm run build
```

CI runs both on every PR that touches `polsia/` (`.github/workflows/polsia.yml`).

## Going live, one switch at a time

1. **Set `OPERATOR_TOKEN`** before the API is reachable by anyone else. Every operator
   endpoint and the WebSocket then require it. The dashboard sends
   `NEXT_PUBLIC_OPERATOR_TOKEN`, which is baked into the JS bundle: only do that for a
   dashboard on a private network, or put real auth in front of it.
2. **`LLM_MODE=claude_code`** with `ANTHROPIC_API_KEY`. Agents now reason with Claude Code;
   side effects are still sandboxed. Watch `/spend` and the verifier's verdicts for a while.
3. **Configure webhook secrets.** With `SANDBOX_MODE=false`, any webhook whose secret is unset
   is refused with 503 rather than accepted unsigned.
4. **`SANDBOX_MODE=false`** with `GITHUB_TOKEN`, `SENDGRID_API_KEY` and the rest. Approved
   actions now really happen.

### Webhooks

| Provider | Endpoint | Verification |
|---|---|---|
| Stripe | `POST /webhooks/stripe` | `Stripe-Signature` HMAC with 5-minute tolerance; idempotent by event id |
| Cal.com | `POST /webhooks/calcom` | `X-Cal-Signature-256` HMAC; created / rescheduled / cancelled |
| SendGrid | `POST /webhooks/sendgrid` | Signed Event Webhook (ECDSA P-256); a campaign pauses when bounces exceed 2% over ≥50 sends in 7 days |
| Sentry | `POST /webhooks/sentry` | `Sentry-Hook-Signature` HMAC; correlates by `release` tag, else the latest deploy in the last 2h |

### CI integration: deploy registry and canary gate

```bash
# After each deploy, so incidents can be traced to a commit:
curl -X POST "$POLSIA_URL/deployments" -H "X-Deployment-Secret: $SECRET" \
  -H 'Content-Type: application/json' \
  -d "{\"repo\":\"$GITHUB_REPOSITORY\",\"commit_sha\":\"$GITHUB_SHA\",\"environment\":\"production\"}"

# Before promoting staging -> production: start a soak, then poll until PASSED or FAILED.
ID=$(curl -s -X POST "$POLSIA_URL/canary" -H "X-Deployment-Secret: $SECRET" \
  -H 'Content-Type: application/json' \
  -d "{\"repo\":\"$GITHUB_REPOSITORY\",\"commit_sha\":\"$GITHUB_SHA\",\"duration_minutes\":15}" | jq -r .id)
until s=$(curl -s "$POLSIA_URL/canary/$ID" -H "X-Deployment-Secret: $SECRET" | jq -r .status); [ "$s" != MONITORING ]; do sleep 30; done
[ "$s" = PASSED ]
```

The canary counts errors for that release through the Sentry API when `SENTRY_AUTH_TOKEN` is
set, otherwise from incidents Polsia recorded, and fails fast as soon as the error budget is spent.

## What's deliberately not here yet

The source conversation also designed infrastructure hardening that this first cut leaves out.
Each design is in `docs/source-conversation/` for when it's needed:

- Per-run Firecracker/gVisor sandboxes for Claude Code (07), egress restricted to GitHub and
  Anthropic via eBPF or an Envoy SNI proxy with mTLS (08-11), log shipping (12-13).
- Helm chart, Terraform and Karpenter node pools (29-31).
- SEO comparison pages and Search Console tracking (18-21), GitHub App auto-merge for reverts (25).
- LinkedIn scraping for demo briefings (34): left out on purpose, as it violates LinkedIn's terms.
  Briefings use the prospect's public website only, fetched with private-network targets refused.

Until sandboxing lands, run workers on a machine that holds nothing but this project's
credentials. Claude Code only ever gets an explicit tool allow-list (never
`bypassPermissions`), and pure-reasoning calls get no tools at all.
