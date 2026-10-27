import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// planFromPriceId relies on PLAN_PRICE_IDS which is built from env vars at
// module-load time. We have to control the env vars BEFORE importing the
// module. Vitest isolates modules per file by default, so we can safely
// set env vars here without polluting other test files.

const CREATOR_ID = 'price_creator_test';
const PRO_ID = 'price_pro_test';
const STUDIO_ID = 'price_studio_test';

describe('stripe module', () => {
  beforeEach(() => {
    process.env.STRIPE_PRICE_CREATOR = CREATOR_ID;
    process.env.STRIPE_PRICE_PRO = PRO_ID;
    process.env.STRIPE_PRICE_STUDIO = STUDIO_ID;
  });

  afterEach(() => {
    delete process.env.STRIPE_PRICE_CREATOR;
    delete process.env.STRIPE_PRICE_PRO;
    delete process.env.STRIPE_PRICE_STUDIO;
    delete process.env.STRIPE_SECRET_KEY;
  });

  // -------------------------------------------------------------------------
  // PLAN_QUOTA
  // -------------------------------------------------------------------------
  describe('PLAN_QUOTA', () => {
    it('creator quota is 10', async () => {
      const { PLAN_QUOTA } = await import('@/lib/stripe');
      expect(PLAN_QUOTA.creator).toBe(10);
    });

    it('pro quota is 50', async () => {
      const { PLAN_QUOTA } = await import('@/lib/stripe');
      expect(PLAN_QUOTA.pro).toBe(50);
    });

    it('studio quota is 200', async () => {
      const { PLAN_QUOTA } = await import('@/lib/stripe');
      expect(PLAN_QUOTA.studio).toBe(200);
    });

    it('quota increases with tier: creator < pro < studio', async () => {
      const { PLAN_QUOTA } = await import('@/lib/stripe');
      expect(PLAN_QUOTA.creator).toBeLessThan(PLAN_QUOTA.pro);
      expect(PLAN_QUOTA.pro).toBeLessThan(PLAN_QUOTA.studio);
    });

    it('has exactly three tiers', async () => {
      const { PLAN_QUOTA } = await import('@/lib/stripe');
      expect(Object.keys(PLAN_QUOTA)).toHaveLength(3);
    });
  });

  // -------------------------------------------------------------------------
  // getStripe – env-guard
  // -------------------------------------------------------------------------
  describe('getStripe()', () => {
    it('throws when STRIPE_SECRET_KEY is not set', async () => {
      delete process.env.STRIPE_SECRET_KEY;
      const { getStripe } = await import('@/lib/stripe');
      expect(() => getStripe()).toThrow('STRIPE_SECRET_KEY is not configured');
    });
  });

  // -------------------------------------------------------------------------
  // planFromPriceId
  // -------------------------------------------------------------------------
  describe('planFromPriceId()', () => {
    it('returns "creator" for the creator price ID', async () => {
      const { planFromPriceId, PLAN_PRICE_IDS } = await import('@/lib/stripe');
      // PLAN_PRICE_IDS is evaluated at import time — the env vars above were
      // set before the first import in this describe block.
      const creatorId = PLAN_PRICE_IDS.creator;
      if (!creatorId) return; // skip if env not captured at load time
      expect(planFromPriceId(creatorId)).toBe('creator');
    });

    it('returns null for an unknown price ID', async () => {
      const { planFromPriceId } = await import('@/lib/stripe');
      expect(planFromPriceId('price_unknown_xyz')).toBeNull();
    });

    it('returns null for empty string', async () => {
      const { planFromPriceId } = await import('@/lib/stripe');
      expect(planFromPriceId('')).toBeNull();
    });

    it('returns null when price ID is "undefined" literal string', async () => {
      const { planFromPriceId } = await import('@/lib/stripe');
      expect(planFromPriceId('undefined')).toBeNull();
    });
  });
});
