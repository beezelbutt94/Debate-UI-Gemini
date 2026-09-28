import type { Metadata } from 'next';
import Link from 'next/link';
import { SignedIn, SignedOut } from '@clerk/nextjs';
import { PLAN_QUOTA } from '@/lib/plans';

export const metadata: Metadata = { title: 'Help' };

const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;

const FAQ: { q: string; a: React.ReactNode }[] = [
  {
    q: 'What counts as an analysis?',
    a: (
      <>
        Each run of a tool that researches or generates something new uses one analysis: the Viral Gap Analyzer, Account
        Deep-Dive, Upload Diagnostic, Script Generator, Competitor Espionage, Web Discovery and &ldquo;Suggest this
        week&rdquo; on the Schedule. Opening saved reports, the Tool Suite Hub, and editing or publishing scheduled posts
        are free. If a run fails on our side it is not counted.
      </>
    ),
  },
  {
    q: 'How many analyses do I get?',
    a: (
      <>
        Free includes {PLAN_QUOTA.free} per month. Creator, Pro and Studio include {PLAN_QUOTA.creator},{' '}
        {PLAN_QUOTA.pro} and {PLAN_QUOTA.studio} per billing period. Your usage resets when your plan renews; you can
        see it any time on the Billing page.
      </>
    ),
  },
  {
    q: 'How do I upgrade, downgrade or cancel?',
    a: (
      <>
        Go to Billing. Choose a plan to upgrade; once you&apos;re on a paid plan, &ldquo;Manage billing&rdquo; opens
        Stripe, where you can switch plans, update your card, download invoices or cancel. Cancelling keeps your plan
        until the end of the period you&apos;ve paid for, then moves you to Free. Nothing you&apos;ve created is deleted.
      </>
    ),
  },
  {
    q: 'Why was my post not published?',
    a: (
      <>
        A post publishes only when it is <em>scheduled</em> (not a draft), has a video attached, and the matching
        account is connected on the Connections page. If publishing fails, the post shows the reason from the platform.
        TikTok can only post privately until your app passes TikTok&apos;s content audit, and Facebook Reels publish to
        a Page you manage, not a personal profile.
      </>
    ),
  },
  {
    q: 'What video files can I upload?',
    a: 'MP4 or MOV, up to 100 MB. Videos are stored in a private folder for your account and are only published where you schedule them.',
  },
  {
    q: 'Are my account connections safe?',
    a: 'Connections use each platform’s official sign-in. Access tokens are stored encrypted and are only used to publish the posts you schedule. You can disconnect any account at any time on the Connections page.',
  },
  {
    q: 'How do I delete my account?',
    a: 'Open the account menu (your avatar, top right), choose Manage account, then delete your account. Any paid subscription is cancelled automatically and your data is removed.',
  },
];

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-50">
      <div className="max-w-3xl mx-auto px-4 py-8 sm:p-10 space-y-8">
        <nav aria-label="Breadcrumb" className="flex items-center justify-between text-xs">
          <Link href="/" className="inline-flex items-center min-h-[40px] font-black text-sm">
            Viral Trending
          </Link>
          {/* Signed-out visitors get Sign in: prefetching /dashboard for them follows
              Clerk's cross-origin sign-in redirect, which the browser blocks (CORS). */}
          <SignedIn>
            <Link href="/dashboard" className="inline-flex items-center min-h-[40px] px-2 text-amber-400 hover:text-amber-300">
              Dashboard
            </Link>
          </SignedIn>
          <SignedOut>
            <Link href="/sign-in" className="inline-flex items-center min-h-[40px] px-2 text-amber-400 hover:text-amber-300">
              Sign in
            </Link>
          </SignedOut>
        </nav>
        <header className="border-b border-neutral-800 pb-6">
          <span className="text-[10px] font-mono text-amber-500 uppercase tracking-widest">Help</span>
          <h1 className="text-2xl font-black mt-1">Questions and answers</h1>
        </header>

        <div className="space-y-3">
          {FAQ.map((item) => (
            <details key={item.q} className="group rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 open:border-neutral-700">
              <summary className="cursor-pointer list-none font-bold text-sm flex items-center justify-between gap-4">
                {item.q}
                <span className="text-neutral-500 group-open:rotate-45 transition-transform" aria-hidden>
                  +
                </span>
              </summary>
              <div className="text-sm text-neutral-400 mt-3 leading-relaxed">{item.a}</div>
            </details>
          ))}
        </div>

        <section className="rounded-xl border border-neutral-800 p-4 text-sm text-neutral-400">
          <h2 className="font-bold text-neutral-200 mb-1">Still stuck?</h2>
          {SUPPORT_EMAIL ? (
            <p>
              Email{' '}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="text-amber-400 hover:text-amber-300">
                {SUPPORT_EMAIL}
              </a>{' '}
              and we&apos;ll get back to you.
            </p>
          ) : (
            <p>Support contact details haven&apos;t been published yet. Please check back soon.</p>
          )}
        </section>
      </div>
    </div>
  );
}
