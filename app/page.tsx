import Link from 'next/link';
import { SignedIn, SignedOut } from '@clerk/nextjs';
import { ArrowRight, Sparkles, Check } from 'lucide-react';
import { buttonClassName } from '@/components/ui/button';
import { getPlanPrices, type PlanPrice } from '@/lib/billing';
import { PAID_PLANS, PLAN_INFO, PLAN_QUOTA, type PlanTier } from '@/lib/plans';

// Prices come from Stripe; refresh them hourly rather than on every visit.
export const revalidate = 3600;

const FEATURES = [
  'Viral Gap Analyzer: score a video against hook and retention benchmarks',
  'Account Deep-Dive and Upload Diagnostic for your own content',
  'Script and storyboard generator that learns your voice',
  'Competitor Espionage and Web Discovery research reports',
  'A weekly content calendar that publishes to YouTube, TikTok and Facebook',
];

export default async function Home() {
  let prices: PlanPrice[] = [];
  try {
    prices = await getPlanPrices();
  } catch {
    // Pricing is informational here; the page still renders without it.
  }
  const priceOf = (plan: PlanTier) => (plan === 'free' ? '$0' : (prices.find((p) => p.plan === plan)?.display ?? null));

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-50">
      <header className="max-w-5xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between">
        <span className="text-sm font-black">Viral Trending</span>
        <nav aria-label="Site" className="flex items-center gap-1 text-xs text-neutral-400 [&_a]:inline-flex [&_a]:items-center [&_a]:min-h-[40px] [&_a]:px-2">
          <a href="#pricing" className="hover:text-neutral-100">
            Pricing
          </a>
          <Link href="/help" className="hover:text-neutral-100">
            Help
          </Link>
          <SignedOut>
            <Link href="/sign-in" className="hover:text-neutral-100">
              Sign in
            </Link>
          </SignedOut>
          <SignedIn>
            <Link href="/dashboard" className="hover:text-neutral-100">
              Dashboard
            </Link>
          </SignedIn>
        </nav>
      </header>

      <main>
        <section className="max-w-xl mx-auto px-4 sm:px-6 pt-12 pb-16 text-center space-y-8">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-amber-400 border border-amber-900/60 bg-amber-950/40 rounded-full px-3 py-1">
            <Sparkles className="w-3 h-3" /> Viral Trending
          </span>
          <h1 className="text-3xl sm:text-4xl font-black leading-tight">
            Paste a link. Find the gap between your video and a viral one.
          </h1>
          <p className="text-sm text-neutral-400 leading-relaxed">
            The Viral Gap Analyzer scores your TikTok, YouTube Short, or Facebook Reel against the hook and retention
            benchmarks that separate viral videos from the rest, then gives you a timestamped action plan to close the gap.
          </p>

          <div className="flex flex-col items-center gap-3">
            <SignedIn>
              <Link
                href="/dashboard"
                className={buttonClassName({ size: 'lg', className: 'bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold' })}
              >
                Go to your dashboard <ArrowRight className="w-4 h-4 ml-1" aria-hidden />
              </Link>
            </SignedIn>
            <SignedOut>
              <Link
                href="/sign-up"
                className={buttonClassName({ size: 'lg', className: 'bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold' })}
              >
                Analyze your first video free <ArrowRight className="w-4 h-4 ml-1" aria-hidden />
              </Link>
              <Link href="/sign-in" className="text-xs text-neutral-500 hover:text-neutral-300">
                Already have an account? Sign in
              </Link>
            </SignedOut>
          </div>
        </section>

        <section aria-labelledby="features" className="max-w-3xl mx-auto px-4 sm:px-6 pb-16">
          <h2 id="features" className="text-xs font-mono uppercase tracking-widest text-neutral-500 mb-4 text-center">
            Everything in one workspace
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <li key={f} className="flex gap-2 text-sm text-neutral-300 p-3 rounded-xl border border-neutral-800 bg-neutral-900/40">
                <Check className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" aria-hidden /> {f}
              </li>
            ))}
          </ul>
        </section>

        <section id="pricing" aria-labelledby="pricing-title" className="max-w-5xl mx-auto px-4 sm:px-6 pb-20 space-y-6">
          <div className="text-center space-y-2">
            <h2 id="pricing-title" className="text-2xl font-black">
              Simple pricing
            </h2>
            <p className="text-sm text-neutral-400">
              Every tool is included on every plan. Plans differ only in how many analyses you can run.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {(['free', ...PAID_PLANS] as PlanTier[]).map((tier) => (
              <div key={tier} className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-5 flex flex-col gap-3">
                <h3 className="font-black text-lg">{PLAN_INFO[tier].name}</h3>
                <p className="text-2xl font-black">{priceOf(tier) ?? <span className="text-sm text-neutral-500">See in app</span>}</p>
                <p className="text-xs text-neutral-400">{PLAN_INFO[tier].blurb}</p>
                <p className="text-sm text-neutral-200 mt-auto">
                  <span className="font-bold">{PLAN_QUOTA[tier]}</span> analyses / {tier === 'free' ? 'month' : 'period'}
                </p>
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-neutral-500">
            Start free, no card required. Upgrade, downgrade or cancel any time from Billing.
          </p>
        </section>
      </main>

      <footer className="border-t border-neutral-900 py-6 text-center text-xs text-neutral-600">
        <Link href="/help" className="inline-flex items-center min-h-[40px] px-2 hover:text-neutral-300">
          Help &amp; FAQ
        </Link>
      </footer>
    </div>
  );
}
