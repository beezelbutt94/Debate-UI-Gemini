"""FFmpeg composition pipeline: quality-tier transcode presets, watermark
overlay, and intro/outro concatenation.
"""
import asyncio
import os
import shutil
import subprocess
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class QualityTierConfig(BaseModel):
    resolution: str
    width: int
    height: int
    fps: int
    vcodec: str
    preset: str
    crf: int
    audio_bitrate: str


QUALITY_TIER_SPECS: Dict[str, QualityTierConfig] = {
    "draft": QualityTierConfig(
        resolution="1280x720", width=1280, height=720, fps=24,
        vcodec="libx264", preset="ultrafast", crf=28, audio_bitrate="96k",
    ),
    "standard": QualityTierConfig(
        resolution="1920x1080", width=1920, height=1080, fps=30,
        vcodec="libx264", preset="fast", crf=23, audio_bitrate="192k",
    ),
    "premium": QualityTierConfig(
        resolution="2560x1440", width=2560, height=1440, fps=60,
        vcodec="libx265", preset="medium", crf=18, audio_bitrate="320k",
    ),
}


class BrandOverlayOptions(BaseModel):
    logo_path: Optional[str] = None
    position: str = Field(default="bottom_right")
    size_ratio: float = Field(default=0.15, ge=0.05, le=0.30)
    opacity: float = Field(default=0.8, ge=0.0, le=1.0)
    intro_path: Optional[str] = None
    outro_path: Optional[str] = None


class VideoProcessingPipeline:
    def __init__(self, ffmpeg_bin: str = "ffmpeg"):
        self.ffmpeg_bin = ffmpeg_bin
        if not shutil.which(self.ffmpeg_bin):
            raise EnvironmentError(f"FFmpeg binary not found at '{self.ffmpeg_bin}'")

    @staticmethod
    def _overlay_coordinates(position: str, padding: int = 24) -> str:
        coords = {
            "top_left": f"{padding}:{padding}",
            "top_right": f"main_w-overlay_w-{padding}:{padding}",
            "bottom_left": f"{padding}:main_h-overlay_h-{padding}",
            "bottom_right": f"main_w-overlay_w-{padding}:main_h-overlay_h-{padding}",
            "center": "(main_w-overlay_w)/2:(main_h-overlay_h)/2",
        }
        return coords.get(position, coords["bottom_right"])

    def build_command(
        self,
        input_video: str,
        output_video: str,
        tier: str = "standard",
        brand: Optional[BrandOverlayOptions] = None,
    ) -> List[str]:
        spec = QUALITY_TIER_SPECS.get(tier.lower(), QUALITY_TIER_SPECS["standard"])
        cmd = [self.ffmpeg_bin, "-y", "-i", input_video]

        filters: List[str] = []
        input_count = 1
        current_v = "0:v"

        filters.append(
            f"[{current_v}]scale={spec.width}:{spec.height}:force_original_aspect_ratio=decrease,"
            f"pad={spec.width}:{spec.height}:(ow-iw)/2:(oh-ih)/2,fps={spec.fps},format=yuv420p[base_v]"
        )
        current_v = "base_v"

        if brand and brand.logo_path and os.path.exists(brand.logo_path):
            logo_idx = input_count
            cmd.extend(["-i", brand.logo_path])
            input_count += 1
            coords = self._overlay_coordinates(brand.position)
            filters.append(
                f"[{logo_idx}:v]format=rgba,colorchannelmixer=aa={brand.opacity},"
                f"scale=iw*min({spec.width}*{brand.size_ratio}/iw\\,{spec.height}*{brand.size_ratio}/ih):-1[wm]"
            )
            filters.append(f"[{current_v}][wm]overlay={coords}[branded_v]")
            current_v = "branded_v"

        concat_v: List[str] = []
        concat_a: List[str] = []

        if brand and brand.intro_path and os.path.exists(brand.intro_path):
            idx = input_count
            cmd.extend(["-i", brand.intro_path])
            input_count += 1
            filters.append(
                f"[{idx}:v]scale={spec.width}:{spec.height},fps={spec.fps},format=yuv420p[intro_v];"
                f"[{idx}:a]aformat=sample_rates=48000:channel_layouts=stereo[intro_a]"
            )
            concat_v.append("[intro_v]")
            concat_a.append("[intro_a]")

        concat_v.append(f"[{current_v}]")
        filters.append("[0:a]aformat=sample_rates=48000:channel_layouts=stereo[main_a]")
        concat_a.append("[main_a]")

        if brand and brand.outro_path and os.path.exists(brand.outro_path):
            idx = input_count
            cmd.extend(["-i", brand.outro_path])
            input_count += 1
            filters.append(
                f"[{idx}:v]scale={spec.width}:{spec.height},fps={spec.fps},format=yuv420p[outro_v];"
                f"[{idx}:a]aformat=sample_rates=48000:channel_layouts=stereo[outro_a]"
            )
            concat_v.append("[outro_v]")
            concat_a.append("[outro_a]")

        if len(concat_v) > 1:
            n = len(concat_v)
            joined = "".join(f"{v}{a}" for v, a in zip(concat_v, concat_a))
            filters.append(f"{joined}concat=n={n}:v=1:a=1[out_v][out_a]")
            final_v, final_a = "[out_v]", "[out_a]"
        else:
            final_v, final_a = f"[{current_v}]", "[main_a]"

        cmd.extend([
            "-filter_complex", ";".join(filters),
            "-map", final_v,
            "-map", final_a,
            "-c:v", spec.vcodec,
            "-preset", spec.preset,
            "-crf", str(spec.crf),
            "-c:a", "aac",
            "-b:a", spec.audio_bitrate,
            "-movflags", "+faststart",
            output_video,
        ])
        return cmd

    def execute_sync(
        self,
        input_video: str,
        output_video: str,
        tier: str = "standard",
        brand: Optional[BrandOverlayOptions] = None,
        timeout_seconds: int = 600,
    ) -> Dict[str, Any]:
        """Blocking transcode -- what Celery workers call."""
        cmd = self.build_command(input_video, output_video, tier, brand)
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout_seconds)
        if result.returncode != 0:
            raise RuntimeError(f"FFmpeg pipeline failed (code {result.returncode}):\n{result.stderr}")
        return {
            "status": "completed",
            "tier": tier,
            "output_path": output_video,
            "size_bytes": os.path.getsize(output_video) if os.path.exists(output_video) else 0,
        }

    async def execute(
        self,
        input_video: str,
        output_video: str,
        tier: str = "standard",
        brand: Optional[BrandOverlayOptions] = None,
        timeout_seconds: int = 600,
    ) -> Dict[str, Any]:
        """Async variant for callers already inside an event loop (e.g. a
        FastAPI request handler doing a synchronous draft preview)."""
        cmd = self.build_command(input_video, output_video, tier, brand)
        process = await asyncio.create_subprocess_exec(
            *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
        )
        try:
            _, stderr = await asyncio.wait_for(process.communicate(), timeout=timeout_seconds)
        except asyncio.TimeoutError as exc:
            process.kill()
            raise TimeoutError(f"Video transcoding exceeded timeout of {timeout_seconds}s") from exc

        if process.returncode != 0:
            raise RuntimeError(f"FFmpeg pipeline failed (code {process.returncode}):\n{stderr.decode(errors='replace')}")

        return {
            "status": "completed",
            "tier": tier,
            "output_path": output_video,
            "size_bytes": os.path.getsize(output_video) if os.path.exists(output_video) else 0,
        }
