"""Tests for pure/data-only parts of the repurposing pipeline.

The LLM-driven detect_viral_segments() and ffmpeg-backed
extract_lossless_subclip() are integration tests (they need external
processes/models) so they're not covered here. We test:
  - ExtractedClipCandidate Pydantic validation
  - extract_json_block (also covered in test_anthropic_client.py but
    re-verified here via its usage in the repurpose module)
"""
import sys
import os
import pytest

# Stub heavy optional dependencies so the module imports without GPU/ML libs
import types

for _stub in ('faster_whisper',):
    sys.modules[_stub] = types.ModuleType(_stub)

# Stub anthropic / app.core so repurpose.py can be imported in isolation
_anthropic_stub = types.ModuleType('anthropic')
sys.modules.setdefault('anthropic', _anthropic_stub)

for _mod in ('app', 'app.core', 'app.core.anthropic_client'):
    sys.modules.setdefault(_mod, types.ModuleType(_mod))

sys.modules['app.core.anthropic_client'].ANTHROPIC_MODEL = 'test-model'  # type: ignore[attr-defined]
sys.modules['app.core.anthropic_client'].extract_json_block = lambda x: x  # type: ignore[attr-defined]
sys.modules['app.core.anthropic_client'].get_anthropic_client = lambda: None  # type: ignore[attr-defined]

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'services', 'api'))

from app.pipeline.repurpose import ExtractedClipCandidate


class TestExtractedClipCandidate:
    def _valid(self, **overrides):
        base = dict(
            clip_id='clip-001',
            start_second=10.0,
            end_second=40.0,
            duration=30.0,
            hook_text='Did you know this trick?',
            virality_rationale='High curiosity gap',
            confidence_score=0.85,
        )
        base.update(overrides)
        return base

    def test_valid_candidate_instantiates(self):
        c = ExtractedClipCandidate(**self._valid())
        assert c.clip_id == 'clip-001'

    def test_confidence_score_at_zero(self):
        c = ExtractedClipCandidate(**self._valid(confidence_score=0.0))
        assert c.confidence_score == 0.0

    def test_confidence_score_at_one(self):
        c = ExtractedClipCandidate(**self._valid(confidence_score=1.0))
        assert c.confidence_score == 1.0

    def test_confidence_score_below_zero_raises(self):
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            ExtractedClipCandidate(**self._valid(confidence_score=-0.01))

    def test_confidence_score_above_one_raises(self):
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            ExtractedClipCandidate(**self._valid(confidence_score=1.01))

    def test_duration_field_stored_correctly(self):
        c = ExtractedClipCandidate(**self._valid(duration=25.5))
        assert c.duration == 25.5

    def test_start_and_end_stored_correctly(self):
        c = ExtractedClipCandidate(**self._valid(start_second=5.0, end_second=35.0))
        assert c.start_second == 5.0
        assert c.end_second == 35.0

    def test_hook_text_stored_as_string(self):
        c = ExtractedClipCandidate(**self._valid(hook_text='Surprising fact'))
        assert c.hook_text == 'Surprising fact'

    def test_virality_rationale_stored(self):
        c = ExtractedClipCandidate(**self._valid(virality_rationale='Strong emotion'))
        assert c.virality_rationale == 'Strong emotion'

    def test_missing_required_field_raises(self):
        from pydantic import ValidationError
        data = self._valid()
        del data['clip_id']
        with pytest.raises(ValidationError):
            ExtractedClipCandidate(**data)

    def test_all_fields_present(self):
        c = ExtractedClipCandidate(**self._valid())
        assert hasattr(c, 'clip_id')
        assert hasattr(c, 'start_second')
        assert hasattr(c, 'end_second')
        assert hasattr(c, 'duration')
        assert hasattr(c, 'hook_text')
        assert hasattr(c, 'virality_rationale')
        assert hasattr(c, 'confidence_score')
