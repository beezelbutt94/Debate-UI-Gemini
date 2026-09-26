import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { describeError } from '@/lib/errors';

export type EventLevel = 'info' | 'warn' | 'error';

/**
 * Records an application event in `app_events` for the admin area, and
 * mirrors it to the server console. Best effort: logging must never turn a
 * request into a failure, so every error here is swallowed after being
 * printed.
 *
 * Only pass identifiers and short diagnostics in `detail`: no tokens, no
 * prompts, no generated content, no email addresses.
 */
export async function logEvent(
  level: EventLevel,
  event: string,
  options: { userId?: string | null; detail?: Record<string, unknown>; error?: unknown } = {}
): Promise<void> {
  const detail: Record<string, unknown> = { ...(options.detail ?? {}) };
  if (options.error !== undefined) detail.error = describeError(options.error);

  const line = `[${level}] ${event}${options.userId ? ` user=${options.userId}` : ''}`;
  if (level === 'error') console.error(line, detail);
  else if (level === 'warn') console.warn(line, detail);
  else console.info(line, detail);

  try {
    const admin = createSupabaseAdminClient();
    const { error } = await admin.from('app_events').insert({
      level,
      event: event.slice(0, 100),
      user_id: options.userId ?? null,
      detail,
    });
    if (error) console.error('[events] could not record event', error.message);
  } catch (err) {
    console.error('[events] could not record event', describeError(err).message);
  }
}
