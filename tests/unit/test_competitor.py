"""Tests for CompetitorProfile Pydantic model validation."""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../services/api'))

import pytest


class TestCompetitorProfile:
    @pytest.fixture(autouse=True)
    def setup(self):
        from app.pipeline.competitor import CompetitorProfile
        self.Model = CompetitorProfile

    def _valid(self, **overrides):
        defaults = dict(
            handle='@creator',
            platform='tiktok',
            sampleSize=35,
            avgViews=120000,
            engagementRate=4.5,
            hookBreakdown=[{'name': 'Contrarian Thesis', 'frequency': 0.4}],
            contentGaps=['topic A', 'topic B', 'topic C'],
        )
        defaults.update(overrides)
        return self.Model(**defaults)

    def test_valid_model(self):
        m = self._valid()
        assert m.handle == '@creator'

    def test_hook_breakdown_list(self):
        m = self._valid(hookBreakdown=[{'name': 'x', 'frequency': 1.0}])
        assert len(m.hookBreakdown) == 1

    def test_content_gaps_list(self):
        m = self._valid(contentGaps=['a', 'b'])
        assert m.contentGaps == ['a', 'b']

    def test_engagement_rate_stored(self):
        m = self._valid(engagementRate=7.3)
        assert m.engagementRate == 7.3

    def test_avg_views_stored(self):
        m = self._valid(avgViews=5_000_000)
        assert m.avgViews == 5_000_000

    def test_sample_size_stored(self):
        m = self._valid(sampleSize=50)
        assert m.sampleSize == 50
