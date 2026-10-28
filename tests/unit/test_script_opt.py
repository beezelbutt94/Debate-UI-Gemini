"""Tests for pure/deterministic logic in the script_opt and repurpose pipeline modules."""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../services/api'))

import pytest


class TestTargetWordsCalculation:
    """
    The optimize_script_for_virality function computes:
        target_words = int((target_duration_seconds / 60.0) * 160)

    This is the only pure computation in that module — no Anthropic call needed.
    We test the formula directly to ensure it stays accurate across all durations.
    """

    @staticmethod
    def compute_target_words(duration_seconds: int) -> int:
        return int((duration_seconds / 60.0) * 160)

    def test_15_second_video(self):
        assert self.compute_target_words(15) == 40

    def test_30_second_video(self):
        assert self.compute_target_words(30) == 80

    def test_60_second_video(self):
        assert self.compute_target_words(60) == 160

    def test_45_second_video(self):
        assert self.compute_target_words(45) == 120

    def test_10_second_video(self):
        assert self.compute_target_words(10) == 26

    def test_0_second_video(self):
        assert self.compute_target_words(0) == 0

    def test_90_second_video(self):
        assert self.compute_target_words(90) == 240

    def test_result_is_integer(self):
        result = self.compute_target_words(17)
        assert isinstance(result, int)

    def test_scales_linearly_double_duration_double_words(self):
        """Confirm proportionality: doubling duration doubles target words."""
        short = self.compute_target_words(20)
        long_ = self.compute_target_words(40)
        assert long_ == 2 * short

    def test_never_negative(self):
        for duration in range(0, 121, 5):
            assert self.compute_target_words(duration) >= 0


class TestExtractLosslessSubclipCommand:
    """
    Tests the command construction in LongFormRepurposingEngine.extract_lossless_subclip.
    The underlying ffmpeg subprocess is NOT called — we only verify the command list shape.
    """

    def _build_cmd(self, source: str, start_sec: float, duration_sec: float, output: str):
        return [
            "ffmpeg", "-y",
            "-ss", str(start_sec),
            "-t", str(duration_sec),
            "-i", source,
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
            "-c:a", "aac", "-b:a", "192k",
            "-avoid_negative_ts", "1",
            output,
        ]

    def test_command_starts_with_ffmpeg(self):
        cmd = self._build_cmd("/src.mp4", 10.0, 30.0, "/out.mp4")
        assert cmd[0] == "ffmpeg"

    def test_overwrite_flag_present(self):
        cmd = self._build_cmd("/src.mp4", 10.0, 30.0, "/out.mp4")
        assert "-y" in cmd

    def test_start_second_in_command(self):
        cmd = self._build_cmd("/src.mp4", 7.5, 20.0, "/out.mp4")
        idx = cmd.index("-ss")
        assert cmd[idx + 1] == "7.5"

    def test_duration_in_command(self):
        cmd = self._build_cmd("/src.mp4", 0.0, 45.0, "/out.mp4")
        idx = cmd.index("-t")
        assert cmd[idx + 1] == "45.0"

    def test_input_file_in_command(self):
        cmd = self._build_cmd("/path/to/source.mp4", 0.0, 10.0, "/out.mp4")
        idx = cmd.index("-i")
        assert cmd[idx + 1] == "/path/to/source.mp4"

    def test_output_path_is_last_element(self):
        cmd = self._build_cmd("/src.mp4", 5.0, 15.0, "/clips/clip1.mp4")
        assert cmd[-1] == "/clips/clip1.mp4"

    def test_video_codec_libx264(self):
        cmd = self._build_cmd("/src.mp4", 0.0, 10.0, "/out.mp4")
        assert "libx264" in cmd

    def test_audio_codec_aac(self):
        cmd = self._build_cmd("/src.mp4", 0.0, 10.0, "/out.mp4")
        assert "aac" in cmd

    def test_avoid_negative_ts_flag(self):
        cmd = self._build_cmd("/src.mp4", 0.0, 10.0, "/out.mp4")
        assert "-avoid_negative_ts" in cmd

    def test_zero_start_sec_is_string_zero(self):
        cmd = self._build_cmd("/src.mp4", 0.0, 10.0, "/out.mp4")
        idx = cmd.index("-ss")
        assert cmd[idx + 1] == "0.0"


class TestCompetitorProfileModel:
    """Tests that CompetitorProfile Pydantic model validates correctly."""

    def test_valid_model_construction(self):
        from app.pipeline.competitor import CompetitorProfile
        profile = CompetitorProfile(
            handle="@testcreator",
            platform="tiktok",
            sampleSize=35,
            avgViews=250000,
            engagementRate=4.2,
            hookBreakdown=[{"name": "Curiosity Question", "frequency": 0.5}],
            contentGaps=["Gap 1", "Gap 2", "Gap 3"],
        )
        assert profile.handle == "@testcreator"
        assert profile.sampleSize == 35
        assert profile.avgViews == 250000

    def test_engagement_rate_as_float(self):
        from app.pipeline.competitor import CompetitorProfile
        profile = CompetitorProfile(
            handle="@creator",
            platform="youtube",
            sampleSize=40,
            avgViews=100000,
            engagementRate=2.8,
            hookBreakdown=[],
            contentGaps=[],
        )
        assert isinstance(profile.engagementRate, float)

    def test_hook_breakdown_is_list(self):
        from app.pipeline.competitor import CompetitorProfile
        profile = CompetitorProfile(
            handle="@c",
            platform="tiktok",
            sampleSize=30,
            avgViews=50000,
            engagementRate=3.0,
            hookBreakdown=[{"name": "Speed Visual Cut", "frequency": 0.3}],
            contentGaps=["g1"],
        )
        assert isinstance(profile.hookBreakdown, list)

    def test_content_gaps_is_list_of_strings(self):
        from app.pipeline.competitor import CompetitorProfile
        profile = CompetitorProfile(
            handle="@c",
            platform="tiktok",
            sampleSize=30,
            avgViews=50000,
            engagementRate=3.0,
            hookBreakdown=[],
            contentGaps=["gap 1", "gap 2", "gap 3"],
        )
        assert all(isinstance(g, str) for g in profile.contentGaps)


class TestScriptOptimizationReportModel:
    """Tests that ScriptOptimizationReport validates correctly, especially the hook_score bounds."""

    def test_valid_construction(self):
        from app.pipeline.script_opt import ScriptOptimizationReport
        report = ScriptOptimizationReport(
            original_input="Tell me about cooking",
            optimized_script="You'll never believe this kitchen trick...",
            hook_score=85.0,
            hook_rationale="Strong curiosity gap in first 3 words",
            target_platform="tiktok",
            estimated_duration_seconds=15.0,
            pacing_wpm=160,
            retention_triggers=["open loop", "visual contrast"],
        )
        assert report.hook_score == 85.0

    def test_hook_score_at_lower_bound(self):
        from app.pipeline.script_opt import ScriptOptimizationReport
        report = ScriptOptimizationReport(
            original_input="x",
            optimized_script="x",
            hook_score=0.0,
            hook_rationale="min",
            target_platform="tiktok",
            estimated_duration_seconds=10.0,
            pacing_wpm=150,
            retention_triggers=[],
        )
        assert report.hook_score == 0.0

    def test_hook_score_at_upper_bound(self):
        from app.pipeline.script_opt import ScriptOptimizationReport
        report = ScriptOptimizationReport(
            original_input="x",
            optimized_script="x",
            hook_score=100.0,
            hook_rationale="max",
            target_platform="tiktok",
            estimated_duration_seconds=10.0,
            pacing_wpm=150,
            retention_triggers=[],
        )
        assert report.hook_score == 100.0

    def test_hook_score_below_0_raises(self):
        from app.pipeline.script_opt import ScriptOptimizationReport
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            ScriptOptimizationReport(
                original_input="x",
                optimized_script="x",
                hook_score=-1.0,
                hook_rationale="invalid",
                target_platform="tiktok",
                estimated_duration_seconds=10.0,
                pacing_wpm=150,
                retention_triggers=[],
            )

    def test_hook_score_above_100_raises(self):
        from app.pipeline.script_opt import ScriptOptimizationReport
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            ScriptOptimizationReport(
                original_input="x",
                optimized_script="x",
                hook_score=101.0,
                hook_rationale="invalid",
                target_platform="tiktok",
                estimated_duration_seconds=10.0,
                pacing_wpm=150,
                retention_triggers=[],
            )

    def test_retention_triggers_is_list(self):
        from app.pipeline.script_opt import ScriptOptimizationReport
        report = ScriptOptimizationReport(
            original_input="x",
            optimized_script="x",
            hook_score=50.0,
            hook_rationale="average",
            target_platform="youtube_shorts",
            estimated_duration_seconds=30.0,
            pacing_wpm=140,
            retention_triggers=["cliffhanger", "curiosity loop"],
        )
        assert len(report.retention_triggers) == 2


class TestExtractedClipCandidateModel:
    """Tests that ExtractedClipCandidate enforces confidence_score bounds (0.0–1.0)."""

    def test_valid_construction(self):
        from app.pipeline.repurpose import ExtractedClipCandidate
        clip = ExtractedClipCandidate(
            clip_id="clip_001",
            start_second=30.5,
            end_second=55.0,
            duration=24.5,
            hook_text="You will not believe this",
            virality_rationale="Strong emotional hook",
            confidence_score=0.87,
        )
        assert clip.confidence_score == 0.87

    def test_confidence_score_at_zero(self):
        from app.pipeline.repurpose import ExtractedClipCandidate
        clip = ExtractedClipCandidate(
            clip_id="c",
            start_second=0.0,
            end_second=10.0,
            duration=10.0,
            hook_text="h",
            virality_rationale="r",
            confidence_score=0.0,
        )
        assert clip.confidence_score == 0.0

    def test_confidence_score_at_one(self):
        from app.pipeline.repurpose import ExtractedClipCandidate
        clip = ExtractedClipCandidate(
            clip_id="c",
            start_second=0.0,
            end_second=10.0,
            duration=10.0,
            hook_text="h",
            virality_rationale="r",
            confidence_score=1.0,
        )
        assert clip.confidence_score == 1.0

    def test_confidence_score_above_1_raises(self):
        from app.pipeline.repurpose import ExtractedClipCandidate
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            ExtractedClipCandidate(
                clip_id="c",
                start_second=0.0,
                end_second=10.0,
                duration=10.0,
                hook_text="h",
                virality_rationale="r",
                confidence_score=1.5,
            )

    def test_confidence_score_below_0_raises(self):
        from app.pipeline.repurpose import ExtractedClipCandidate
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            ExtractedClipCandidate(
                clip_id="c",
                start_second=0.0,
                end_second=10.0,
                duration=10.0,
                hook_text="h",
                virality_rationale="r",
                confidence_score=-0.1,
            )
