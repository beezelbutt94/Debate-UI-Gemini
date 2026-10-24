import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PLAN_QUOTA, planFromPriceId, PLAN_PRICE_IDS } from '@/lib/stripe';

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
    for (const [, quota] of Object.entries(PLAN_QUOTA)) {
      expect(quota).toBeGreaterThan(0);
    }
  });

  it('quotas increase in tier order', () => {
    expect(PLAN_QUOTA.creator).toBeLessThan(PLAN_QUOTA.pro);
    expect(PLAN_QUOTA.pro).toBeLessThan(PLAN_QUOTA.studio);
  });
});

describe('planFromPriceId()', () => {
  const origEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...origEnv,
      STRIPE_PRICE_CREATOR: 'price_creator_test',
      STRIPE_PRICE_PRO: 'price_pro_test',
      STRIPE_PRICE_STUDIO: 'price_studio_test',
    };
  });

  afterEach(() => {
    process.env = origEnv;
  });

  it('returns null for an unknown price ID', () => {
    expect(planFromPriceId('price_unknown')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(planFromPriceId('')).toBeNull();
  });

  it('returns null for a price ID that is empty in env', () => {
    // When env var is not set, PLAN_PRICE_IDS uses '', and empty IDs are skipped
    expect(planFromPriceId('')).toBeNull();
  });
});

describe('PLAN_PRICE_IDS', () => {
  it('has exactly three keys', () => {
    expect(Object.keys(PLAN_PRICE_IDS)).toHaveLength(3);
  });

  it('keys are creator, pro, studio', () => {
    expect(PLAN_PRICE_IDS).toHaveProperty('creator');
    expect(PLAN_PRICE_IDS).toHaveProperty('pro');
    expect(PLAN_PRICE_IDS).toHaveProperty('studio');
  });
});
