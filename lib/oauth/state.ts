import { randomBytes, createHash } from 'crypto';

/**
 * Standard OAuth CSRF protection: generate a random nonce, hand it to the
 * provider as `state`, and stash it in a short-lived httpOnly cookie. The
 * callback compares the two -- if they don't match, either the request
 * didn't originate from this browser or the flow is stale.
 */
export function generateState(): string {
  return randomBytes(24).toString('base64url');
}

export function stateCookieName(platform: string): string {
  return `oauth_state_${platform}`;
}

/**
 * PKCE (RFC 7636), required by Canva's Connect API even for a confidential
 * (server-side) client. code_verifier is stashed in its own short-lived
 * cookie, same lifetime/flags as the state cookie, since both are only
 * needed for the few minutes between /authorize and /callback.
 */
export function generateCodeVerifier(): string {
  return randomBytes(32).toString('base64url');
}

export function codeChallengeFromVerifier(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

export function codeVerifierCookieName(platform: string): string {
  return `oauth_pkce_${platform}`;
}
