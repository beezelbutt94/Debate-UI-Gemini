import { auth, currentUser } from '@clerk/nextjs/server';

/**
 * Admin access is granted only by server-side configuration, never by
 * anything the client can set:
 *
 *   ADMIN_USER_IDS  comma-separated Clerk user ids ("user_...")
 *   ADMIN_EMAILS    comma-separated emails; matched against the user's
 *                   *verified* Clerk email addresses only
 *
 * With neither set, nobody is an admin.
 */
function listFromEnv(name: string): string[] {
  return (process.env[name] ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export async function isAdmin(): Promise<boolean> {
  const { userId } = await auth();
  if (!userId) return false;

  const ids = listFromEnv('ADMIN_USER_IDS');
  if (ids.includes(userId.toLowerCase())) return true;

  const emails = listFromEnv('ADMIN_EMAILS');
  if (emails.length === 0) return false;

  const user = await currentUser();
  if (!user || user.id !== userId) return false;
  return user.emailAddresses.some(
    (e) => e.verification?.status === 'verified' && emails.includes(e.emailAddress.toLowerCase())
  );
}

export function adminConfigured(): boolean {
  return listFromEnv('ADMIN_USER_IDS').length > 0 || listFromEnv('ADMIN_EMAILS').length > 0;
}
