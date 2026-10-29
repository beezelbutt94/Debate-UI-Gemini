import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PLAN_QUOTA } from '@/lib/stripe';

// planFromPriceId depends on environment variables at module-load time.
// We test it by setting env vars before importing.

describe('PLAN_QUOTA', () => {
  it('creator plan has quota of 10', () => {
    expect(PLAN_QUOTA.creator).toBe(10);
  });

  it('pro plan has quota of 50', () => {
    expect(PLAN_QUOTA.pro).toBe(50);
  });

  it('studio plan has quota of 200', () => {
    expect(PLAN_QUOTA.studio).toBe(200);
  });

  it('creator quota is less than pro', () => {
    expect(PLAN_QUOTA.creator).toBeLessThan(PLAN_QUOTA.pro);
  });

  it('pro quota is less than studio', () => {
    expect(PLAN_QUOTA.pro).toBeLessThan(PLAN_QUOTA.studio);
  });

  it('all quota values are positive integers', () => {
    for (const [, quota] of Object.entries(PLAN_QUOTA)) {
      expect(quota).toBeGreaterThan(0);
      expect(Number.isInteger(quota)).toBe(true);
    }
  });
});

describe('planFromPriceId', () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    // Reset env before each test
    process.env.STRIPE_PRICE_CREATOR = 'price_creator_test';
    process.env.STRIPE_PRICE_PRO = 'price_pro_test';
    process.env.STRIPE_PRICE_STUDIO = 'price_studio_test';
  });

  afterEach(() => {
    Object.assign(process.env, ORIGINAL_ENV);
  });

  it('returns null for unknown price id', async () => {
    // Dynamic import so we pick up the env vars set in beforeEach.
    const { planFromPriceId, PLAN_PRICE_IDS } = await import('@/lib/stripe');
    // Override PLAN_PRICE_IDS at runtime (since it was loaded at module init)
    // by testing the function directly with the known mapping.
    // Since PLAN_PRICE_IDS is read at module load time using process.env,
    // we test the logic by checking an id that is definitely not there.
    expect(planFromPriceId('price_definitely_not_real')).toBeNull();
  });

  it('all plan keys are present in PLAN_PRICE_IDS', async () => {
    const { PLAN_PRICE_IDS } = await import('@/lib/stripe');
    expect('creator' in PLAN_PRICE_IDS).toBe(true);
    expect('pro' in PLAN_PRICE_IDS).toBe(true);
    expect('studio' in PLAN_PRICE_IDS).toBe(true);
  });
});

describe('PLAN_QUOTA tiers ordering', () => {
  it('quotas increase from creator → pro → studio', () => {
    expect(PLAN_QUOTA.creator < PLAN_QUOTA.pro).toBe(true);
    expect(PLAN_QUOTA.pro < PLAN_QUOTA.studio).toBe(true);
  });
});
