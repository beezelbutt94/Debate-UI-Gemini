import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { planFromPriceId, PLAN_QUOTA } from '@/lib/stripe';

describe('PLAN_QUOTA', () => {
  it('creator quota is 10', () => {
    expect(PLAN_QUOTA.creator).toBe(10);
  });

  it('pro quota is 50', () => {
    expect(PLAN_QUOTA.pro).toBe(50);
  });

  it('studio quota is 200', () => {
    expect(PLAN_QUOTA.studio).toBe(200);
  });

  it('studio > pro > creator', () => {
    expect(PLAN_QUOTA.studio).toBeGreaterThan(PLAN_QUOTA.pro);
    expect(PLAN_QUOTA.pro).toBeGreaterThan(PLAN_QUOTA.creator);
  });
});

describe('planFromPriceId', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      STRIPE_PRICE_CREATOR: 'price_creator_123',
      STRIPE_PRICE_PRO: 'price_pro_456',
      STRIPE_PRICE_STUDIO: 'price_studio_789',
    };
    // Re-import to pick up the new env values — but since the module
    // resolves PLAN_PRICE_IDS at import time, we use a workaround:
    // planFromPriceId() reads PLAN_PRICE_IDS which references the env vars
    // at module load. We must test the exported function's logic separately.
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns null for an unknown price ID', () => {
    expect(planFromPriceId('price_unknown')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(planFromPriceId('')).toBeNull();
  });

  it('returns null when no env variables are set (empty strings)', () => {
    // PLAN_PRICE_IDS falls back to '' when env var is absent — the guard
    // `id && id === priceId` rejects empty strings
    expect(planFromPriceId('')).toBeNull();
  });
});
