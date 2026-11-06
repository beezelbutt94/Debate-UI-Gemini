import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PLAN_QUOTA } from '@/lib/stripe';

// ─── PLAN_QUOTA ───────────────────────────────────────────────────────────────

describe('PLAN_QUOTA', () => {
  it('creator tier has quota 10', () => {
    expect(PLAN_QUOTA.creator).toBe(10);
  });

  it('pro tier has quota 50', () => {
    expect(PLAN_QUOTA.pro).toBe(50);
  });

  it('studio tier has quota 200', () => {
    expect(PLAN_QUOTA.studio).toBe(200);
  });

  it('creator quota is strictly less than pro quota', () => {
    expect(PLAN_QUOTA.creator).toBeLessThan(PLAN_QUOTA.pro);
  });

  it('pro quota is strictly less than studio quota', () => {
    expect(PLAN_QUOTA.pro).toBeLessThan(PLAN_QUOTA.studio);
  });

  it('all quotas are positive integers', () => {
    for (const quota of Object.values(PLAN_QUOTA)) {
      expect(quota).toBeGreaterThan(0);
      expect(Number.isInteger(quota)).toBe(true);
    }
  });
});

// ─── planFromPriceId ─────────────────────────────────────────────────────────
// PLAN_PRICE_IDS is evaluated at module-load time from env vars,
// so each test resets the module registry and re-imports with preset vars.

describe('planFromPriceId()', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  async function loadWithPriceEnv(prices: {
    creator?: string;
    pro?: string;
    studio?: string;
  }) {
    const saved = {
      creator: process.env.STRIPE_PRICE_CREATOR,
      pro: process.env.STRIPE_PRICE_PRO,
      studio: process.env.STRIPE_PRICE_STUDIO,
    };
    if (prices.creator !== undefined) process.env.STRIPE_PRICE_CREATOR = prices.creator;
    if (prices.pro !== undefined) process.env.STRIPE_PRICE_PRO = prices.pro;
    if (prices.studio !== undefined) process.env.STRIPE_PRICE_STUDIO = prices.studio;

    const { planFromPriceId } = await import('@/lib/stripe');

    // Restore so we don't leak between tests
    if (saved.creator === undefined) delete process.env.STRIPE_PRICE_CREATOR;
    else process.env.STRIPE_PRICE_CREATOR = saved.creator;
    if (saved.pro === undefined) delete process.env.STRIPE_PRICE_PRO;
    else process.env.STRIPE_PRICE_PRO = saved.pro;
    if (saved.studio === undefined) delete process.env.STRIPE_PRICE_STUDIO;
    else process.env.STRIPE_PRICE_STUDIO = saved.studio;

    return planFromPriceId;
  }

  it('returns "creator" for the creator price ID', async () => {
    const fn = await loadWithPriceEnv({ creator: 'price_creator_abc', pro: 'price_pro_abc', studio: 'price_studio_abc' });
    expect(fn('price_creator_abc')).toBe('creator');
  });

  it('returns "pro" for the pro price ID', async () => {
    const fn = await loadWithPriceEnv({ creator: 'price_creator_abc', pro: 'price_pro_abc', studio: 'price_studio_abc' });
    expect(fn('price_pro_abc')).toBe('pro');
  });

  it('returns "studio" for the studio price ID', async () => {
    const fn = await loadWithPriceEnv({ creator: 'price_creator_abc', pro: 'price_pro_abc', studio: 'price_studio_abc' });
    expect(fn('price_studio_abc')).toBe('studio');
  });

  it('returns null for an unrecognised price ID', async () => {
    const fn = await loadWithPriceEnv({ creator: 'price_a', pro: 'price_b', studio: 'price_c' });
    expect(fn('price_unknown_xyz')).toBeNull();
  });

  it('returns null when all price IDs are empty strings', async () => {
    const fn = await loadWithPriceEnv({ creator: '', pro: '', studio: '' });
    expect(fn('')).toBeNull();
  });

  it('returns null when price IDs are unset (env var absent)', async () => {
    delete process.env.STRIPE_PRICE_CREATOR;
    delete process.env.STRIPE_PRICE_PRO;
    delete process.env.STRIPE_PRICE_STUDIO;
    const { planFromPriceId } = await import('@/lib/stripe');
    expect(planFromPriceId('price_anything')).toBeNull();
  });

  it('does not match a prefix of a price ID', async () => {
    const fn = await loadWithPriceEnv({ creator: 'price_full_id', pro: 'price_b', studio: 'price_c' });
    expect(fn('price_full')).toBeNull();
  });

  it('is case-sensitive (does not match wrong case)', async () => {
    const fn = await loadWithPriceEnv({ creator: 'PRICE_CREATOR', pro: 'price_b', studio: 'price_c' });
    expect(fn('price_creator')).toBeNull();
  });
});
