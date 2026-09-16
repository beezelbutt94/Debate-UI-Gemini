"""Voice synthesis and optional talking-head lip-sync.

Speech is generated locally (see app/core/tts.py) rather than through a
hosted API. Lip-sync shells out to a separate local model runner
(Wav2Lip/LivePortrait-style), which is not part of this scaffold and must
be provisioned separately if avatar video generation is pursued.
"""
import asyncio
from typing import Any, Dict, Optional

from pydantic import BaseModel, HttpUrl

from app.core.tts import synthesize_speech


class AvatarSynthesisRequest(BaseModel):
    avatar_image_url: HttpUrl
    script_text: str
    # A local backend's voice: a preset name for kokoro/piper
    # ("af_heart"), or a path to reference audio for chatterbox cloning.
    voice_id: Optional[str] = None
    output_fps: int = 30


class AvatarPipeline:
    def __init__(self, voice_id: Optional[str] = None):
        # No API key: synthesis happens in-process. The previous
        # ElevenLabs-specific `stability` / `similarity_boost` knobs are
        # gone because no local backend has an equivalent -- keeping them
        # as ignored arguments would have been worse than removing them.
        self.voice_id = voice_id

    async def generate_speech_audio(
        self,
        text: str,
        output_audio_path: str,
        voice_id: Optional[str] = None,
    ) -> str:
        return await synthesize_speech(
            text, output_audio_path, voice=voice_id or self.voice_id
        )

    async def execute_lip_sync(
        self, face_image_path: str, audio_path: str, output_video_path: str, fps: int = 30
    ) -> Dict[str, Any]:
        """Invokes a local neural lip-sync worker via subprocess.

        This assumes a `workers.neural_lip_sync` module provisioned
        separately (e.g. a Wav2Lip/LivePortrait ONNX runtime) -- it is not
        included in this scaffold.
        """
        cmd = [
            "python", "-m", "workers.neural_lip_sync",
            "--face", face_image_path,
            "--audio", audio_path,
            "--outfile", output_video_path,
            "--fps", str(fps),
            "--pads", "0", "10", "0", "0",
            "--resize_factor", "1",
        ]

        process = await asyncio.create_subprocess_exec(
            *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
        )
        _, stderr = await process.communicate()

        if process.returncode != 0:
            raise RuntimeError(f"Lip-sync synthesis failed:\n{stderr.decode(errors='replace')}")

        return {"status": "completed", "video_path": output_video_path, "fps": fps}
