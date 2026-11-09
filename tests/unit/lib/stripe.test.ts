import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PLAN_QUOTA } from '@/lib/stripe';

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

  it('pro has more than creator', () => {
    expect(PLAN_QUOTA.pro).toBeGreaterThan(PLAN_QUOTA.creator);
  });

  it('studio has more than pro', () => {
    expect(PLAN_QUOTA.studio).toBeGreaterThan(PLAN_QUOTA.pro);
  });
});

describe('planFromPriceId()', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.STRIPE_PRICE_CREATOR = 'price_creator_123';
    process.env.STRIPE_PRICE_PRO = 'price_pro_456';
    process.env.STRIPE_PRICE_STUDIO = 'price_studio_789';
  });

  afterEach(() => {
    Object.assign(process.env, originalEnv);
    // Restore to original state
    delete process.env.STRIPE_PRICE_CREATOR;
    delete process.env.STRIPE_PRICE_PRO;
    delete process.env.STRIPE_PRICE_STUDIO;
    if (originalEnv.STRIPE_PRICE_CREATOR) process.env.STRIPE_PRICE_CREATOR = originalEnv.STRIPE_PRICE_CREATOR;
    if (originalEnv.STRIPE_PRICE_PRO) process.env.STRIPE_PRICE_PRO = originalEnv.STRIPE_PRICE_PRO;
    if (originalEnv.STRIPE_PRICE_STUDIO) process.env.STRIPE_PRICE_STUDIO = originalEnv.STRIPE_PRICE_STUDIO;
  });

  it('returns null for empty string priceId (guards empty env vars)', async () => {
    // Re-import with known-empty env vars
    // planFromPriceId uses PLAN_PRICE_IDS which is set at module load time,
    // so we test via the module's exported constant behavior
    const { planFromPriceId } = await import('@/lib/stripe');
    expect(planFromPriceId('')).toBeNull();
  });

  it('returns null for an unknown priceId', async () => {
    const { planFromPriceId } = await import('@/lib/stripe');
    expect(planFromPriceId('price_does_not_exist')).toBeNull();
  });
});

describe('getStripe()', () => {
  it('throws when STRIPE_SECRET_KEY is not set', async () => {
    const savedKey = process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_SECRET_KEY;
    try {
      const { getStripe } = await import('@/lib/stripe');
      expect(() => getStripe()).toThrow('STRIPE_SECRET_KEY is not configured.');
    } finally {
      if (savedKey) process.env.STRIPE_SECRET_KEY = savedKey;
    }
  });
});
