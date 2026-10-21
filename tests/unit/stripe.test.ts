import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('PLAN_QUOTA', () => {
  it('has correct quota limits per plan tier', async () => {
    const { PLAN_QUOTA } = await import('@/lib/stripe');
    expect(PLAN_QUOTA.creator).toBe(10);
    expect(PLAN_QUOTA.pro).toBe(50);
    expect(PLAN_QUOTA.studio).toBe(200);
  });

  it('includes all three expected tiers', async () => {
    const { PLAN_QUOTA } = await import('@/lib/stripe');
    expect(Object.keys(PLAN_QUOTA)).toEqual(expect.arrayContaining(['creator', 'pro', 'studio']));
  });
});

describe('planFromPriceId()', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.STRIPE_PRICE_CREATOR;
    delete process.env.STRIPE_PRICE_PRO;
    delete process.env.STRIPE_PRICE_STUDIO;
  });

  it('returns the matching plan tier when env vars are set', async () => {
    process.env.STRIPE_PRICE_CREATOR = 'price_creator_test';
    process.env.STRIPE_PRICE_PRO = 'price_pro_test';
    process.env.STRIPE_PRICE_STUDIO = 'price_studio_test';
    const { planFromPriceId } = await import('@/lib/stripe');
    expect(planFromPriceId('price_creator_test')).toBe('creator');
    expect(planFromPriceId('price_pro_test')).toBe('pro');
    expect(planFromPriceId('price_studio_test')).toBe('studio');
  });

  it('returns null for an unknown price id', async () => {
    process.env.STRIPE_PRICE_CREATOR = 'price_creator_test';
    const { planFromPriceId } = await import('@/lib/stripe');
    expect(planFromPriceId('price_unknown')).toBeNull();
  });

  it('returns null when env vars are not set', async () => {
    const { planFromPriceId } = await import('@/lib/stripe');
    expect(planFromPriceId('anything')).toBeNull();
  });

  it('does not match empty string price ids', async () => {
    const { planFromPriceId } = await import('@/lib/stripe');
    // With env vars unset, PLAN_PRICE_IDS values are '' — must not match ''
    expect(planFromPriceId('')).toBeNull();
  });
});

describe('getStripe()', () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.STRIPE_SECRET_KEY;
  });

  afterEach(() => {
    delete process.env.STRIPE_SECRET_KEY;
  });

  it('throws when STRIPE_SECRET_KEY is not set', async () => {
    const { getStripe } = await import('@/lib/stripe');
    expect(() => getStripe()).toThrow('STRIPE_SECRET_KEY is not configured.');
  });
});
