/**
 * Client helper for the Viral Trending platform service (`services/api`).
 *
 * That service is a separate FastAPI app that is not running by default.
 * Requests reach it only when `INTERNAL_API_URL` is set, which turns on the
 * `/api/v1/:path*` rewrite in next.config.mjs. Callers need to tell "the
 * backend isn't wired up here" apart from "the backend answered with an
 * error" — otherwise the UI reports a fake failure for a feature that was
 * simply never deployed.
 *
 * That distinction is established by asking the server directly
 * (`/api/platform-status`) rather than inferring it from a 404. Inferring it
 * was wrong in both directions: a genuine "no such render" 404 from the
 * backend looked like an outage, and any non-404 failure while the backend
 * was absent looked like a real backend error.
 */

export type PlatformApiResult<T> =
  | { state: 'ok'; data: T }
  /** The platform service isn't deployed here at all. */
  | { state: 'unavailable' }
  /** It is deployed, but the request couldn't reach it. */
  | { state: 'unreachable'; message: string }
  /** It answered, and there is no such record. */
  | { state: 'not_found' }
  | { state: 'error'; message: string };

let configuredProbe: Promise<boolean> | null = null;

/**
 * Memoized per page load. Whether the backend is configured is a deploy-time
 * fact, so re-probing it on every call would add a round trip to each request
 * for an answer that cannot change under us.
 */
function isPlatformConfigured(): Promise<boolean> {
  if (!configuredProbe) {
    configuredProbe = fetch('/api/platform-status')
      .then((res) => (res.ok ? res.json() : { configured: false }))
      .then((body) => Boolean(body?.configured))
      .catch(() => false);
  }
  return configuredProbe;
}

export async function platformApiFetch<T>(
  path: string,
  init?: RequestInit
): Promise<PlatformApiResult<T>> {
  if (!(await isPlatformConfigured())) {
    return { state: 'unavailable' };
  }

  let res: Response;
  try {
    res = await fetch(path, init);
  } catch (err) {
    // Configured but unreachable: a real operational problem, not a
    // "feature isn't deployed" notice. Saying which one it is matters —
    // one needs an operator, the other doesn't.
    return { state: 'unreachable', message: (err as Error).message };
  }

  if (res.status === 404) {
    return { state: 'not_found' };
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
