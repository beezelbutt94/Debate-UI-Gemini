import { randomBytes } from 'crypto';

/**
 * Standard OAuth CSRF protection: generate a random nonce, hand it to the
 * provider as `state`, and stash it in a short-lived httpOnly cookie. The
 * callback compares the two — if they don't match, either the request
 * didn't originate from this browser or the flow is stale.
 */
export function generateState(): string {
  return randomBytes(24).toString('base64url');
}

export function stateCookieName(platform: string): string {
  return `oauth_state_${platform}`;
}
