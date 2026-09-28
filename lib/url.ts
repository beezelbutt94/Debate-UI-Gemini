/**
 * The app's public origin for links sent to third parties (Stripe return
 * URLs). NEXT_PUBLIC_APP_URL wins; otherwise the request's own origin, so
 * preview deployments return to themselves.
 */
export function appOrigin(request: Request): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, '');
  if (configured) return configured;
  return new URL(request.url).origin;
}
