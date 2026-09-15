/**
 * Client helper for the ViralVision platform service (`services/api`).
 *
 * That service is a separate FastAPI app that is not running by default.
 * Requests reach it only when `INTERNAL_API_URL` is set, which turns on the
 * `/api/v1/:path*` rewrite in next.config.mjs. Without it every call 404s
 * against the Next.js app itself, so callers need to tell "the backend
 * isn't wired up here" apart from "the backend answered with an error" —
 * otherwise the UI reports a fake failure for a feature that was simply
 * never deployed.
 */

export type PlatformApiResult<T> =
  | { state: 'ok'; data: T }
  | { state: 'unavailable' }
  | { state: 'error'; message: string };

export async function platformApiFetch<T>(
  path: string,
  init?: RequestInit
): Promise<PlatformApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(path, init);
  } catch {
    // Rewrite target refused the connection, or the network is down.
    return { state: 'unavailable' };
  }

  // The Next.js app itself has no /api/v1 routes, so a 404 here means the
  // rewrite is off (INTERNAL_API_URL unset) rather than a missing record.
  if (res.status === 404) {
    return { state: 'unavailable' };
  }

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.detail) message = String(body.detail);
    } catch {
      // Non-JSON error body; keep the status-code message.
    }
    return { state: 'error', message };
  }

  return { state: 'ok', data: (await res.json()) as T };
}
