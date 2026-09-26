import Link from 'next/link';
import { SignedIn, SignedOut } from '@clerk/nextjs';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Home() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-50 flex flex-col items-center justify-center p-6">
      <div className="max-w-xl w-full text-center space-y-8">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-amber-400 border border-amber-900/60 bg-amber-950/40 rounded-full px-3 py-1">
          <Sparkles className="w-3 h-3" /> Viral Trending
        </span>
        <h1 className="text-4xl font-black leading-tight">
          Paste a link. Find the gap between your video and a viral one.
        </h1>
        <p className="text-sm text-neutral-400 leading-relaxed">
          The Viral Gap Analyzer scores your TikTok, YouTube Short, or Facebook Reel against the
          hook and retention benchmarks that separate viral videos from the rest — then gives you
          a timestamped action plan to close the gap.
        </p>

        <div className="flex flex-col items-center gap-3">
          <SignedIn>
            <Link href="/dashboard/analyze">
              <Button size="lg" className="bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold">
                Go to your dashboard <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </SignedIn>
          <SignedOut>
            <Link href="/sign-up">
              <Button size="lg" className="bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold">
                Analyze your first video <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
            <Link href="/sign-in" className="text-xs text-neutral-500 hover:text-neutral-300">
              Already have an account? Sign in
            </Link>
          </SignedOut>
        </div>
      </div>
    </div>
  );
}
