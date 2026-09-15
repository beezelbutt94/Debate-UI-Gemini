"""ElevenLabs voice synthesis and optional talking-head lip-sync.

Text-to-speech is a straightforward HTTP call against ElevenLabs; lip-sync
shells out to a separate local model runner (Wav2Lip/LivePortrait-style),
which is not part of this scaffold and must be provisioned separately if
avatar video generation is pursued.
"""
import asyncio
import os
from typing import Any, Dict, Optional

import requests
from pydantic import BaseModel, HttpUrl


class AvatarSynthesisRequest(BaseModel):
    avatar_image_url: HttpUrl
    script_text: str
    voice_id: str
    stability: float = 0.50
    similarity_boost: float = 0.80
    output_fps: int = 30


class AvatarPipeline:
    def __init__(self, elevenlabs_api_key: Optional[str] = None):
        self.api_key = elevenlabs_api_key or os.getenv("ELEVENLABS_API_KEY")
        self.base_url = "https://api.elevenlabs.io/v1"

    async def generate_speech_audio(
        self,
        text: str,
        voice_id: str,
        output_audio_path: str,
        stability: float = 0.50,
        similarity_boost: float = 0.80,
    ) -> str:
        url = f"{self.base_url}/text-to-speech/{voice_id}"
        headers = {"xi-api-key": self.api_key, "Content-Type": "application/json"}
        payload = {
            "text": text,
            "model_id": "eleven_multilingual_v2",
            "voice_settings": {
                "stability": stability,
                "similarity_boost": similarity_boost,
                "style": 0.0,
                "use_speaker_boost": True,
            },
        }

        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None, lambda: requests.post(url, json=payload, headers=headers, stream=True, timeout=30)
        )
        response.raise_for_status()

        with open(output_audio_path, "wb") as f:
            for chunk in response.iter_content(chunk_size=4096):
                if chunk:
                    f.write(chunk)

        return output_audio_path

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
