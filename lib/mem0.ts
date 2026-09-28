import { MemoryClient } from 'mem0ai';
import { ConfigurationError } from '@/lib/errors';

let cached: MemoryClient | null = null;

function getMem0(): MemoryClient {
  if (!process.env.MEM0_API_KEY) {
    throw new ConfigurationError('MEM0_API_KEY');
  }
  if (!cached) {
    cached = new MemoryClient({ apiKey: process.env.MEM0_API_KEY });
  }
  return cached;
}

export interface CreatorVoiceMemory {
  available: boolean;
  memories: string[];
  error?: string;
}

/**
 * Retrieves whatever Viral Trending has previously learned about a creator's
 * voice/tone for this prompt (via a semantic search, not a flat fetch, so
 * only the memories relevant to what they're writing now come back).
 *
 * Memory retrieval is an enhancement, not a hard dependency -- a creator's
 * very first script has nothing to retrieve, and Mem0 being unreachable
 * shouldn't block script generation. But per this repo's own rule (see
 * docs/DEBUG_RUN.md's "failures that were hidden rather than fixed"
 * section), that degradation is reported back to the caller, not
 * swallowed -- `available: false` is a real signal the UI/API response
 * surfaces, not a silent no-op.
 */
export async function retrieveCreatorVoice(
  mem0UserId: string,
  promptContext: string
): Promise<CreatorVoiceMemory> {
  try {
    const client = getMem0();
    const { results } = await client.search(promptContext, {
      filters: { AND: [{ user_id: mem0UserId }] },
      topK: 5,
      threshold: 0.1,
    });
    return {
      available: true,
      memories: results.map((r) => r.memory).filter((m): m is string => Boolean(m)),
    };
  } catch (err) {
    console.error('Mem0 retrieveCreatorVoice failed', err);
    return { available: false, memories: [], error: err instanceof Error ? err.message : 'Mem0 unavailable.' };
  }
}

export interface RecordStyleResult {
  recorded: boolean;
  error?: string;
}

/**
 * Records what tone/style choices this script actually used, so the next
 * generation's retrieveCreatorVoice() call has something real to find.
 * This is how "historical voice and tone" accumulates over time instead
 * of staying empty forever.
 */
export async function recordScriptStyle(mem0UserId: string, summary: string): Promise<RecordStyleResult> {
  try {
    const client = getMem0();
    await client.add([{ role: 'user', content: summary }], { userId: mem0UserId });
    return { recorded: true };
  } catch (err) {
    console.error('Mem0 recordScriptStyle failed', err);
    return { recorded: false, error: err instanceof Error ? err.message : 'Mem0 unavailable.' };
  }
}
