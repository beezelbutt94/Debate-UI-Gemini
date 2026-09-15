"""Procedural Foley SFX layering: whooshes, pops, impacts, and risers timed
to scene cuts and mixed into the master audio stem.
"""
import os
import subprocess
from typing import List, Optional

from pydantic import BaseModel, Field

FOLEY_ASSET_DIR = os.getenv("FOLEY_ASSET_DIR", "/var/viralvision/assets/foley")


class SFXEvent(BaseModel):
    sfx_type: str = Field(..., description="'whoosh', 'pop', 'impact', 'riser', 'click'")
    timestamp: float = Field(..., ge=0.0)
    volume: float = Field(0.4, ge=0.0, le=1.5)


class FoleyMixEngine:
    SFX_SAMPLE_MAP = {
        "whoosh": "whoosh_high_velocity.wav",
        "pop": "bubble_pop_transient.wav",
        "impact": "cinematic_sub_drop.wav",
        "riser": "tension_riser_2s.wav",
        "click": "interface_mechanical_click.wav",
    }

    def __init__(self, ffmpeg_bin: str = "ffmpeg"):
        self.ffmpeg_bin = ffmpeg_bin

    def build_sfx_filtergraph(
        self, base_audio_path: str, events: List[SFXEvent], output_audio_path: str
    ) -> List[str]:
        cmd = [self.ffmpeg_bin, "-y", "-i", base_audio_path]
        filter_nodes: List[str] = []
        input_labels: List[str] = []

        for idx, event in enumerate(events, start=1):
            filename = self.SFX_SAMPLE_MAP.get(event.sfx_type, "whoosh_high_velocity.wav")
            asset_path = os.path.join(FOLEY_ASSET_DIR, filename)
            if not os.path.exists(asset_path):
                asset_path = f"/tmp/{filename}"

            cmd.extend(["-i", asset_path])
            delay_ms = int(event.timestamp * 1000)
            label = f"sfx_{idx}"
            filter_nodes.append(f"[{idx}:a]adelay={delay_ms}|{delay_ms},volume={event.volume}[{label}]")
            input_labels.append(f"[{label}]")

        amix_inputs = len(events) + 1
        all_inputs = "[0:a]" + "".join(input_labels)
        filter_nodes.append(f"{all_inputs}amix=inputs={amix_inputs}:duration=first:dropout_transition=0[final_foley_out]")

        cmd.extend([
            "-filter_complex", ";".join(filter_nodes),
            "-map", "[final_foley_out]",
            "-c:a", "aac",
            "-b:a", "192k",
            "-ar", "48000",
            output_audio_path,
        ])
        return cmd

    def execute_mix(self, base_audio_path: str, events: List[SFXEvent], output_audio_path: str) -> str:
        if not events:
            return base_audio_path

        cmd = self.build_sfx_filtergraph(base_audio_path, events, output_audio_path)
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            raise RuntimeError(f"Foley mix pipeline failed:\n{result.stderr}")
        return output_audio_path
