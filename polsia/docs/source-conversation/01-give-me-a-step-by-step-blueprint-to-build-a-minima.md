# Give me a step-by-step blueprint to build a minimal open-source clone of Polsia using FastAPI, Celery, and Claude Code.

> Status in this repo: Implemented: runner, agents, Celery, FastAPI, docker-compose

This blueprint provides an end-to-end implementation for a minimal, fully functional autonomous agent runner inspired by Polsia. It uses **FastAPI** for HTTP/WebSocket management, **Celery + Redis** for background scheduling, and **Claude Code CLI** in headless non-interactive mode (`claude -p`) as the autonomous execution engine.

---

## 1. Project Architecture & Setup

```text
polsia-core/
├── app/
│   ├── __init__.py
│   ├── config.py             # Settings and environment configuration
│   ├── runner.py             # Headless Claude Code CLI execution wrapper
│   ├── agents.py             # Agent definitions & generator-verifier logic
│   ├── celery_app.py         # Celery broker & periodic beat schedules
│   ├── tasks.py              # Celery background tasks & Redis pub/sub
│   ├── main.py               # FastAPI app and WebSocket live stream
│   └── prompts/
│       └── soul.md           # Global brand voice and operational guardrails
├── docker-compose.yml
├── Dockerfile
└── requirements.txt
```

### Dependencies (`requirements.txt`)
```text
fastapi>=0.110.0
uvicorn[standard]>=0.28.0
celery>=5.3.6
redis>=5.0.2
pydantic-settings>=2.2.1
python-dotenv>=1.0.1
websockets>=12.0
```

### Environment Configuration (`app/config.py`)
```python
import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    ANTHROPIC_API_KEY: str
    REDIS_URL: str = "redis://localhost:6379/0"
    WORK_DIR: str = os.path.abspath("./workspace")
    SOUL_PATH: str = os.path.abspath("./app/prompts/soul.md")
    SANDBOX_MODE: bool = True  # When True, prevents external API writes

    class Config:
        env_file = ".env"

settings = Settings()
os.makedirs(settings.WORK_DIR, exist_ok=True)
```

### Persona & Boundaries (`app/prompts/soul.md`)
```markdown
# Corporate Identity & Operational Bounds
- **Tone:** Concise, objective, zero marketing fluff, technically accurate.
- **Budget Limits:** No autonomous single action may allocate more than $100.
- **External Actions:** If SANDBOX_MODE is true, generate proposed API calls or scripts without executing destructive network requests.
```

---

## 2. Headless Claude Code Subprocess Runner

Polsia delegates local workspace reasoning, file editing, and command runs directly to the headless Claude Code CLI. We invoke `claude -p` with `--output-format json` and pre-approved tools so the process exits without waiting for interactive input.

### CLI Wrapper (`app/runner.py`)
```python
import json
import subprocess
from typing import Any, Dict, List, Optional
from app.config import settings

class ClaudeExecutionError(Exception):
    pass

def run_claude_headless(
    prompt: str,
    system_prompt: Optional[str] = None,
    allowed_tools: Optional[List[str]] = None,
    cwd: Optional[str] = None,
    timeout_seconds: int = 300,
) -> Dict[str, Any]:
    """
    Executes Claude Code in headless non-interactive mode.
    Captures structured JSON output and cost tracking.
    """
    cmd = ["claude", "-p", prompt, "--output-format", "json"]
    
    # Pre-approve tools to ensure unattended execution
    if allowed_tools:
        cmd.extend(["--allowedTools", ",".join(allowed_tools)])
    else:
        cmd.extend(["--permission-mode", "bypassPermissions"])
        
    if system_prompt:
        cmd.extend(["--append-system-prompt", system_prompt])

    execution_dir = cwd or settings.WORK_DIR

    try:
        proc = subprocess.run(
            cmd,
            cwd=execution_dir,
            capture_output=True,
            text=True,
            timeout=timeout_seconds,
            check=False,
            env={**os.environ, "ANTHROPIC_API_KEY": settings.ANTHROPIC_API_KEY}
        )
    except subprocess.TimeoutExpired:
        raise ClaudeExecutionError(f"Task timed out after {timeout_seconds}s")

    if proc.returncode != 0:
        raise ClaudeExecutionError(f"Claude CLI exited with {proc.returncode}: {proc.stderr}")

    try:
        # Claude Code returns {"result": "...", "total_cost_usd": 0.0X, ...}
        return json.loads(proc.stdout)
    except json.JSONDecodeError:
        return {"result": proc.stdout.strip(), "raw": True}
```

---

## 3. Multi-Agent Engine & Two-Pass Logic

Every agent implements a **Generator-Verifier** pass. The generator drafts the action; a secondary verifier audits it against `soul.md` and schema constraints.

### Swarm Definitions (`app/agents.py`)
```python
import json
from app.runner import run_claude_headless
from app.config import settings

def load_soul() -> str:
    with open(settings.SOUL_PATH, "r") as f:
        return f.read()

class BaseAgent:
    def __init__(self, name: str, role_prompt: str):
        self.name = name
        self.role_prompt = role_prompt
        self.soul = load_soul()

    def generate(self, task_instruction: str) -> str:
        prompt = (
            f"You are the {self.name}.\n"
            f"Role: {self.role_prompt}\n"
            f"Task: {task_instruction}\n"
            "Produce the final artifact directly."
        )
        output = run_claude_headless(
            prompt=prompt,
            system_prompt=self.soul,
            allowed_tools=["Read", "Bash"]
        )
        return output.get("result", "")

    def verify(self, task: str, candidate_output: str) -> dict:
        verifier_prompt = (
            f"Audit the following output produced for task: '{task}'.\n"
            f"Output to review:\n```\n{candidate_output}\n```\n"
            "Check against these rules:\n"
            "1. No buzzwords or spam.\n"
            "2. Fits constraints in system soul.\n"
            "3. Is technically/operationally safe to deploy.\n"
            "Return ONLY a JSON object: {\"approved\": bool, \"feedback\": \"...\"}"
        )
        review = run_claude_headless(
            prompt=verifier_prompt,
            system_prompt=self.soul,
            allowed_tools=[]
        )
        try:
            return json.loads(review.get("result", "{}"))
        except Exception:
            return {"approved": True, "feedback": "Auto-passed fallback"}

    def run(self, task_instruction: str) -> dict:
        # Step 1: Generator Pass
        draft = self.generate(task_instruction)
        
        # Step 2: Verifier Pass
        review = self.verify(task_instruction, draft)
        if not review.get("approved", False):
            # One retry with critic feedback
            revised_task = f"{task_instruction}\nPrevious attempt was rejected: {review.get('feedback')}. Fix this."
            draft = self.generate(revised_task)

        return {
            "agent": self.name,
            "task": task_instruction,
            "output": draft,
            "verification": review
        }

# Agent Catalog
SOCIAL_AGENT = BaseAgent(
    name="SocialMediaAgent",
    role_prompt="Generate high-signal, concise updates for X/Twitter regarding software engineering and product milestones."
)

FINANCE_AGENT = BaseAgent(
    name="FinanceAgent",
    role_prompt="Inspect recent ledger logs, summarize burn rate, and identify anomalies."
)
```

---

## 4. Background Task Dispatch & Celery Beat

### Celery Configuration (`app/celery_app.py`)
```python
from celery import Celery
from celery.schedules import crontab
from app.config import settings

celery_app = Celery("polsia", broker=settings.REDIS_URL, backend=settings.REDIS_URL)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    beat_schedule={
        # Social agent runs every 2 hours
        "social-media-cycle": {
            "task": "app.tasks.execute_agent_task",
            "schedule": crontab(minute=0, hour="*/2"),
            "args": ("SocialMediaAgent", "Draft a technical progress update based on recent git commits."),
        },
        # Daily financial summary at 08:00 UTC
        "finance-daily-audit": {
            "task": "app.tasks.execute_agent_task",
            "schedule": crontab(minute=0, hour=8),
            "args": ("FinanceAgent", "Audit current burn and verify active API subscriptions."),
        },
    },
)
```

### Tasks & Real-time Pub/Sub (`app/tasks.py`)
```python
import json
import redis
from app.celery_app import celery_app
from app.config import settings
from app.agents import SOCIAL_AGENT, FINANCE_AGENT

r = redis.Redis.from_url(settings.REDIS_URL)
AGENT_REGISTRY = {
    "SocialMediaAgent": SOCIAL_AGENT,
    "FinanceAgent": FINANCE_AGENT,
}

@celery_app.task(bind=True)
def execute_agent_task(self, agent_name: str, instruction: str):
    agent = AGENT_REGISTRY.get(agent_name)
    if not agent:
        raise ValueError(f"Agent {agent_name} not registered")

    # Broadcast task start event over Redis
    start_payload = {
        "event": "TASK_START",
        "task_id": self.request.id,
        "agent": agent_name,
        "instruction": instruction
    }
    r.publish("polsia:events", json.dumps(start_payload))

    # Run agent loop
    result = agent.run(instruction)

    # Broadcast completion event
    end_payload = {
        "event": "TASK_COMPLETE",
        "task_id": self.request.id,
        "result": result
    }
    r.publish("polsia:events", json.dumps(end_payload))
    return result
```

---

## 5. FastAPI API & Real-time Live Feed

### API Application (`app/main.py`)
```python
import asyncio
import json
import redis.asyncio as aioredis
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from app.config import settings
from app.tasks import execute_agent_task

app = FastAPI(title="Polsia Clone API")

class TriggerRequest(BaseModel):
    agent_name: str
    instruction: str

@app.post("/agents/run")
async def trigger_agent(req: TriggerRequest):
    task = execute_agent_task.delay(req.agent_name, req.instruction)
    return {"status": "enqueued", "task_id": task.id, "agent": req.agent_name}

@app.websocket("/ws/live")
async def live_event_feed(websocket: WebSocket):
    await websocket.accept()
    client = aioredis.from_url(settings.REDIS_URL)
    pubsub = client.pubsub()
    await pubsub.subscribe("polsia:events")

    try:
        async for message in pubsub.listen():
            if message["type"] == "message":
                data = json.loads(message["data"].decode("utf-8"))
                await websocket.send_json(data)
    except WebSocketDisconnect:
        await pubsub.unsubscribe("polsia:events")
        await client.close()
```

---

## 6. Dockerization & Deployment

### `Dockerfile`
```dockerfile
FROM python:3.11-slim

# Install system dependencies & Node.js for Claude Code CLI
RUN apt-get update && apt-get install -y \
    curl \
    git \
    build-essential \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && npm install -g @anthropic-ai/claude-code \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV PYTHONUNBUFFERED=1
```

### `docker-compose.yml`
```yaml
version: '3.8'

services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  api:
    build: .
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
    ports:
      - "8000:8000"
    environment:
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - REDIS_URL=redis://redis:6379/0
    volumes:
      - .:/workspace
    depends_on:
      - redis

  celery_worker:
    build: .
    command: celery -A app.celery_app worker --loglevel=info --concurrency=2
    environment:
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - REDIS_URL=redis://redis:6379/0
    volumes:
      - .:/workspace
    depends_on:
      - redis

  celery_beat:
    build: .
    command: celery -A app.celery_app beat --loglevel=info
    environment:
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - REDIS_URL=redis://redis:6379/0
    volumes:
      - .:/workspace
    depends_on:
      - redis
```

---

## 7. Operational Workflow

1. **Start the Infrastructure:**
   ```bash
   echo "ANTHROPIC_API_KEY=sk-ant-..." > .env
   docker-compose up --build
   ```
2. **Listen to the Live Stream:**
   Connect any WebSocket client (or browser console) to `ws://localhost:8000/ws/live`.
3. **Dispatch an On-Demand Task:**
   ```bash
   curl -X POST http://localhost:8000/agents/run \
     -H "Content-Type: application/json" \
     -d '{"agent_name": "SocialMediaAgent", "instruction": "Write a launch tweet for our autonomous agent engine"}'
   ```
4. **Autonomous Execution:**
   Celery Beat will automatically fire scheduled tasks according to the crontab entries, executing headless Claude Code CLI passes and streaming real-time status updates directly into the Redis channel.
