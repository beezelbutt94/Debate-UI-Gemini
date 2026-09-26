/**
 * Errors whose message is written for the end user and is safe to return
 * in an API response. Anything else (SDK errors, upstream response bodies,
 * database errors) is logged server-side and replaced with a generic
 * message, since it can carry request details the user should not see.
 */
export class UserFacingError extends Error {
  constructor(
    message: string,
    readonly status = 400
  ) {
    super(message);
    this.name = 'UserFacingError';
  }
}

/** A required server setting (API key, price id, ...) is missing. */
export class ConfigurationError extends Error {
  constructor(readonly setting: string) {
    super(`${setting} is not configured.`);
    this.name = 'ConfigurationError';
  }
}

export const CONFIGURATION_MESSAGE =
  'This feature is not available right now because the server is missing configuration. The site owner has been notified.';

export function publicErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof UserFacingError) return err.message;
  if (err instanceof ConfigurationError) return CONFIGURATION_MESSAGE;
  return fallback;
}

export function errorStatus(err: unknown, fallback = 502): number {
  if (err instanceof UserFacingError) return err.status;
  if (err instanceof ConfigurationError) return 503;
  return fallback;
}

/** Short, secret-free description of an error for logs and app_events. */
export function describeError(err: unknown): { name: string; message: string } {
  if (err instanceof Error) {
    return { name: err.name, message: err.message.slice(0, 300) };
  }
  return { name: typeof err, message: String(err).slice(0, 300) };
}
