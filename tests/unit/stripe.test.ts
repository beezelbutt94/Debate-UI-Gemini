import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PLAN_QUOTA } from '@/lib/stripe';

describe('PLAN_QUOTA', () => {
  it('creator tier has quota of 10', () => {
    expect(PLAN_QUOTA.creator).toBe(10);
  });

  it('pro tier has quota of 50', () => {
    expect(PLAN_QUOTA.pro).toBe(50);
  });

  it('studio tier has quota of 200', () => {
    expect(PLAN_QUOTA.studio).toBe(200);
  });

  it('all tiers have positive integer quotas', () => {
    for (const [, quota] of Object.entries(PLAN_QUOTA)) {
      expect(Number.isInteger(quota)).toBe(true);
      expect(quota).toBeGreaterThan(0);
    }
  });

  it('quotas are ordered creator < pro < studio', () => {
    expect(PLAN_QUOTA.creator).toBeLessThan(PLAN_QUOTA.pro);
    expect(PLAN_QUOTA.pro).toBeLessThan(PLAN_QUOTA.studio);
  });
});

/**
 * planFromPriceId reads PLAN_PRICE_IDS which is initialized from env vars
 * at module evaluation time. To test it with real IDs, we must stub env vars
 * BEFORE the module is imported by resetting the module registry.
 */
describe('planFromPriceId() — with stubbed env', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('STRIPE_PRICE_CREATOR', 'price_creator_test123');
    vi.stubEnv('STRIPE_PRICE_PRO', 'price_pro_test456');
    vi.stubEnv('STRIPE_PRICE_STUDIO', 'price_studio_test789');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns "creator" for the creator price ID', async () => {
    const { planFromPriceId } = await import('@/lib/stripe');
    expect(planFromPriceId('price_creator_test123')).toBe('creator');
  });

  it('returns "pro" for the pro price ID', async () => {
    const { planFromPriceId } = await import('@/lib/stripe');
    expect(planFromPriceId('price_pro_test456')).toBe('pro');
  });

  it('returns "studio" for the studio price ID', async () => {
    const { planFromPriceId } = await import('@/lib/stripe');
    expect(planFromPriceId('price_studio_test789')).toBe('studio');
  });

  it('returns null for an unknown price ID', async () => {
    const { planFromPriceId } = await import('@/lib/stripe');
    expect(planFromPriceId('price_unknown_000')).toBeNull();
  });

  it('returns null for an empty string', async () => {
    const { planFromPriceId } = await import('@/lib/stripe');
    expect(planFromPriceId('')).toBeNull();
  });

  it('returns null for a price ID that is a prefix of a real one', async () => {
    const { planFromPriceId } = await import('@/lib/stripe');
    expect(planFromPriceId('price_creator')).toBeNull();
  });

  it('is case-sensitive (uppercase does not match)', async () => {
    const { planFromPriceId } = await import('@/lib/stripe');
    expect(planFromPriceId('PRICE_CREATOR_TEST123')).toBeNull();
  });
});

describe('planFromPriceId() — without env vars', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('STRIPE_PRICE_CREATOR', '');
    vi.stubEnv('STRIPE_PRICE_PRO', '');
    vi.stubEnv('STRIPE_PRICE_STUDIO', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns null for any price ID when env vars are empty', async () => {
    const { planFromPriceId } = await import('@/lib/stripe');
    expect(planFromPriceId('price_anything')).toBeNull();
  });

  it('does not match empty string env var to empty string price id', async () => {
    const { planFromPriceId } = await import('@/lib/stripe');
    // '' is falsy, so the filter `id && id === priceId` skips it
    expect(planFromPriceId('')).toBeNull();
  });
});
