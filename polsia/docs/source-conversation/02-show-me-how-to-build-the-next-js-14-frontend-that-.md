# Show me how to build the Next.js 14 frontend that consumes the WebSocket live feed and renders agent execution cards.

> Status in this repo: Implemented: live feed hook, run cards, dispatch bar

Here is a complete blueprint for building the **Next.js 14 (App Router)** dashboard with TypeScript and Tailwind CSS. It connects to the FastAPI WebSocket feed (`/ws/live`), maintains a real-time reactive feed of agent runs, and allows manual dispatch of agent tasks.

---

### Project Structure

```text
frontend/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                  # Main dashboard entry
│   └── globals.css
├── components/
│   ├── AgentBadge.tsx            # Visual badge and colors per agent
│   ├── ConnectionIndicator.tsx   # Live / Reconnecting badge
│   ├── TaskCard.tsx              # Card rendering status, output, & critic audit
│   └── TaskTriggerModal.tsx      # Dispatch on-demand agent run
├── hooks/
│   └── useAgentFeed.ts           # WebSocket state & auto-reconnect hook
├── types/
│   └── agent.ts                  # Shared TypeScript interfaces
├── .env.local
└── tailwind.config.ts
```

---

### 1. Setup & Dependencies

Install the necessary icon package and class utility:

```bash
npx create-next-app@latest frontend --typescript --tailwind --app --eslint
cd frontend
npm install lucide-react clsx tailwind-merge
```

Add your backend endpoints to `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws/live
```

---

### 2. TypeScript Interfaces (`types/agent.ts`)

Define types matching the payloads broadcasted by Celery and Redis in the backend:

```typescript
export interface VerificationResult {
  approved: boolean;
  feedback: string;
}

export type TaskStatus = "running" | "completed" | "failed";

export interface AgentTask {
  taskId: string;
  agent: string;
  instruction: string;
  status: TaskStatus;
  output?: string;
  verification?: VerificationResult;
  timestamp: string;
}

export interface WsStartPayload {
  event: "TASK_START";
  task_id: string;
  agent: string;
  instruction: string;
}

export interface WsCompletePayload {
  event: "TASK_COMPLETE";
  task_id: string;
  result: {
    agent: string;
    task: string;
    output: string;
    verification: VerificationResult;
  };
}

export type WsMessage = WsStartPayload | WsCompletePayload;
```

---

### 3. WebSocket Auto-Reconnect Hook (`hooks/useAgentFeed.ts`)

This hook handles reconnection with exponential backoff, stores unique tasks, and transitions tasks from `running` to `completed`.

```typescript
"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { AgentTask, WsMessage } from "@/types/agent";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/ws/live";

export function useAgentFeed() {
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const backoffRef = useRef<number>(1000);

  const connect = useCallback(() => {
    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      setIsConnected(true);
      backoffRef.current = 1000; // Reset backoff delay on successful connection
    };

    ws.onmessage = (event) => {
      try {
        const data: WsMessage = jsonParseSafe(event.data);
        if (!data || !data.event) return;

        if (data.event === "TASK_START") {
          const newTask: AgentTask = {
            taskId: data.task_id,
            agent: data.agent,
            instruction: data.instruction,
            status: "running",
            timestamp: new Date().toLocaleTimeString(),
          };

          // Prepend new tasks to keep newest on top
          setTasks((prev) => [newTask, ...prev]);
        }

        if (data.event === "TASK_COMPLETE") {
          setTasks((prev) =>
            prev.map((t) => {
              if (t.taskId === data.task_id) {
                return {
                  ...t,
                  status: data.result.verification?.approved ? "completed" : "failed",
                  output: data.result.output,
                  verification: data.result.verification,
                };
              }
              return t;
            })
          );
        }
      } catch (err) {
        console.error("Failed to parse incoming WS message:", err);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      // Exponential backoff reconnect
      reconnectTimeoutRef.current = setTimeout(() => {
        backoffRef.current = Math.min(backoffRef.current * 1.5, 10000);
        connect();
      }, backoffRef.current);
    };

    ws.onerror = () => {
      ws.close();
    };

    return ws;
  }, []);

  useEffect(() => {
    const ws = connect();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      ws.close();
    };
  }, [connect]);

  return { tasks, isConnected };
}

function jsonParseSafe(str: string) {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}
```

---

### 4. Feed Components

#### Agent Identity Badge (`components/AgentBadge.tsx`)
```tsx
import { Bot, LineChart, Megaphone, Terminal } from "lucide-react";

interface Props {
  name: string;
}

export function AgentBadge({ name }: Props) {
  const getStyle = () => {
    switch (name) {
      case "SocialMediaAgent":
        return { color: "bg-sky-500/10 text-sky-400 border-sky-500/20", icon: Megaphone };
      case "FinanceAgent":
        return { color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", icon: LineChart };
      default:
        return { color: "bg-purple-500/10 text-purple-400 border-purple-500/20", icon: Bot };
    }
  };

  const { color, icon: Icon } = getStyle();

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono border ${color}`}>
      <Icon className="w-3.5 h-3.5" />
      <span>{name}</span>
    </div>
  );
}
```

#### Real-time Connection Indicator (`components/ConnectionIndicator.tsx`)
```tsx
export function ConnectionIndicator({ isConnected }: { isConnected: boolean }) {
  return (
    <div className="flex items-center gap-2 text-xs font-mono px-3 py-1.5 rounded-full border border-zinc-800 bg-zinc-900/60">
      <span
        className={`w-2 h-2 rounded-full ${
          isConnected ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
        }`}
      />
      <span className={isConnected ? "text-zinc-300" : "text-zinc-500"}>
        {isConnected ? "FEED LIVE" : "DISCONNECTED"}
      </span>
    </div>
  );
}
```

#### Agent Execution Card (`components/TaskCard.tsx`)
Displays the task prompt, running spinners, syntax-highlighted output, and verification results.

```tsx
"use client";

import { useState } from "react";
import { AgentTask } from "@/types/agent";
import { AgentBadge } from "./AgentBadge";
import { CheckCircle2, AlertTriangle, Loader2, ChevronDown, ChevronUp } from "lucide-react";

export function TaskCard({ task }: { task: AgentTask }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-zinc-800/80 bg-zinc-900/40 backdrop-blur rounded-xl p-5 hover:border-zinc-700 transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <AgentBadge name={task.agent} />
          <span className="text-xs font-mono text-zinc-500">{task.timestamp}</span>
        </div>

        {/* Status Pill */}
        <div className="flex items-center gap-2">
          {task.status === "running" && (
            <span className="inline-flex items-center gap-1.5 text-xs font-mono text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded border border-amber-400/20">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> RUNNING
            </span>
          )}
          {task.status === "completed" && (
            <span className="inline-flex items-center gap-1.5 text-xs font-mono text-emerald-400 bg-emerald-400/10 px-2.5 py-1 rounded border border-emerald-400/20">
              <CheckCircle2 className="w-3.5 h-3.5" /> VERIFIED
            </span>
          )}
          {task.status === "failed" && (
            <span className="inline-flex items-center gap-1.5 text-xs font-mono text-rose-400 bg-rose-400/10 px-2.5 py-1 rounded border border-rose-400/20">
              <AlertTriangle className="w-3.5 h-3.5" /> REJECTED
            </span>
          )}
        </div>
      </div>

      {/* Task Instruction */}
      <p className="text-zinc-200 text-sm font-medium mb-3">{task.instruction}</p>

      {/* Generated Artifact Block */}
      {task.output && (
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-zinc-400 mb-1.5 font-mono">
            <span>CLAUDE CODE ARTIFACT</span>
            <button
              onClick={() => setExpanded(!expanded)}
              className="hover:text-zinc-200 flex items-center gap-1"
            >
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {expanded ? "Collapse" : "Expand"}
            </button>
          </div>
          <pre
            className={`p-3 bg-black/50 border border-zinc-800 rounded-lg text-xs font-mono text-zinc-300 overflow-x-auto transition-all ${
              expanded ? "max-h-none" : "max-h-36 overflow-hidden"
            }`}
          >
            {task.output}
          </pre>
        </div>
      )}

      {/* Verifier Critic Feedback */}
      {task.verification && (
        <div className="mt-3 pt-3 border-t border-zinc-800/60 flex items-start gap-2">
          <span className="text-[10px] font-mono tracking-wider uppercase px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
            Verifier Note
          </span>
          <p className="text-xs text-zinc-400 italic">
            "{task.verification.feedback}"
          </p>
        </div>
      )}
    </div>
  );
}
```

#### Task Dispatch Form (`components/TaskTriggerModal.tsx`)
```tsx
"use client";

import { useState } from "react";
import { Play } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function TaskTriggerModal() {
  const [agent, setAgent] = useState("SocialMediaAgent");
  const [instruction, setInstruction] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instruction.trim()) return;

    setLoading(true);
    try {
      await fetch(`${API_URL}/agents/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent_name: agent, instruction }),
      });
      setInstruction("");
    } catch (err) {
      console.error("Failed to enqueue task", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 w-full max-w-2xl">
      <select
        value={agent}
        onChange={(e) => setAgent(e.target.value)}
        className="bg-zinc-900 border border-zinc-800 text-zinc-200 text-sm rounded-lg px-3 py-2 outline-none focus:border-zinc-700"
      >
        <option value="SocialMediaAgent">SocialMediaAgent</option>
        <option value="FinanceAgent">FinanceAgent</option>
      </select>

      <input
        type="text"
        placeholder="Enter directive for headless agent..."
        value={instruction}
        onChange={(e) => setInstruction(e.target.value)}
        className="flex-1 bg-zinc-900 border border-zinc-800 text-zinc-200 text-sm rounded-lg px-4 py-2 outline-none focus:border-zinc-700"
      />

      <button
        type="submit"
        disabled={loading}
        className="bg-zinc-100 hover:bg-white text-zinc-950 px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-1.5 transition-colors disabled:opacity-50"
      >
        <Play className="w-3.5 h-3.5 fill-current" />
        Run
      </button>
    </form>
  );
}
```

---

### 5. Main Dashboard View (`app/page.tsx`)

Combines the live feed, dispatch bar, and live connection status in a dark layout:

```tsx
"use client";

import { useAgentFeed } from "@/hooks/useAgentFeed";
import { TaskCard } from "@/components/TaskCard";
import { ConnectionIndicator } from "@/components/ConnectionIndicator";
import { TaskTriggerModal } from "@/components/TaskTriggerModal";
import { Activity } from "lucide-react";

export default function Dashboard() {
  const { tasks, isConnected } = useAgentFeed();

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 p-6 md:p-12">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Top Header */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <Activity className="w-6 h-6 text-zinc-400" />
              Autonomous Swarm Feed
            </h1>
            <p className="text-sm text-zinc-400 mt-1 font-mono">
              Live Claude Code CLI execution stream
            </p>
          </div>
          <ConnectionIndicator isConnected={isConnected} />
        </header>

        {/* Task Trigger Bar */}
        <div className="flex justify-center">
          <TaskTriggerModal />
        </div>

        {/* Task Stream Feed */}
        <div className="space-y-4">
          {tasks.length === 0 ? (
            <div className="text-center py-24 border border-dashed border-zinc-800/80 rounded-2xl">
              <p className="text-zinc-500 font-mono text-sm">
                No active runs detected. Dispatch an action or wait for Celery Beat.
              </p>
            </div>
          ) : (
            tasks.map((task) => <TaskCard key={task.taskId} task={task} />)
          )}
        </div>

      </div>
    </main>
  );
}
```

---

### 6. Enable CORS on FastAPI Backend

Ensure FastAPI allows cross-origin requests from `http://localhost:3000` so your manual trigger form can reach `POST /agents/run`. Add this to `app/main.py`:

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

### 7. Run the Setup

1. **Start backend infrastructure:**
   ```bash
   docker-compose up --build
   ```
2. **Start Next.js frontend:**
   ```bash
   npm run dev
   ```
3. Open `http://localhost:3000`. The green **FEED LIVE** indicator will turn on. Submitting a task via the input or waiting for a Celery Beat interval will cause tasks to stream into the feed with real-time status transitions.
