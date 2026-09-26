import { test } from 'node:test';
import assert from 'node:assert/strict';
import { effectivePlan, isEntitledStatus, isPaidPlan, PLAN_QUOTA, planRank } from '../../lib/plans.ts';

test('free tier is distinct and smaller than every paid tier', () => {
  for (const tier of ['creator', 'pro', 'studio']) assert.ok(PLAN_QUOTA[tier] > PLAN_QUOTA.free, tier);
  assert.ok(planRank('studio') > planRank('pro') && planRank('pro') > planRank('creator') && planRank('creator') > planRank('free'));
});

test('entitlement follows Stripe status', () => {
  for (const s of ['active', 'trialing', 'past_due']) assert.equal(isEntitledStatus(s), true, s);
  for (const s of ['canceled', 'unpaid', 'incomplete', 'incomplete_expired', 'paused', null, undefined, '']) {
    assert.equal(isEntitledStatus(s), false, String(s));
  }
});

test('effectivePlan downgrades lapsed or unknown subscriptions to free', () => {
  assert.equal(effectivePlan('pro', 'active'), 'pro');
  assert.equal(effectivePlan('pro', 'past_due'), 'pro');
  assert.equal(effectivePlan('pro', 'canceled'), 'free');
  assert.equal(effectivePlan('studio', 'unpaid'), 'free');
  assert.equal(effectivePlan(null, 'active'), 'free');
});

test('isPaidPlan only accepts real paid tiers', () => {
  assert.equal(isPaidPlan('creator'), true);
  assert.equal(isPaidPlan('free'), false);
  assert.equal(isPaidPlan('enterprise'), false);
  assert.equal(isPaidPlan(undefined), false);
});
