"""Tests for Pydantic models in the pipeline layer.

Covers:
- ScriptOptimizationReport (app.pipeline.script_opt)
- ExtractedClipCandidate   (app.pipeline.repurpose)
- StoryboardScene          (app.pipeline.storyboard)

These are data-only models; no LLM or external calls are needed.
"""
import os
import sys

import pytest
from pydantic import ValidationError

_API_ROOT = os.path.join(os.path.dirname(__file__), "..")
if _API_ROOT not in sys.path:
    sys.path.insert(0, _API_ROOT)

from app.pipeline.script_opt import ScriptOptimizationReport
from app.pipeline.repurpose import ExtractedClipCandidate
from app.pipeline.storyboard import StoryboardScene


# ---------------------------------------------------------------------------
# ScriptOptimizationReport
# ---------------------------------------------------------------------------

_VALID_SCRIPT_OPT = {
    "original_input": "Talk about morning routines",
    "optimized_script": "Stop sleeping in. Here's why your mornings are broken.",
    "hook_score": 87.5,
    "hook_rationale": "Contrarian opener triggers curiosity",
    "target_platform": "tiktok",
    "estimated_duration_seconds": 15.0,
    "pacing_wpm": 155,
    "retention_triggers": ["pattern interrupt", "open loop"],
}


class TestScriptOptimizationReport:
    def test_valid_data_creates_model(self):
        report = ScriptOptimizationReport(**_VALID_SCRIPT_OPT)
        assert report.hook_score == 87.5

    def test_hook_score_at_zero(self):
        data = {**_VALID_SCRIPT_OPT, "hook_score": 0.0}
        report = ScriptOptimizationReport(**data)
        assert report.hook_score == 0.0

    def test_hook_score_at_100(self):
        data = {**_VALID_SCRIPT_OPT, "hook_score": 100.0}
        report = ScriptOptimizationReport(**data)
        assert report.hook_score == 100.0

    def test_hook_score_above_100_raises(self):
        data = {**_VALID_SCRIPT_OPT, "hook_score": 100.1}
        with pytest.raises(ValidationError):
            ScriptOptimizationReport(**data)

    def test_hook_score_below_0_raises(self):
        data = {**_VALID_SCRIPT_OPT, "hook_score": -0.1}
        with pytest.raises(ValidationError):
            ScriptOptimizationReport(**data)

    def test_missing_required_field_raises(self):
        data = {k: v for k, v in _VALID_SCRIPT_OPT.items() if k != "optimized_script"}
        with pytest.raises(ValidationError):
            ScriptOptimizationReport(**data)

    def test_retention_triggers_is_list(self):
        report = ScriptOptimizationReport(**_VALID_SCRIPT_OPT)
        assert isinstance(report.retention_triggers, list)

    def test_empty_retention_triggers_allowed(self):
        data = {**_VALID_SCRIPT_OPT, "retention_triggers": []}
        report = ScriptOptimizationReport(**data)
        assert report.retention_triggers == []

    def test_int_hook_score_coerced_to_float(self):
        data = {**_VALID_SCRIPT_OPT, "hook_score": 75}
        report = ScriptOptimizationReport(**data)
        assert report.hook_score == 75.0

    def test_pacing_wpm_stored_correctly(self):
        report = ScriptOptimizationReport(**_VALID_SCRIPT_OPT)
        assert report.pacing_wpm == 155

    def test_target_platform_stored(self):
        report = ScriptOptimizationReport(**_VALID_SCRIPT_OPT)
        assert report.target_platform == "tiktok"


# ---------------------------------------------------------------------------
# ExtractedClipCandidate
# ---------------------------------------------------------------------------

_VALID_CLIP = {
    "clip_id": "clip_001",
    "start_second": 12.5,
    "end_second": 47.0,
    "duration": 34.5,
    "hook_text": "This one trick doubled my views overnight.",
    "virality_rationale": "Contrarian thesis, strong emotional hook",
    "confidence_score": 0.91,
}


class TestExtractedClipCandidate:
    def test_valid_data_creates_model(self):
        candidate = ExtractedClipCandidate(**_VALID_CLIP)
        assert candidate.clip_id == "clip_001"

    def test_confidence_score_at_zero(self):
        data = {**_VALID_CLIP, "confidence_score": 0.0}
        candidate = ExtractedClipCandidate(**data)
        assert candidate.confidence_score == 0.0

    def test_confidence_score_at_one(self):
        data = {**_VALID_CLIP, "confidence_score": 1.0}
        candidate = ExtractedClipCandidate(**data)
        assert candidate.confidence_score == 1.0

    def test_confidence_score_above_1_raises(self):
        data = {**_VALID_CLIP, "confidence_score": 1.001}
        with pytest.raises(ValidationError):
            ExtractedClipCandidate(**data)

    def test_confidence_score_below_0_raises(self):
        data = {**_VALID_CLIP, "confidence_score": -0.001}
        with pytest.raises(ValidationError):
            ExtractedClipCandidate(**data)

    def test_missing_clip_id_raises(self):
        data = {k: v for k, v in _VALID_CLIP.items() if k != "clip_id"}
        with pytest.raises(ValidationError):
            ExtractedClipCandidate(**data)

    def test_start_second_stored(self):
        candidate = ExtractedClipCandidate(**_VALID_CLIP)
        assert candidate.start_second == 12.5

    def test_end_second_stored(self):
        candidate = ExtractedClipCandidate(**_VALID_CLIP)
        assert candidate.end_second == 47.0

    def test_duration_stored(self):
        candidate = ExtractedClipCandidate(**_VALID_CLIP)
        assert candidate.duration == 34.5

    def test_hook_text_stored(self):
        candidate = ExtractedClipCandidate(**_VALID_CLIP)
        assert "doubled" in candidate.hook_text

    def test_confidence_score_exactly_half(self):
        data = {**_VALID_CLIP, "confidence_score": 0.5}
        candidate = ExtractedClipCandidate(**data)
        assert candidate.confidence_score == 0.5


# ---------------------------------------------------------------------------
# StoryboardScene
# ---------------------------------------------------------------------------

_VALID_SCENE = {
    "scene_num": 1,
    "duration_seconds": 3.0,
    "voiceover": "Stop scrolling. This is the habit that changed my life.",
    "visual_direction": "Close-up of a notebook being opened dramatically",
    "camera_motion": "zoom_in",
    "text_overlay": "The #1 Habit",
    "vibe": "energetic",
}


class TestStoryboardScene:
    def test_valid_scene_created(self):
        scene = StoryboardScene(**_VALID_SCENE)
        assert scene.scene_num == 1

    def test_duration_at_minimum_boundary(self):
        # Field(gt=0.5) means strictly greater than 0.5
        data = {**_VALID_SCENE, "duration_seconds": 0.6}
        scene = StoryboardScene(**data)
        assert scene.duration_seconds == 0.6

    def test_duration_at_exactly_0_5_raises(self):
        # gt=0.5 means > 0.5; 0.5 itself is not allowed
        data = {**_VALID_SCENE, "duration_seconds": 0.5}
        with pytest.raises(ValidationError):
            StoryboardScene(**data)

    def test_duration_below_minimum_raises(self):
        data = {**_VALID_SCENE, "duration_seconds": 0.1}
        with pytest.raises(ValidationError):
            StoryboardScene(**data)

    def test_duration_at_maximum(self):
        # le=10.0 means <= 10.0; exactly 10.0 is allowed
        data = {**_VALID_SCENE, "duration_seconds": 10.0}
        scene = StoryboardScene(**data)
        assert scene.duration_seconds == 10.0

    def test_duration_above_maximum_raises(self):
        data = {**_VALID_SCENE, "duration_seconds": 10.1}
        with pytest.raises(ValidationError):
            StoryboardScene(**data)

    def test_text_overlay_optional_none(self):
        data = {**_VALID_SCENE, "text_overlay": None}
        scene = StoryboardScene(**data)
        assert scene.text_overlay is None

    def test_text_overlay_optional_missing(self):
        data = {k: v for k, v in _VALID_SCENE.items() if k != "text_overlay"}
        scene = StoryboardScene(**data)
        assert scene.text_overlay is None

    def test_camera_motion_stored(self):
        scene = StoryboardScene(**_VALID_SCENE)
        assert scene.camera_motion == "zoom_in"

    def test_vibe_stored(self):
        scene = StoryboardScene(**_VALID_SCENE)
        assert scene.vibe == "energetic"

    def test_missing_required_voiceover_raises(self):
        data = {k: v for k, v in _VALID_SCENE.items() if k != "voiceover"}
        with pytest.raises(ValidationError):
            StoryboardScene(**data)

    def test_scene_num_of_zero_is_valid(self):
        data = {**_VALID_SCENE, "scene_num": 0}
        scene = StoryboardScene(**data)
        assert scene.scene_num == 0

    def test_large_scene_num_is_valid(self):
        data = {**_VALID_SCENE, "scene_num": 999}
        scene = StoryboardScene(**data)
        assert scene.scene_num == 999
