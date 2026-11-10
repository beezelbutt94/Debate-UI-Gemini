import { describe, it, expect } from 'vitest';
import { getPrimaryEmail } from '@/lib/clerk-utils';
import type { ClerkUserData } from '@/lib/clerk-utils';

describe('getPrimaryEmail()', () => {
  it('returns the primary email when primary_email_address_id matches', () => {
    const data: ClerkUserData = {
      id: 'user_1',
      primary_email_address_id: 'ea_1',
      email_addresses: [
        { id: 'ea_1', email_address: 'primary@example.com' },
        { id: 'ea_2', email_address: 'other@example.com' },
      ],
    };
    expect(getPrimaryEmail(data)).toBe('primary@example.com');
  });

  it('returns the second address when primary_email_address_id points to it', () => {
    const data: ClerkUserData = {
      id: 'user_1',
      primary_email_address_id: 'ea_2',
      email_addresses: [
        { id: 'ea_1', email_address: 'first@example.com' },
        { id: 'ea_2', email_address: 'second@example.com' },
      ],
    };
    expect(getPrimaryEmail(data)).toBe('second@example.com');
  });

  it('falls back to first address when primary_email_address_id is null', () => {
    const data: ClerkUserData = {
      id: 'user_1',
      primary_email_address_id: null,
      email_addresses: [
        { id: 'ea_1', email_address: 'first@example.com' },
        { id: 'ea_2', email_address: 'second@example.com' },
      ],
    };
    expect(getPrimaryEmail(data)).toBe('first@example.com');
  });

  it('falls back to first address when primary_email_address_id is undefined', () => {
    const data: ClerkUserData = {
      id: 'user_1',
      email_addresses: [{ id: 'ea_1', email_address: 'only@example.com' }],
    };
    expect(getPrimaryEmail(data)).toBe('only@example.com');
  });

  it('falls back to first address when primary_email_address_id does not match any address', () => {
    const data: ClerkUserData = {
      id: 'user_1',
      primary_email_address_id: 'ea_nonexistent',
      email_addresses: [
        { id: 'ea_1', email_address: 'first@example.com' },
      ],
    };
    expect(getPrimaryEmail(data)).toBe('first@example.com');
  });

  it('returns null when email_addresses is empty and primary_email_address_id is set', () => {
    const data: ClerkUserData = {
      id: 'user_1',
      primary_email_address_id: 'ea_1',
      email_addresses: [],
    };
    expect(getPrimaryEmail(data)).toBeNull();
  });

  it('returns null when email_addresses is undefined', () => {
    const data: ClerkUserData = {
      id: 'user_1',
      primary_email_address_id: null,
    };
    expect(getPrimaryEmail(data)).toBeNull();
  });

  it('returns null when email_addresses is empty and no primary is set', () => {
    const data: ClerkUserData = {
      id: 'user_1',
      primary_email_address_id: null,
      email_addresses: [],
    };
    expect(getPrimaryEmail(data)).toBeNull();
  });

  it('handles single address with matching primary id', () => {
    const data: ClerkUserData = {
      id: 'user_1',
      primary_email_address_id: 'ea_42',
      email_addresses: [{ id: 'ea_42', email_address: 'solo@example.com' }],
    };
    expect(getPrimaryEmail(data)).toBe('solo@example.com');
  });

  it('handles many addresses and picks the correct primary', () => {
    const data: ClerkUserData = {
      id: 'user_1',
      primary_email_address_id: 'ea_5',
      email_addresses: [
        { id: 'ea_1', email_address: 'a@example.com' },
        { id: 'ea_2', email_address: 'b@example.com' },
        { id: 'ea_3', email_address: 'c@example.com' },
        { id: 'ea_4', email_address: 'd@example.com' },
        { id: 'ea_5', email_address: 'target@example.com' },
      ],
    };
    expect(getPrimaryEmail(data)).toBe('target@example.com');
  });

  it('returns null for a user with no email data at all', () => {
    const data: ClerkUserData = { id: 'user_1' };
    expect(getPrimaryEmail(data)).toBeNull();
  });

  it('handles email addresses with unusual but valid formats', () => {
    const data: ClerkUserData = {
      id: 'user_1',
      primary_email_address_id: 'ea_1',
      email_addresses: [{ id: 'ea_1', email_address: 'user+tag@sub.domain.co.uk' }],
    };
    expect(getPrimaryEmail(data)).toBe('user+tag@sub.domain.co.uk');
  });

  it('never returns undefined — always string or null', () => {
    const result = getPrimaryEmail({ id: 'user_1' });
    expect(result === null || typeof result === 'string').toBe(true);
  });
});
