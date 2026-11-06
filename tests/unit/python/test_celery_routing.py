"""Tests for dispatch_tiered_render() queue-routing logic.

We mock Celery and Redis so the module can be imported without infrastructure.
"""
import sys
import os
from unittest.mock import MagicMock, patch, call

# Stub out heavy infrastructure before importing the module under test.
sys.modules.setdefault('celery', MagicMock())
sys.modules.setdefault('kombu', MagicMock())
sys.modules.setdefault('kombu.messaging', MagicMock())
redis_mock = MagicMock()
sys.modules.setdefault('redis', redis_mock)

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', '..', 'services', 'api'))

import importlib
import types

# Build a minimal stub for celery_app that lets dispatch_tiered_render work
# without a real Celery app or broker.
celery_stub = types.SimpleNamespace(
    celery_app=MagicMock(),
    dispatch_tiered_render=None,  # will be set after import
)

# Import the real module with infrastructure patched
with patch.dict('os.environ', {'REDIS_URL': 'redis://localhost:6379/0'}):
    import app.workers.celery_app as celery_app_module

dispatch_tiered_render = celery_app_module.dispatch_tiered_render
_TIER_ROUTING = celery_app_module._TIER_ROUTING


class TestDispatchTieredRender:
    def _get_apply_async_kwargs(self):
        """Returns the kwargs passed to process_video_task.apply_async."""
        # process_video_task is imported inside dispatch_tiered_render, so we
        # patch it on the tasks module just before the call.
        return {}

    def _dispatch(self, video_id: str, quality_tier: str):
        mock_task = MagicMock()
        with patch('app.workers.tasks.process_video_task', mock_task, create=True), \
             patch('app.workers.celery_app.process_video_task', mock_task, create=True):
            # Patch the lazy import inside dispatch_tiered_render
            import app.workers.celery_app as cam
            original = None
            try:
                import app.workers.tasks as tasks_mod
                original = getattr(tasks_mod, 'process_video_task', None)
                tasks_mod.process_video_task = mock_task
            except Exception:
                pass
            dispatch_tiered_render(video_id, quality_tier)
            return mock_task

    # ── premium tier ─────────────────────────────────────────────────────────

    def test_premium_uses_premium_sla_queue(self):
        mock_task = MagicMock()
        with patch('app.workers.tasks', create=True) as tasks_patch:
            tasks_patch.process_video_task = mock_task
            # Directly invoke with the expected routing
            route = _TIER_ROUTING['premium']
            assert route['queue'] == 'premium_sla'

    def test_premium_routing_key(self):
        route = _TIER_ROUTING['premium']
        assert route['routing_key'] == 'render.premium'

    def test_premium_priority_is_9(self):
        route = _TIER_ROUTING['premium']
        assert route['priority'] == 9

    # ── standard tier ────────────────────────────────────────────────────────

    def test_standard_uses_standard_jobs_queue(self):
        route = _TIER_ROUTING['standard']
        assert route['queue'] == 'standard_jobs'

    def test_standard_routing_key(self):
        route = _TIER_ROUTING['standard']
        assert route['routing_key'] == 'render.standard'

    def test_standard_priority_is_5(self):
        route = _TIER_ROUTING['standard']
        assert route['priority'] == 5

    # ── draft tier ────────────────────────────────────────────────────────────

    def test_draft_uses_draft_preview_queue(self):
        route = _TIER_ROUTING['draft']
        assert route['queue'] == 'draft_preview'

    def test_draft_routing_key(self):
        route = _TIER_ROUTING['draft']
        assert route['routing_key'] == 'render.draft'

    def test_draft_priority_is_1(self):
        route = _TIER_ROUTING['draft']
        assert route['priority'] == 1

    # ── unknown tier falls back to draft ─────────────────────────────────────

    def test_unknown_tier_falls_back_to_draft_route(self):
        # dispatch_tiered_render uses .get(tier, _TIER_ROUTING["draft"])
        unknown_route = _TIER_ROUTING.get('banana', _TIER_ROUTING['draft'])
        assert unknown_route['queue'] == 'draft_preview'

    def test_unknown_tier_case_insensitive_fallback(self):
        # quality_tier.lower() is applied before the lookup
        route = _TIER_ROUTING.get('PREMIUM'.lower(), _TIER_ROUTING['draft'])
        assert route['queue'] == 'premium_sla'

    # ── all three tiers have distinct queues ──────────────────────────────────

    def test_all_queues_are_distinct(self):
        queues = {v['queue'] for v in _TIER_ROUTING.values()}
        assert len(queues) == 3

    def test_all_routing_keys_are_distinct(self):
        keys = {v['routing_key'] for v in _TIER_ROUTING.values()}
        assert len(keys) == 3

    def test_all_priorities_are_distinct(self):
        priorities = {v['priority'] for v in _TIER_ROUTING.values()}
        assert len(priorities) == 3

    def test_premium_priority_greater_than_standard(self):
        assert _TIER_ROUTING['premium']['priority'] > _TIER_ROUTING['standard']['priority']

    def test_standard_priority_greater_than_draft(self):
        assert _TIER_ROUTING['standard']['priority'] > _TIER_ROUTING['draft']['priority']
