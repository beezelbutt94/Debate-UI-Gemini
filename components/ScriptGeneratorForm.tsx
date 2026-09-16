'use client';

import { useState } from 'react';
import { Loader2, TriangleAlert, Sparkles, BrainCircuit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Platform, ScriptRow } from '@/lib/types';

const PLATFORMS: { value: Platform; label: string }[] = [
  { value: 'tiktok', label: 'TikTok' },
  { value: 'youtube_shorts', label: 'YouTube Shorts' },
  { value: 'facebook_reels', label: 'Facebook Reels' },
];

interface GenerateResponse {
  script: ScriptRow;
  memory: { retrieved: boolean; recorded: boolean };
}

export function ScriptGeneratorForm() {
  const [prompt, setPrompt] = useState('');
  const [platform, setPlatform] = useState<Platform | ''>('');
  const [tone, setTone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateResponse | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/generate/script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          targetPlatform: platform || undefined,
          tone: tone || undefined,
        }),
      });
      const body = await res.json();

      if (!res.ok) {
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }

      setResult(body as GenerateResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Script generation failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-3">
        <textarea
          required
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="What's this video about? e.g. 3 mistakes beginners make when meal-prepping on a budget"
          rows={3}
          className="w-full px-3 py-2 rounded-lg bg-neutral-900 border border-neutral-800 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-amber-600 resize-none"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value as Platform | '')}
            className="h-11 px-3 rounded-lg bg-neutral-900 border border-neutral-800 text-sm text-neutral-100 focus:outline-none focus:border-amber-600"
          >
            <option value="">Any platform</option>
            {PLATFORMS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            placeholder="Tone (optional, e.g. energetic and sarcastic)"
            className="h-11 px-3 rounded-lg bg-neutral-900 border border-neutral-800 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-amber-600"
          />
        </div>
        <Button
          type="submit"
          disabled={loading}
          className="bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold h-11 w-full md:w-auto"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-1.5" /> Generate storyboard
            </>
          )}
        </Button>
      </form>

      {error && (
        <div className="flex items-start gap-2 p-4 rounded-xl border border-rose-900 bg-rose-950/40 text-rose-200 text-xs">
          <TriangleAlert className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {result && <StoryboardCard result={result} />}
    </div>
  );
}

function StoryboardCard({ result }: { result: GenerateResponse }) {
  const { storyboard, title } = result.script;

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-black text-white">{title}</h3>
        <span className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-neutral-500">
          <BrainCircuit className="w-3.5 h-3.5" />
          {storyboard.memory_context_used ? 'used creator voice memory' : 'no prior voice memory'}
        </span>
      </div>

      <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-900/60">
        <span className="text-[10px] font-mono uppercase text-amber-500">Spoken hook (&lt;3s)</span>
        <p className="text-sm text-white font-semibold mt-1">{storyboard.spoken_hook}</p>
      </div>

      <div className="space-y-2">
        <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">Scenes</span>
        <ul className="space-y-2">
          {storyboard.scenes.map((scene) => (
            <li key={scene.scene_number} className="p-4 rounded-lg bg-neutral-900/60 border border-neutral-800 space-y-1.5">
              <span className="text-[10px] font-mono text-amber-400">Scene {scene.scene_number}</span>
              <p className="text-xs text-neutral-200">
                <span className="text-neutral-500">Visual: </span>
                {scene.visual_action}
              </p>
              <p className="text-xs text-neutral-200">
                <span className="text-neutral-500">Dialogue: </span>
                {scene.dialogue_or_vo}
              </p>
              <p className="text-xs text-neutral-200">
                <span className="text-neutral-500">Audio/SFX: </span>
                {scene.audio_sfx_cue}
              </p>
              <p className="text-xs text-neutral-400 italic">
                <span className="text-neutral-500">Retention loop: </span>
                {scene.retention_loop_note}
              </p>
            </li>
          ))}
        </ul>
      </div>

      <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800">
        <span className="text-[10px] font-mono uppercase text-neutral-500">Call-to-action</span>
        <p className="text-sm text-white font-semibold mt-1">{storyboard.cta}</p>
      </div>

      {!result.memory.recorded && (
        <p className="text-[11px] text-neutral-500 font-mono">
          Note: this script&apos;s style could not be recorded to your creator-voice memory for next time.
        </p>
      )}
    </div>
  );
}
