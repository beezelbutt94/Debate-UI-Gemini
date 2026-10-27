import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * Tests the getStripe() caching and planFromPriceId() empty-id branch.
 * Uses vi.mock to avoid requiring a real Stripe API key.
 */

vi.mock('stripe', () => {
  class MockStripe {
    _mock = true;
    constructor(_key: string, _opts: unknown) {}
  }
  return { default: MockStripe };
});

describe('getStripe() – caching', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.STRIPE_SECRET_KEY = 'sk_test_mock_key';
  });

  afterEach(() => {
    delete process.env.STRIPE_SECRET_KEY;
    vi.resetModules();
  });

  it('returns a Stripe instance when key is set', async () => {
    const { getStripe } = await import('@/lib/stripe');
    const instance = getStripe();
    expect(instance).toBeDefined();
  });

  it('returns the same cached instance on repeated calls', async () => {
    const { getStripe } = await import('@/lib/stripe');
    const a = getStripe();
    const b = getStripe();
    expect(a).toBe(b);
  });
});

describe('planFromPriceId() – empty price ID branch', () => {
  beforeEach(() => {
    vi.resetModules();
    // Leave price env vars unset → PLAN_PRICE_IDS values will be ''
    delete process.env.STRIPE_PRICE_CREATOR;
    delete process.env.STRIPE_PRICE_PRO;
    delete process.env.STRIPE_PRICE_STUDIO;
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('returns null when all price IDs are empty (empty-string guard in find)', async () => {
    const { planFromPriceId } = await import('@/lib/stripe');
    // All PLAN_PRICE_IDS are '' because env vars aren't set;
    // the `id && id === priceId` guard short-circuits on empty id.
    expect(planFromPriceId('price_any')).toBeNull();
  });

  it('returns null for empty string price ID with empty env vars', async () => {
    const { planFromPriceId } = await import('@/lib/stripe');
    expect(planFromPriceId('')).toBeNull();
  });
});
