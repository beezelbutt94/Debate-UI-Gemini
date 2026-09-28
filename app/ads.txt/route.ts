import { connection } from 'next/server';
import { adsTxt, adsenseClient } from '@/lib/site';

// Read ADSENSE_CLIENT_ID per request so changing it needs no rebuild.
export async function GET() {
  await connection();
  const client = adsenseClient();
  if (!client) return new Response('Not found\n', { status: 404, headers: { 'Content-Type': 'text/plain' } });
  return new Response(adsTxt(client), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });
}
