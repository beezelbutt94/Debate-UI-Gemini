"""Proves local speech synthesis actually produces audio, and that its
failure paths report a cause instead of crashing deep in a dependency.

    TTS_BACKEND=kokoro python tests/eval_tts.py
"""
import asyncio
import os
import sys
import wave

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.core.tts import TTSError, healthcheck, synthesize_speech  # noqa: E402

results = []


def check(name, ok, detail=""):
    results.append((name, ok, detail))


async def main():
    health = healthcheck()
    print(f"health: {health}\n")

    out = os.path.join(os.path.dirname(__file__), "_tts_probe.wav")
    text = ("Stop scrolling. The one grocery mistake costing you two hundred "
            "dollars a month is hiding in plain sight.")

    try:
        path = await synthesize_speech(text, out)
        check("1. synthesis returns a path", path == out, path)

        size = os.path.getsize(out)
        check("2. file is non-trivially sized", size > 10_000, f"{size} bytes")

        with wave.open(out, "rb") as w:
            seconds = w.getnframes() / float(w.getframerate())
            check("3. decodes as real audio", w.getnframes() > 0,
                  f"{seconds:.1f}s @ {w.getframerate()}Hz, {w.getnchannels()}ch")
            # ~19 words of speech should land in a plausible range, not a
            # click or a silent buffer.
            check("4. duration is plausible for the text", 2.0 < seconds < 20.0,
                  f"{seconds:.1f}s")
    except TTSError as exc:
        check("1-4. synthesis", False, f"TTSError[{exc.code}] {exc}")

    # Failure paths must be typed, not a stack trace from inside a library.
    try:
        await synthesize_speech("   ", out)
        check("5. empty text rejected", False, "no error raised")
    except TTSError as exc:
        check("5. empty text rejected", exc.code == "empty_input", f"code={exc.code}")

    import app.core.tts as tts
    original = tts.TTS_BACKEND
    tts.TTS_BACKEND = "nonexistent-engine"
    try:
        await synthesize_speech("hello", out)
        check("6. unknown backend rejected", False, "no error raised")
    except TTSError as exc:
        check("6. unknown backend rejected",
              exc.code == "unknown_backend" and bool(exc.remedy), f"code={exc.code}")
    finally:
        tts.TTS_BACKEND = original

    if os.path.exists(out):
        os.remove(out)

    print()
    failed = 0
    for name, ok, detail in results:
        print(f"  {'PASS' if ok else 'FAIL'}  {name}" + (f"   [{detail}]" if detail else ""))
        failed += 0 if ok else 1
    print(f"\n{len(results) - failed}/{len(results)} passed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
