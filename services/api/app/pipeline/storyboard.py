"""AI storyboard generation: breaks an optimized script into short,
fast-cut scenes with a visual-direction prompt for B-roll matching.
"""
import json
import os
from typing import List

from anthropic import AsyncAnthropic
from pydantic import BaseModel, Field

# Verify this against Anthropic's current model list before deploying --
# pin an explicit dated model id rather than tracking "latest" in production.
ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-opus-5")

_client = AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))


class StoryboardScene(BaseModel):
    scene_num: int
    duration_seconds: float = Field(..., gt=0.5, le=10.0)
    voiceover: str
    visual_direction: str
    camera_motion: str  # zoom_in, zoom_out, pan_left, pan_right, static
    text_overlay: str | None = None
    vibe: str


def _extract_json_block(raw: str) -> str:
    text = raw.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()
    return text


async def generate_storyboard_ai(
    brand_context: str,
    topic: str,
    duration: int = 15,
    vibe: str = "energetic",
) -> List[StoryboardScene]:
    prompt = f"""You are an elite automated video director.
Break the following short-form narration into tightly paced scenes for a {duration}-second vertical video.

Brand Context / Niche: {brand_context}
Narration Script: "{topic}"
Desired Aesthetic: {vibe}

Rules:
1. Each scene should typically span 2.0 to 4.0 seconds; total durations must sum to about {duration} seconds.
2. "visual_direction" must be concrete enough for semantic CLIP video matching.
3. "camera_motion" must be one of: "zoom_in", "zoom_out", "pan_left", "pan_right", "static".

Output strictly valid JSON as an array of scene objects with keys:
scene_num, duration_seconds, voiceover, visual_direction, camera_motion, text_overlay, vibe.
"""
    response = await _client.messages.create(
        model=ANTHROPIC_MODEL,
        max_tokens=2500,
        temperature=0.3,
        messages=[{"role": "user", "content": prompt}],
    )

    scenes_raw = json.loads(_extract_json_block(response.content[0].text))
    return [StoryboardScene(**scene) for scene in scenes_raw]
