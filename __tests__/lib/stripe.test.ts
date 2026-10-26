import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PLAN_QUOTA, PLAN_PRICE_IDS, planFromPriceId } from '@/lib/stripe';
import type { PlanTier } from '@/lib/stripe';

describe('PLAN_QUOTA', () => {
  it('creator tier has 10 analyses', () => {
    expect(PLAN_QUOTA.creator).toBe(10);
  });

  it('pro tier has 50 analyses', () => {
    expect(PLAN_QUOTA.pro).toBe(50);
  });

  it('studio tier has 200 analyses', () => {
    expect(PLAN_QUOTA.studio).toBe(200);
  });

  it('all tiers are positive numbers', () => {
    for (const tier of ['creator', 'pro', 'studio'] as PlanTier[]) {
      expect(PLAN_QUOTA[tier]).toBeGreaterThan(0);
    }
  });

  it('quotas are in ascending order: creator < pro < studio', () => {
    expect(PLAN_QUOTA.creator).toBeLessThan(PLAN_QUOTA.pro);
    expect(PLAN_QUOTA.pro).toBeLessThan(PLAN_QUOTA.studio);
  });
});

describe('planFromPriceId', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      STRIPE_PRICE_CREATOR: 'price_creator_test',
      STRIPE_PRICE_PRO: 'price_pro_test',
      STRIPE_PRICE_STUDIO: 'price_studio_test',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns null for an unknown price id', () => {
    expect(planFromPriceId('price_unknown_xyz')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(planFromPriceId('')).toBeNull();
  });

  it('returns null for a random string', () => {
    expect(planFromPriceId('not-a-price-id')).toBeNull();
  });

  it('all three tiers are defined in the PLAN_PRICE_IDS map', () => {
    expect(Object.keys(PLAN_PRICE_IDS)).toContain('creator');
    expect(Object.keys(PLAN_PRICE_IDS)).toContain('pro');
    expect(Object.keys(PLAN_PRICE_IDS)).toContain('studio');
  });

  it('price IDs from env are strings (may be empty if env not set)', () => {
    for (const [, id] of Object.entries(PLAN_PRICE_IDS)) {
      expect(typeof id).toBe('string');
    }
  });
});
