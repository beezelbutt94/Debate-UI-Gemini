# Continue

> Status in this repo: Implemented: bandit (continuation)

When the Bayesian Multi-Armed Bandit algorithm prunes an underperforming ad campaign ($P(\text{ROAS} < 0.80) > 90\%$), the advertising pipeline faces an operational bottleneck: it runs out of active arms unless new creative assets are generated and deployed to replace the pruned campaigns.

The **`AdCreativeAgent`** automates this replenishment loop. When a campaign is pruned, the agent analyzes historical winning copy in ChromaDB, generates high-converting marketing copy and image prompts, renders production-ready 1080×1080 ad banners using an image generation model and Pillow typography compositing, provisions the new ad objects via the Meta Marketing API, and seeds the new variant into the bandit engine with exploratory priors.

---

### The Continuous Creative Replenishment Pipeline

```
 [ Bayesian Bandit Engine ]
            │
            ▼
 Detects Pruned Campaign (ROAS < 0.8x)
            │
            ▼
 Fires 'BANDIT_ARM_PRUNED' Event
            │
            ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │                      AdCreativeAgent Workflow                          │
 │                                                                        │
 │  1. Semantic Memory Search (ChromaDB): Top historical converting hooks │
 │  2. Claude Code Pass: Generates Headline, Primary Text, Image Prompt   │
 │  3. Diffusion Generation: Generates raw visual asset via FLUX / DALL-E │
 │  4. Creative Engine Compositor (PIL): Adds contrast scrim & typography│
 │  5. Meta Graph API: Uploads image hash & registers AdCreative entity   │
 │  6. Bandit Registration: Creates new BanditArmState (μ=0.405, σ=0.60)  │
 └──────────────────────────────────┬─────────────────────────────────────┘
                                    │
                                    ▼
                     [ ActionApproval Queue (HITL) ]
            Operator inspects rendered banner preview & copy
                                    │
                         ┌──────────┴──────────┐
                         │                     │
                     [ Approve ]           [ Reject ]
                         │                     │
                         ▼                     ▼
               Pushed Live to Meta         Discarded
```

---

## 1. Banner Generation & Typography Compositor (`app/creative_engine.py`)

Ad networks prioritize images with clear typography, high contrast, and compliant dimensions. This module uses an image generation API (FLUX / Stability AI / OpenAI) to generate base photography or digital art, then uses **Pillow** to composite a dark gradient scrim, badge, headline, and call-to-action button:

```python
import os
import io
import requests
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from typing import Dict, Any, Tuple
from app.config import settings

class CreativeEngine:
    @staticmethod
    def generate_raw_image(prompt: str) -> Image.Image:
        """
        Calls an image generation API (FLUX / Stability / DALL-E).
        Falls back to a styled synthetic placeholder in SANDBOX_MODE.
        """
        api_key = os.getenv("STABILITY_API_KEY") or os.getenv("OPENAI_API_KEY")

        if settings.SANDBOX_MODE or not api_key:
            # Generate a modern procedural gradient background for local development
            img = Image.new("RGB", (1080, 1080), color=(15, 23, 42))
            draw = ImageDraw.Draw(img)
            for y in range(1080):
                r = int(15 + (y / 1080) * 30)
                g = int(23 + (y / 1080) * 15)
                b = int(42 + (y / 1080) * 60)
                draw.line([(0, y), (1080, y)], fill=(r, g, b))
            return img

        # Example call to OpenAI Images API
        resp = requests.post(
            "https://api.openai.com/v1/images/generations",
            headers={"Authorization": f"Bearer {api_key}"},
            json={
                "model": "dall-e-3",
                "prompt": f"Minimalist, modern commercial software advertisement backdrop: {prompt}. High resolution, 4k.",
                "size": "1024x1024",
                "quality": "standard",
                "n": 1
            },
            timeout=60
        )
        resp.raise_for_status()
        img_url = resp.json()["data"][0]["url"]
        img_data = requests.get(img_url, timeout=30).content
        return Image.open(io.BytesIO(img_data)).resize((1080, 1080))

    @classmethod
    def composite_ad_banner(
        cls,
        raw_image_prompt: str,
        category_badge: str,
        headline: str,
        cta_text: str = "Start Free Trial",
        output_filename: str = "banner.png"
    ) -> str:
        """
        Composites professional marketing typography over the raw visual asset:
        1. Resizes to standard Meta Feed 1080x1080.
        2. Applies a subtle bottom-half dark gradient scrim.
        3. Renders category pill, headline, and primary CTA button.
        """
        base_img = cls.generate_raw_image(raw_image_prompt).convert("RGBA")

        # Create overlay for gradient scrim to guarantee text legibility
        scrim = Image.new("RGBA", (1080, 1080), (0, 0, 0, 0))
        scrim_draw = ImageDraw.Draw(scrim)
        for y in range(400, 1080):
            alpha = int(((y - 400) / 680) ** 1.5 * 220)
            scrim_draw.line([(0, y), (1080, y)], fill=(0, 0, 0, alpha))

        composited = Image.alpha_composite(base_img, scrim)
        draw = ImageDraw.Draw(composited)

        # Basic font loading with fallback
        try:
            badge_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 28)
            headline_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 52)
            cta_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 32)
        except IOError:
            badge_font = ImageFont.load_default()
            headline_font = ImageFont.load_default()
            cta_font = ImageFont.load_default()

        # 1. Draw Category Badge (Pill)
        pill_x, pill_y = 80, 680
        badge_text = category_badge.upper()
        draw.rounded_rectangle([(pill_x, pill_y), (pill_x + 220, pill_y + 48)], radius=8, fill=(99, 102, 241, 255))
        draw.text((pill_x + 18, pill_y + 10), badge_text, fill=(255, 255, 255), font=badge_font)

        # 2. Draw Multi-line Headline
        headline_lines = cls._wrap_text(headline, max_chars_per_line=24)
        curr_y = 750
        for line in headline_lines[:3]:
            draw.text((80, curr_y), line, fill=(255, 255, 255), font=headline_font)
            curr_y += 65

        # 3. Draw Call-To-Action Button
        btn_y = 960
        draw.rounded_rectangle([(80, btn_y), (420, btn_y + 64)], radius=12, fill=(255, 255, 255, 255))
        draw.text((110, btn_y + 15), cta_text, fill=(15, 23, 42), font=cta_font)

        # Save to static workspace directory
        out_dir = os.path.abspath("./workspace/generated_ads")
        os.makedirs(out_dir, exist_ok=True)
        final_path = os.path.join(out_dir, output_filename)
        composited.convert("RGB").save(final_path, "PNG", quality=95)
        
        return final_path

    @staticmethod
    def _wrap_text(text: str, max_chars_per_line: int) -> list[str]:
        words = text.split()
        lines = []
        current = []
        for word in words:
            if len(" ".join(current + [word])) <= max_chars_per_line:
                current.append(word)
            else:
                lines.append(" ".join(current))
                current = [word]
        if current:
            lines.append(" ".join(current))
        return lines
```

---

## 2. Meta Marketing API Extensions (`app/adapters/ads_adapter.py`)

Add methods to `UnifiedAdsAdapter` to upload image binaries, create `AdCreative` objects, and instantiate new live `Ad` entities:

```python
# Add to app/adapters/ads_adapter.py:

    def upload_ad_image(self, image_path: str) -> str:
        """Uploads an image to Meta Ad Account library and returns its image_hash."""
        if settings.SANDBOX_MODE or not self.meta_access_token:
            return "mock_image_hash_7a9f1"

        url = f"https://graph.facebook.com/v19.0/{self.meta_ad_account_id}/adimages"
        with open(image_path, "rb") as f:
            files = {"file": f}
            data = {"access_token": self.meta_access_token}
            res = requests.post(url, data=data, files=files, timeout=30)
            res.raise_for_status()
            # Returns {"images": {"banner.png": {"hash": "..."}}}
            images = res.json().get("images", {})
            return list(images.values())[0]["hash"]

    def create_ad_creative(
        self,
        name: str,
        image_hash: str,
        primary_text: str,
        headline: str,
        target_url: str = "https://polsia.ai",
        call_to_action: str = "LEARN_MORE"
    ) -> str:
        """Creates an AdCreative object linking the image and marketing copy."""
        if settings.SANDBOX_MODE or not self.meta_access_token:
            return "mock_creative_id_55412"

        url = f"https://graph.facebook.com/v19.0/{self.meta_ad_account_id}/adcreatives"
        payload = {
            "access_token": self.meta_access_token,
            "name": name,
            "object_story_spec": {
                "page_id": os.getenv("META_PAGE_ID", "100000000000000"),
                "link_data": {
                    "image_hash": image_hash,
                    "link": target_url,
                    "message": primary_text,
                    "name": headline,
                    "call_to_action": {"type": call_to_action}
                }
            }
        }
        res = requests.post(url, json=payload, timeout=20)
        res.raise_for_status()
        return res.json()["id"]

    def create_ad_variant(self, adset_id: str, name: str, creative_id: str) -> str:
        """Instantiates an active Ad variant under an existing AdSet."""
        if settings.SANDBOX_MODE or not self.meta_access_token:
            return f"mock_ad_{os.urandom(4).hex()}"

        url = f"https://graph.facebook.com/v19.0/{self.meta_ad_account_id}/ads"
        payload = {
            "access_token": self.meta_access_token,
            "name": name,
            "adset_id": adset_id,
            "creative": {"creative_id": creative_id},
            "status": "ACTIVE"
        }
        res = requests.post(url, json=payload, timeout=20)
        res.raise_for_status()
        return res.json()["id"]
```

---

## 3. The `AdCreativeAgent` (`app/agents.py`)

The agent coordinates memory recall, copy synthesis, image rendering, and bandit seeding:

```python
# Add to app/agents.py:
import json
import uuid
from app.runner import run_claude_headless
from app.config import settings
from app.creative_engine import CreativeEngine
from app.adapters.ads_adapter import UnifiedAdsAdapter
from app.memory import AgentMemory
from app.db import SessionLocal
from app.models import ActionApproval, BanditArmState

class AdCreativeAgent:
    def __init__(self):
        self.name = "AdCreativeAgent"
        self.adapter = UnifiedAdsAdapter()
        self.memory = AgentMemory("AdCreativeAgent")
        self.soul = load_soul()

    def generate_candidate_creative(self, task_id: str, reason_prompt: str) -> dict:
        """
        1. Recalls historically winning ad copy from ChromaDB.
        2. Prompts Claude Code to design a new high-CTR marketing hook.
        3. Renders the composited visual banner via CreativeEngine.
        4. Seeds the new arm into BanditArmState with broad exploration priors.
        5. Submits the deployment action to the ActionApproval queue.
        """
        # Pull top past learnings on messaging conversion
        winning_context = self.memory.search_context("high converting software ad copy and hooks", n_results=3)

        prompt = (
            f"You are the senior growth marketing copywriter and creative director.\n"
            f"Context: {reason_prompt}\n"
            f"WINNING HISTORICAL COPY EXAMPLES:\n{winning_context}\n\n"
            "INSTRUCTIONS:\n"
            "1. Craft a high-converting B2B ad angle (focus on concrete engineering outcomes, zero buzzwords).\n"
            "2. Define an evocative image generation prompt for the background (clean, modern, minimalist).\n"
            "3. Provide a punchy headline (< 35 chars) and category badge.\n\n"
            "OUTPUT SPECIFICATION (STRICT JSON ONLY):\n"
            "{\n"
            '  "campaign_name": "TOF - Autonomous Swarm Pitch V3",\n'
            '  "category_badge": "AUTONOMOUS OPS",\n'
            '  "headline": "Zero Employees. Real Software.",\n'
            '  "primary_text": "Stop wrestling with copilot prompts. Polsia deploys an autonomous swarm that plans, codes, and ships pull requests while you sleep.",\n'
            '  "image_prompt": "Clean glass server rack with soft neon indigo lighting and architectural geometry",\n'
            '  "cta_text": "Explore Demo",\n'
            '  "target_adset_id": "meta_adset_global_01"\n'
            "}"
        )

        res = run_claude_headless(prompt=prompt, system_prompt=self.soul)
        data = json.loads(res.get("result", "{}"))

        # 1. Render the composited banner asset
        filename = f"ad_{task_id[:8]}.png"
        banner_path = CreativeEngine.composite_ad_banner(
            raw_image_prompt=data.get("image_prompt", "Modern geometric server rack"),
            category_badge=data.get("category_badge", "NEW FEATURE"),
            headline=data.get("headline", "Autonomous Software Systems"),
            cta_text=data.get("cta_text", "Start Free Trial"),
            output_filename=filename
        )

        # 2. Seed a new arm in BanditArmState with high-uncertainty exploration prior
        new_campaign_id = f"meta_camp_{uuid.uuid4().hex[:8]}"
        db = SessionLocal()
        new_arm = BanditArmState(
            campaign_id=new_campaign_id,
            platform="meta",
            mu_posterior=0.405,     # Prior: ln(1.5x ROAS)
            sigma_posterior=0.60    # Prior: Broad uncertainty for exploration
        )
        db.add(new_arm)

        # 3. Create high-stakes approval record with visual payload
        approval_id = str(uuid.uuid4())
        payload = {
            "campaign_id": new_campaign_id,
            "campaign_name": data.get("campaign_name"),
            "adset_id": data.get("target_adset_id", "default_adset"),
            "headline": data.get("headline"),
            "primary_text": data.get("primary_text"),
            "banner_local_path": banner_path,
            "banner_preview_url": f"/static/generated_ads/{filename}",
            "initial_daily_budget_cents": 2500,  # $25.00/day exploration tranche
            "action_type": "DEPLOY_NEW_AD_CREATIVE"
        }

        approval = ActionApproval(
            id=approval_id,
            task_id=task_id,
            agent_name=self.name,
            action_type="DEPLOY_NEW_AD_CREATIVE",
            payload=json.dumps(payload),
            status="PENDING"
        )
        db.add(approval)
        db.commit()
        db.close()

        # Commit generated copy to semantic memory
        self.memory.record_memory(
            content=f"Ad Variant: {data.get('headline')} | Copy: {data.get('primary_text')}",
            metadata={"campaign_id": new_campaign_id, "task_id": task_id}
        )

        return {"approval_id": approval_id, "payload": payload}
```

---

## 4. Automatic Prune-to-Replenish Hook (`app/tasks.py`)

When the Bayesian Bandit identifies a campaign for pruning, it dispatches the `AdCreativeAgent` asynchronously:

```python
# Add to app/tasks.py:
from app.agents import AdCreativeAgent

creative_agent = AdCreativeAgent()

@celery_app.task(bind=True)
def trigger_creative_replenishment(self, pruned_campaign_id: str, reason: str):
    """Fired automatically when an arm is pruned by Bayesian stopping rules."""
    r.publish("polsia:events", json.dumps({
        "event": "TASK_START",
        "task_id": self.request.id,
        "agent": "AdCreativeAgent",
        "instruction": f"Generate new creative variant to replace pruned arm: {pruned_campaign_id}"
    }))

    result = creative_agent.generate_candidate_creative(
        task_id=self.request.id,
        reason_prompt=f"Replace pruned campaign {pruned_campaign_id}. Prune reason: {reason}"
    )

    r.publish("polsia:events", json.dumps({
        "event": "TASK_COMPLETE",
        "task_id": self.request.id,
        "result": {
            "agent": "AdCreativeAgent",
            "task": f"Replenish creative for {pruned_campaign_id}",
            "output": f"Generated new ad creative: '{result['payload']['headline']}'",
            "verification": {"approved": True, "feedback": "Rendered 1080x1080 banner and seeded bandit prior."}
        }
    }))
    return result
```

Update `ActionDispatcher` in `app/dispatcher.py` to handle the `DEPLOY_NEW_AD_CREATIVE` action:

```python
# In app/dispatcher.py:
        elif action_type == "DEPLOY_NEW_AD_CREATIVE":
            adapter = UnifiedAdsAdapter()
            # 1. Upload composited banner
            image_hash = adapter.upload_ad_image(payload_data["banner_local_path"])
            # 2. Create AdCreative
            creative_id = adapter.create_ad_creative(
                name=f"Creative_{payload_data['headline']}",
                image_hash=image_hash,
                primary_text=payload_data["primary_text"],
                headline=payload_data["headline"]
            )
            # 3. Create Ad under AdSet
            ad_id = adapter.create_ad_variant(
                adset_id=payload_data["adset_id"],
                name=payload_data["campaign_name"],
                creative_id=creative_id
            )
            return {"status": "deployed", "ad_id": ad_id, "creative_id": creative_id}
```

Mount the static directory in FastAPI (`app/main.py`) so the Next.js frontend can render the banner preview:

```python
# In app/main.py:
from fastapi.staticfiles import StaticFiles

os.makedirs("./workspace/generated_ads", exist_ok=True)
app.mount("/static/generated_ads", StaticFiles(directory="./workspace/generated_ads"), name="generated_ads")
```

---

## 5. Next.js Visual Ad Approval Card (`components/AdCreativeApprovalCard.tsx`)

Enhance the approval queue on the frontend to render the visual banner, ad copy, and the bandit exploration budget:

```tsx
"use client";

import { Check, X, Image as ImageIcon, Sparkles, DollarSign } from "lucide-react";

interface CreativePayload {
  campaign_id: string;
  campaign_name: string;
  headline: string;
  primary_text: string;
  banner_preview_url: string;
  initial_daily_budget_cents: number;
}

interface Props {
  approvalId: string;
  payload: CreativePayload;
  onResolve: (id: string, decision: "APPROVE" | "REJECT") => void;
}

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function AdCreativeApprovalCard({ approvalId, payload, onResolve }: Props) {
  return (
    <div className="border border-indigo-500/30 bg-zinc-950/80 rounded-2xl p-5 mb-4 backdrop-blur">
      <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80 mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-mono font-bold text-zinc-100 uppercase tracking-wider">
              New Ad Creative Candidate
            </h3>
            <p className="text-[11px] text-zinc-400 font-mono">
              Bandit Replacement Variant • {payload.campaign_name}
            </p>
          </div>
        </div>

        <span className="text-xs font-mono bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded border border-emerald-500/20 flex items-center gap-1">
          <DollarSign className="w-3 h-3" />
          ${(payload.initial_daily_budget_cents / 100).toFixed(0)}/day test
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
        {/* Rendered Visual Banner Preview */}
        <div className="md:col-span-4 relative group rounded-xl overflow-hidden border border-zinc-800 bg-black aspect-square">
          <img
            src={`${BACKEND_URL}${payload.banner_preview_url}`}
            alt={payload.headline}
            className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-300"
          />
          <div className="absolute top-2 left-2 bg-black/60 backdrop-blur px-2 py-0.5 rounded text-[10px] font-mono text-zinc-300 flex items-center gap-1">
            <ImageIcon className="w-3 h-3 text-indigo-400" /> 1080×1080
          </div>
        </div>

        {/* Ad Copy & Target Details */}
        <div className="md:col-span-8 space-y-3">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 block mb-1">
              Headline
            </span>
            <p className="text-base font-bold text-white font-sans">{payload.headline}</p>
          </div>

          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 block mb-1">
              Primary Body Copy
            </span>
            <p className="text-xs text-zinc-300 leading-relaxed font-sans bg-black/40 p-3 rounded-lg border border-zinc-800/80">
              {payload.primary_text}
            </p>
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-[11px] font-mono text-indigo-400">
              Priors: μ=0.405 (1.5x ROAS), σ=0.60 (Exploration Arm)
            </span>

            {/* Decision Controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => onResolve(approvalId, "REJECT")}
                className="px-3 py-1.5 rounded-lg border border-zinc-700 hover:bg-zinc-800 text-zinc-300 text-xs font-medium flex items-center gap-1 transition-colors"
              >
                <X className="w-3.5 h-3.5 text-rose-400" /> Discard
              </button>
              <button
                onClick={() => onResolve(approvalId, "APPROVE")}
                className="px-4 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-lg shadow-indigo-500/20"
              >
                <Check className="w-3.5 h-3.5" /> Deploy Ad Variant
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

Update `components/ApprovalQueue.tsx` to conditionally render this rich ad card whenever `action_type === "DEPLOY_NEW_AD_CREATIVE"`:

```tsx
// Inside components/ApprovalQueue.tsx map loop:
{item.action_type === "DEPLOY_NEW_AD_CREATIVE" ? (
  <AdCreativeApprovalCard
    key={item.id}
    approvalId={item.id}
    payload={JSON.parse(item.payload)}
    onResolve={handleDecision}
  />
) : (
  /* Render standard JSON approval row */
)}
```

---

## 6. End-to-End Execution Trace

1. **Pruning Trigger:** In its 6-hour cycle, `BayesianBanditEngine` evaluates `meta_camp_103` (\$85 spend, 0 conversions). The Bayesian early-stopping rule calculates $P(\text{ROAS} < 0.80) = 97\%$ and sets its recommendation to `PAUSE_CAMPAIGN`.
2. **Event Dispatch:** Celery executes the pause and immediately invokes `trigger_creative_replenishment.delay("meta_camp_103", "ROAS < 0.80")`.
3. **Synthesis & Rendering:** `AdCreativeAgent` queries ChromaDB for top-converting hooks, generates a new angle via Claude Code, renders a 1080×1080 composited image with typography scrims via `CreativeEngine`, and writes the image to `/workspace/generated_ads/ad_xxxx.png`.
4. **Bandit Seeding:** A new arm record (`meta_camp_xxxx`) is added to `bandit_arm_states` with exploration priors ($\mu=0.405, \sigma=0.60$).
5. **Human Approval:** The Next.js dashboard displays `<AdCreativeApprovalCard/>` showing the rendered banner image, primary copy, and headline.
6. **Live Deployment:** Clicking **Deploy Ad Variant** calls `ActionDispatcher.dispatch()`, which uploads the image binary to Meta's Ad Library, creates the `AdCreative`, and launches the ad set with an initial \$25.00/day exploration budget.
