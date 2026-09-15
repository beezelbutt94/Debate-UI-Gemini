"""Word-level transcription and kinetic (Advanced SubStation Alpha) caption
generation, optimized for 9:16 vertical video.

Requires the optional `faster-whisper` dependency; see
`services/api/requirements-ml.txt`.
"""
from typing import Any, Dict, List


class KineticSubtitleGenerator:
    def __init__(self, model_size: str = "small", device: str = "cpu", compute_type: str = "int8"):
        from faster_whisper import WhisperModel  # optional dependency, imported lazily

        self.model = WhisperModel(model_size, device=device, compute_type=compute_type)

    def transcribe_with_words(self, audio_path: str) -> List[Dict[str, Any]]:
        segments, _ = self.model.transcribe(
            audio_path,
            word_timestamps=True,
            vad_filter=True,
            vad_parameters=dict(min_silence_duration_ms=400),
        )
        words: List[Dict[str, Any]] = []
        for segment in segments:
            for word in segment.words:
                words.append({
                    "word": word.word.strip().upper(),
                    "start": word.start,
                    "end": word.end,
                    "probability": word.probability,
                })
        return words

    @staticmethod
    def _format_timestamp(seconds: float) -> str:
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        centis = int(round((seconds - int(seconds)) * 100))
        return f"{hours}:{minutes:02d}:{secs:02d}.{centis:02d}"

    def build_ass_subtitles(
        self,
        words: List[Dict[str, Any]],
        output_ass_path: str,
        font_name: str = "Montserrat ExtraBold",
        font_size: int = 48,
        primary_color_bgr: str = "&H00FFFFFF",
        highlight_color_bgr: str = "&H0000FFFF",
        outline_color_bgr: str = "&H00000000",
        max_words_per_line: int = 3,
    ) -> str:
        chunks = [words[i : i + max_words_per_line] for i in range(0, len(words), max_words_per_line)]

        header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,{font_name},{font_size},{primary_color_bgr},&H000000FF,{outline_color_bgr},&H80000000,-1,0,0,0,100,100,2,0,1,6,0,5,60,60,960,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
        events: List[str] = []
        for chunk in chunks:
            if not chunk:
                continue
            for active_idx, target_word in enumerate(chunk):
                w_start = self._format_timestamp(target_word["start"])
                w_end = self._format_timestamp(target_word["end"])

                line_parts = []
                for idx, w in enumerate(chunk):
                    if idx == active_idx:
                        line_parts.append(
                            f"{{\\c{highlight_color_bgr}\\t(0,80,\\fscx118\\fscy118)\\t(80,160,\\fscx100\\fscy100)}}"
                            f"{w['word']}{{\\c{primary_color_bgr}}}"
                        )
                    else:
                        line_parts.append(w["word"])

                events.append(f"Dialogue: 0,{w_start},{w_end},Default,,0,0,0,,{' '.join(line_parts)}")

        with open(output_ass_path, "w", encoding="utf-8") as f:
            f.write(header + "\n".join(events))

        return output_ass_path
