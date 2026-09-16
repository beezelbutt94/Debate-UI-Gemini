"""AI storyboard generation: breaks an optimized script into short,
fast-cut scenes with a visual-direction prompt for B-roll matching.
"""
from typing import List

from pydantic import BaseModel, Field

from app.core.llm import generate_structured


class StoryboardScene(BaseModel):
    scene_num: int
    duration_seconds: float = Field(..., gt=0.5, le=10.0)
    voiceover: str
    visual_direction: str
    camera_motion: str  # zoom_in, zoom_out, pan_left, pan_right, static
    text_overlay: str | None = None
    vibe: str


class _StoryboardResult(BaseModel):
    """Top-level object wrapper.

    JSON Schema constrained decoding needs an object at the root; the
    callers still get a plain list of scenes.
    """

    scenes: List[StoryboardScene]

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
    # Constrained decoding needs an object at the top level, so the scene
    # list is wrapped rather than returned bare.
    return (await generate_structured(prompt, _StoryboardResult, max_tokens=2500)).scenes
