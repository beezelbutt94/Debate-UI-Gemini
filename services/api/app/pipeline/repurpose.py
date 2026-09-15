"""Long-form-to-shorts repurposing: transcribes a podcast/webinar/stream,
asks Claude to pick the highest-retention 20-60s segments, and extracts
them losslessly for further short-form processing.

Requires the optional `faster-whisper` dependency.
"""
import json
import subprocess
from typing import List

from pydantic import BaseModel, Field

from app.core.anthropic_client import ANTHROPIC_MODEL, extract_json_block, get_anthropic_client


class ExtractedClipCandidate(BaseModel):
    clip_id: str
    start_second: float
    end_second: float
    duration: float
    hook_text: str
    virality_rationale: str
    confidence_score: float = Field(..., ge=0.0, le=1.0)


class LongFormRepurposingEngine:
    def __init__(self, whisper_model_size: str = "medium", device: str = "cpu"):
        from faster_whisper import WhisperModel  # optional dependency, imported lazily

        self.transcriber = WhisperModel(whisper_model_size, device=device, compute_type="int8")

    async def detect_viral_segments(self, audio_path: str, max_segments_considered: int = 250) -> List[ExtractedClipCandidate]:
        segments_gen, _ = self.transcriber.transcribe(audio_path, beam_size=5, vad_filter=True)
        transcript_segments = [
            {"start": round(s.start, 2), "end": round(s.end, 2), "text": s.text.strip()} for s in segments_gen
        ]

        prompt = f"""You are a master viral video editor.
Review the following transcript segments with exact start/end timestamps from a long-form video.
Identify the top 3-5 segments that:
1. Start with an immediate, gripping hook or contrarian thesis (no rambling lead-ins).
2. Tell a complete, punchy insight within 20 to 60 seconds.
3. Have strong potential to trigger shares and comments on TikTok and Instagram Reels.

Transcript Data:
{json.dumps(transcript_segments[:max_segments_considered])}

Output strictly valid JSON as an array of objects with keys:
clip_id, start_second, end_second, duration, hook_text, virality_rationale, confidence_score.
"""
        # No `temperature`: sampling parameters are rejected with a 400 on
        # claude-opus-5 and the rest of the current model family.
        response = await get_anthropic_client().messages.create(
            model=ANTHROPIC_MODEL,
            max_tokens=2500,
            messages=[{"role": "user", "content": prompt}],
        )

        candidates = json.loads(extract_json_block(response.content[0].text))
        return [ExtractedClipCandidate(**c) for c in candidates]

    def extract_lossless_subclip(self, source_video_path: str, start_sec: float, duration_sec: float, output_subclip_path: str) -> str:
        cmd = [
            "ffmpeg", "-y",
            "-ss", str(start_sec),
            "-t", str(duration_sec),
            "-i", source_video_path,
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
            "-c:a", "aac", "-b:a", "192k",
            "-avoid_negative_ts", "1",
            output_subclip_path,
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            raise RuntimeError(f"Subclip extraction failed:\n{result.stderr}")
        return output_subclip_path
