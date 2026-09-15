"""Audio ducking (voiceover-over-music sidechain compression) and EBU R128
loudness mastering to -14 LUFS, matching TikTok/Instagram normalization.
"""
import subprocess
from typing import List


class AudioMixEngine:
    def __init__(self, ffmpeg_bin: str = "ffmpeg"):
        self.ffmpeg_bin = ffmpeg_bin

    def build_ducking_command(
        self,
        voiceover_path: str,
        background_music_path: str,
        output_audio_path: str,
        music_volume: float = 0.25,
        ducking_reduction_db: float = 14.0,
        target_i_lufs: float = -14.0,
    ) -> List[str]:
        ratio = max(2.0, ducking_reduction_db / 2.0)
        filter_complex = (
            f"[1:a]volume={music_volume}[music_raw];"
            f"[0:a]asplit=2[vo_main][vo_sidechain];"
            f"[music_raw][vo_sidechain]sidechaincompress="
            f"threshold=0.08:ratio={ratio}:attack=20:release=350[ducked_music];"
            f"[vo_main][ducked_music]amix=inputs=2:duration=first:dropout_transition=2[mixed_audio];"
            f"[mixed_audio]loudnorm=I={target_i_lufs}:TP=-1.5:LRA=11[mastered_audio]"
        )
        return [
            self.ffmpeg_bin, "-y",
            "-i", voiceover_path,
            "-stream_loop", "-1",
            "-i", background_music_path,
            "-filter_complex", filter_complex,
            "-map", "[mastered_audio]",
            "-c:a", "aac",
            "-b:a", "192k",
            "-ar", "48000",
            output_audio_path,
        ]

    def process(self, vo_path: str, bgm_path: str, out_path: str) -> None:
        cmd = self.build_ducking_command(vo_path, bgm_path, out_path)
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            raise RuntimeError(f"FFmpeg audio master failed:\n{result.stderr}")
