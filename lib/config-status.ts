/**
 * Which integrations are configured, for the admin area. Reports presence
 * only: no value, prefix or length of any secret ever leaves this module.
 */

export interface ConfigItem {
  name: string;
  set: boolean;
  required: boolean;
}

export interface ConfigGroup {
  title: string;
  purpose: string;
  items: ConfigItem[];
}

const present = (name: string) => !!process.env[name]?.trim();

function group(title: string, purpose: string, required: string[], optional: string[] = []): ConfigGroup {
  return {
    title,
    purpose,
    items: [
      ...required.map((name) => ({ name, set: present(name), required: true })),
      ...optional.map((name) => ({ name, set: present(name), required: false })),
    ],
  };
}

export function configStatus(): ConfigGroup[] {
  return [
    group('Core', 'Sign-in and database', [
      'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
      'CLERK_SECRET_KEY',
      'CLERK_WEBHOOK_SECRET',
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
    ], ['NEXT_PUBLIC_APP_URL']),
    group('Billing', 'Paid plans (Stripe)', [
      'STRIPE_SECRET_KEY',
      'STRIPE_WEBHOOK_SECRET',
      'STRIPE_PRICE_CREATOR',
      'STRIPE_PRICE_PRO',
      'STRIPE_PRICE_STUDIO',
    ]),
    group('AI and research', 'Every analysis tool', ['ANTHROPIC_API_KEY', 'TAVILY_API_KEY'], ['MEM0_API_KEY', 'YOUTUBE_API_KEY']),
    group('Video uploads', 'Upload Diagnostic and scheduled videos', [
      'CLOUDINARY_CLOUD_NAME',
      'CLOUDINARY_API_KEY',
      'CLOUDINARY_API_SECRET',
    ]),
    group('Publishing', 'Connections and auto-publishing', ['CRON_SECRET'], [
      'YOUTUBE_OAUTH_CLIENT_ID',
      'YOUTUBE_OAUTH_CLIENT_SECRET',
      'TIKTOK_OAUTH_CLIENT_KEY',
      'TIKTOK_OAUTH_CLIENT_SECRET',
      'FACEBOOK_APP_ID',
      'FACEBOOK_APP_SECRET',
      'CANVA_CLIENT_ID',
      'CANVA_CLIENT_SECRET',
    ]),
    group('Operations', 'Admin access and support', [], ['ADMIN_EMAILS', 'ADMIN_USER_IDS', 'NEXT_PUBLIC_SUPPORT_EMAIL']),
  ];
}
