"""Local text-to-speech, replacing the hosted ElevenLabs call.

Backends are pluggable because the licence terms differ in ways that matter
commercially:

- **kokoro** (default) -- Apache-2.0, 54 fixed voices, faster than realtime
  on CPU. No voice cloning. The right default: it is the only one here with
  no licence caveat and no GPU requirement.
- **chatterbox** -- MIT, clones a voice from ~5s of reference audio. Use
  when a creator wants their own voice.
- **piper** -- MIT, tiny and extremely fast (runs on a Raspberry Pi), lower
  fidelity. Useful for drafts or constrained hardware.

Deliberately NOT offered: XTTS-v2. It is the best-known open cloning model,
but its weights ship under the Coqui Public Model License, which is
non-commercial -- shipping it in a paid product would be a licence
violation. Chatterbox covers the same need under MIT.
"""
import asyncio
import logging
import os
import shutil
from functools import lru_cache

logger = logging.getLogger(__name__)

TTS_BACKEND = os.getenv("TTS_BACKEND", "kokoro").lower()

# Kokoro voice ids look like "af_heart" / "am_michael" (a=American,
# f/m=gender). Full list: https://huggingface.co/hexgrad/Kokoro-82M
DEFAULT_VOICE = os.getenv("TTS_DEFAULT_VOICE", "af_heart")
TTS_SAMPLE_RATE = 24000


class TTSError(RuntimeError):
    """Speech synthesis could not be performed."""

    def __init__(self, code: str, message: str, remedy: str = ""):
        super().__init__(message)
        self.code = code
        self.remedy = remedy


@lru_cache(maxsize=1)
def _kokoro_pipeline():
    try:
        from kokoro import KPipeline
    except ImportError as exc:
        raise TTSError(
            "backend_not_installed",
            f"The kokoro package is not installed: {exc}",
            "pip install kokoro soundfile, and apt-get install espeak-ng.",
        ) from exc

    if not shutil.which("espeak-ng") and not shutil.which("espeak"):
        # Kokoro phonemizes through espeak-ng; without it you get a
        # confusing failure deep inside the phonemizer rather than a
        # missing-dependency message.
        raise TTSError(
            "espeak_missing",
            "espeak-ng is not installed; kokoro cannot phonemize text without it.",
            "apt-get install espeak-ng (or brew install espeak-ng).",
        )

    return KPipeline(lang_code="a")  # 'a' = American English


def _synthesize_kokoro(text: str, voice: str, output_path: str) -> str:
    import numpy as np
    import soundfile as sf

    pipeline = _kokoro_pipeline()
    chunks = [audio for _, _, audio in pipeline(text, voice=voice)]
    if not chunks:
        raise TTSError(
            "empty_output",
            "kokoro produced no audio for the supplied text.",
            "Check the text is non-empty and the voice id is valid.",
        )

    sf.write(output_path, np.concatenate(chunks), TTS_SAMPLE_RATE)
    return output_path


def _synthesize_piper(text: str, voice: str, output_path: str) -> str:
    import subprocess

    if not shutil.which("piper"):
        raise TTSError(
            "backend_not_installed",
            "The piper binary is not on PATH.",
            "Install from https://github.com/rhasspy/piper and set TTS_PIPER_MODEL.",
        )
    model = os.getenv("TTS_PIPER_MODEL")
    if not model:
        raise TTSError(
            "backend_not_configured",
            "TTS_PIPER_MODEL is not set.",
            "Point it at a downloaded .onnx voice model.",
        )

    result = subprocess.run(
        ["piper", "--model", model, "--output_file", output_path],
        input=text.encode(), capture_output=True,
    )
    if result.returncode != 0:
        raise TTSError("synthesis_failed", result.stderr.decode(errors="replace")[:300])
    return output_path


def _synthesize_chatterbox(text: str, voice: str, output_path: str) -> str:
    try:
        import torchaudio
        from chatterbox.tts import ChatterboxTTS
    except ImportError as exc:
        raise TTSError(
            "backend_not_installed",
            f"chatterbox-tts is not installed: {exc}",
            "pip install chatterbox-tts (needs torch).",
        ) from exc

    # Here `voice` is a path to a reference audio clip to clone, not a
    # preset name -- the one place the backends' voice argument differs.
    model = ChatterboxTTS.from_pretrained(device=os.getenv("TTS_DEVICE", "cpu"))
    wav = model.generate(text, audio_prompt_path=voice) if voice else model.generate(text)
    torchaudio.save(output_path, wav, model.sr)
    return output_path


_BACKENDS = {
    "kokoro": _synthesize_kokoro,
    "piper": _synthesize_piper,
    "chatterbox": _synthesize_chatterbox,
}


async def synthesize_speech(text: str, output_path: str, voice: str | None = None) -> str:
    """Writes spoken audio for `text` to `output_path` and returns the path.

    Runs in a worker thread: every backend is blocking and CPU-bound, and
    calling one directly from the event loop would stall every other
    request in the process.
    """
    if not text or not text.strip():
        raise TTSError("empty_input", "No text supplied to synthesize.")

    backend = _BACKENDS.get(TTS_BACKEND)
    if backend is None:
        raise TTSError(
            "unknown_backend",
            f"TTS_BACKEND='{TTS_BACKEND}' is not one of {sorted(_BACKENDS)}.",
            "Set TTS_BACKEND to kokoro, piper or chatterbox.",
        )

    os.makedirs(os.path.dirname(os.path.abspath(output_path)) or ".", exist_ok=True)
    return await asyncio.to_thread(backend, text, voice or DEFAULT_VOICE, output_path)


def healthcheck() -> dict:
    """Whether the configured TTS backend can actually run right now."""
    if TTS_BACKEND not in _BACKENDS:
        return {"ok": False, "backend": TTS_BACKEND, "reason": "unknown_backend"}
    if TTS_BACKEND == "kokoro":
        try:
            _kokoro_pipeline()
        except TTSError as exc:
            return {"ok": False, "backend": TTS_BACKEND, "reason": exc.code, "remedy": exc.remedy}
    return {"ok": True, "backend": TTS_BACKEND, "default_voice": DEFAULT_VOICE}
