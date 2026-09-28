import type { Metadata } from 'next';
import { LegalPage } from '@/components/LegalPage';
import { supportEmail } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'What Viral Trending collects, why, who processes it, and how to delete it.',
};

export default function PrivacyPage() {
  const email = supportEmail();
  return (
    <LegalPage eyebrow="Legal" title="Privacy Policy" updated="28 September 2026">
      <section>
        <h2>What we collect</h2>
        <ul>
          <li>
            <strong>Account details</strong> from sign-in (Clerk): your name, email address and profile picture.
          </li>
          <li>
            <strong>What you give the tools</strong>: video links, uploaded clips, account handles, competitor
            names, script briefs and the reports, scripts and schedules the tools produce for you.
          </li>
          <li>
            <strong>Connected platforms</strong>: when you connect YouTube, TikTok, a Facebook Page or Canva, the
            access tokens those services issue, so we can publish or create what you schedule. Tokens are stored
            encrypted (Supabase Vault) and are only used for the actions you ask for.
          </li>
          <li>
            <strong>Billing</strong>: your plan and subscription status. Card details are entered on Stripe&apos;s
            page and never reach our servers.
          </li>
          <li>
            <strong>Usage and diagnostics</strong>: how many analyses you have run, and error logs that help us fix
            problems.
          </li>
        </ul>
      </section>

      <section>
        <h2>Why we use it</h2>
        <p>
          To run the tools you ask for, count your plan&apos;s analyses, publish the posts you schedule, bill your
          subscription, keep the service secure and answer support requests. We do not sell your personal
          information.
        </p>
      </section>

      <section>
        <h2>Who processes it for us</h2>
        <ul>
          <li>Clerk (sign-in), Supabase (database and encrypted token storage), Vercel (hosting).</li>
          <li>Stripe (payments and invoices).</li>
          <li>
            Anthropic (the AI model that writes analyses and scripts) and Tavily (web research). They receive the
            text and links needed for a run.
          </li>
          <li>Cloudinary (storing clips you upload) and Mem0 (remembering your writing voice between scripts).</li>
          <li>YouTube, TikTok, Meta and Canva, only when you connect them and only for the actions you request.</li>
          <li>Google AdSense (advertising, described below).</li>
        </ul>
      </section>

      <section>
        <h2>YouTube and Google data</h2>
        <p>
          Viral Trending uses YouTube API Services. By connecting YouTube you also agree to the{' '}
          <a href="https://www.youtube.com/t/terms">YouTube Terms of Service</a>, and Google&apos;s handling of your
          data is covered by the <a href="https://policies.google.com/privacy">Google Privacy Policy</a>. We use the
          upload permission only to publish videos you schedule. You can revoke our access at any time in your{' '}
          <a href="https://myaccount.google.com/permissions">Google account permissions</a> or by disconnecting
          YouTube in Settings → Connections, which also deletes the stored token.
        </p>
      </section>

      <section>
        <h2>Advertising and cookies</h2>
        <p>
          The public pages may show Google AdSense ads. Google and its partners use cookies to serve ads based on your
          visits to this and other websites. You can turn off personalised advertising in{' '}
          <a href="https://adssettings.google.com">Google Ads Settings</a>, and visitors in the EEA, UK and Switzerland
          are asked for consent before personalised ads are shown. Sign-in uses essential cookies to keep you signed
          in.
        </p>
      </section>

      <section>
        <h2>How long we keep it, and deleting it</h2>
        <p>
          We keep your data while your account is open. Deleting your account (from your profile menu) cancels any
          subscription and removes your reports, scripts, schedules and platform connections. Invoices are kept by
          Stripe as tax law requires.
        </p>
      </section>

      <section>
        <h2>Your rights</h2>
        <p>
          You can ask for a copy of your data, a correction, or its deletion, and you can object to processing or
          complain to your data protection authority.{' '}
          {email ? (
            <>
              Write to <a href={`mailto:${email}`}>{email}</a>.
            </>
          ) : (
            <>Use the contact details on the Help page.</>
          )}
        </p>
      </section>

      <section>
        <h2>Children</h2>
        <p>Viral Trending is not intended for anyone under 16, and we do not knowingly collect their data.</p>
      </section>

      <section>
        <h2>Changes</h2>
        <p>We will update this page when our practices change and show the new date at the top.</p>
      </section>
    </LegalPage>
  );
}
