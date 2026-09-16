import Anthropic from '@anthropic-ai/sdk';
import type {
  ViralGapAnalysis,
  TimelineRecommendation,
  GrowthBlueprint,
  UploadDiagnosis,
  Storyboard,
  ScriptScene,
  SuiteTool,
} from '@/lib/types';

let cached: Anthropic | null = null;

function getAnthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not configured.');
  }
  if (!cached) {
    cached = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return cached;
}

const ANALYSIS_TOOL_NAME = 'submit_viral_gap_analysis';

// Forces structured output via tool use rather than parsing free-text JSON
// out of a text block, which is the reliable pattern for the Messages API
// — the model's response is guaranteed to match this schema or the SDK
// call itself fails validation.
const ANALYSIS_TOOL: Anthropic.Tool = {
  name: ANALYSIS_TOOL_NAME,
  description:
    'Submit the structured Viral Gap Analyzer audit for a short-form video, scored against ' +
    'the standard short-form retention benchmarks (60%+ viewer retention at 3 seconds, ' +
    '40%+ at 30 seconds).',
  input_schema: {
    type: 'object',
    properties: {
      viral_score: {
        type: 'number',
        description: '0-100 overall viral potential score.',
      },
      pacing_audit: {
        type: 'object',
        properties: {
          cuts_per_10s: {
            type: ['number', 'null'],
            description: 'Estimated cuts/scene changes per 10 seconds, or null if not inferable from the available content.',
          },
          assessment: { type: 'string' },
        },
        required: ['cuts_per_10s', 'assessment'],
      },
      hook_evaluation: {
        type: 'object',
        properties: {
          score: { type: 'number', description: '0-100.' },
          verdict: { type: 'string', enum: ['strong', 'moderate', 'weak'] },
          notes: { type: 'string' },
        },
        required: ['score', 'verdict', 'notes'],
      },
      retention_prediction: {
        type: 'object',
        properties: {
          at_3s_percent: { type: 'number' },
          at_30s_percent: { type: 'number' },
          meets_3s_benchmark: { type: 'boolean', description: 'true if at_3s_percent >= 60.' },
          meets_30s_benchmark: { type: 'boolean', description: 'true if at_30s_percent >= 40.' },
        },
        required: ['at_3s_percent', 'at_30s_percent', 'meets_3s_benchmark', 'meets_30s_benchmark'],
      },
      action_plan: {
        type: 'array',
        items: { type: 'string' },
        description: 'Concrete, prioritized fixes — what is missing for virality.',
      },
      timeline_recommendations: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            timestamp_seconds: { type: 'number' },
            issue: { type: 'string' },
            recommendation: { type: 'string' },
            severity: { type: 'string', enum: ['critical', 'moderate', 'minor'] },
          },
          required: ['timestamp_seconds', 'issue', 'recommendation', 'severity'],
        },
      },
    },
    required: [
      'viral_score',
      'pacing_audit',
      'hook_evaluation',
      'retention_prediction',
      'action_plan',
      'timeline_recommendations',
    ],
  },
};

export interface AnalysisResult {
  viral_score: number;
  analysis: ViralGapAnalysis;
  timeline_recommendations: TimelineRecommendation[];
}

const SYSTEM_PROMPT = `You are ViralEngine's Viral Gap Analyzer, an expert short-form video strategist.
You are given the raw extracted page content for a TikTok, YouTube Shorts, or Facebook Reels URL
(title, description, visible view/like/comment counts if present, and any other on-page text —
this was scraped from the live page, so it is noisy HTML-derived text, not a clean transcript).

Apply these fixed, verified industry benchmarks for short-form video:
- 60%+ audience retention at 3 seconds is the bar for a strong hook.
- 40%+ audience retention at 30 seconds is the bar for a strong mid-video retention loop.
Below either threshold is a real gap, not a minor note — call it out plainly.

Since you cannot watch the video, base cuts_per_10s and the retention predictions on the
strongest available signals in the text (description pacing cues, hashtags, comment sentiment,
video length if stated, genre conventions for the platform). Where a number genuinely cannot be
estimated from the given content, use your best-informed estimate given the platform and content
type rather than a placeholder, and say so plainly in the relevant "notes"/"assessment" field.

Call submit_viral_gap_analysis exactly once with your complete structured audit.`;

export async function generateViralGapAnalysis(params: {
  platform: string;
  sourceUrl: string;
  pageTitle: string | undefined;
  extractedContent: string;
}): Promise<AnalysisResult> {
  const anthropic = getAnthropic();

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    tools: [ANALYSIS_TOOL],
    tool_choice: { type: 'tool', name: ANALYSIS_TOOL_NAME },
    messages: [
      {
        role: 'user',
        content:
          `Platform: ${params.platform}\n` +
          `URL: ${params.sourceUrl}\n` +
          `Page title: ${params.pageTitle ?? '(none)'}\n\n` +
          `Extracted page content:\n${params.extractedContent.slice(0, 12_000)}`,
      },
    ],
  });

  const toolUse = message.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use' && block.name === ANALYSIS_TOOL_NAME
  );

  if (!toolUse) {
    throw new Error('Anthropic response did not include the expected structured analysis.');
  }

  const input = toolUse.input as {
    viral_score: number;
    pacing_audit: ViralGapAnalysis['pacing_audit'];
    hook_evaluation: ViralGapAnalysis['hook_evaluation'];
    retention_prediction: ViralGapAnalysis['retention_prediction'];
    action_plan: string[];
    timeline_recommendations: TimelineRecommendation[];
  };

  return {
    viral_score: input.viral_score,
    analysis: {
      pacing_audit: input.pacing_audit,
      hook_evaluation: input.hook_evaluation,
      retention_prediction: input.retention_prediction,
      action_plan: input.action_plan,
      source_metrics: {},
    },
    timeline_recommendations: input.timeline_recommendations,
  };
}

const BLUEPRINT_TOOL_NAME = 'submit_growth_blueprint';

const BLUEPRINT_TOOL: Anthropic.Tool = {
  name: BLUEPRINT_TOOL_NAME,
  description:
    'Submit the structured Creator Account Deep-Dive growth blueprint: theme correction, ' +
    'view maximization tactics, and posting blindspots, grounded in the real per-platform ' +
    'metrics provided.',
  input_schema: {
    type: 'object',
    properties: {
      viral_score: {
        type: 'number',
        description: '0-100 overall account health/growth-readiness score.',
      },
      thematic_consistency: {
        type: 'object',
        properties: {
          score: { type: 'number', description: '0-100.' },
          notes: { type: 'string' },
        },
        required: ['score', 'notes'],
      },
      view_to_follower_ratio: {
        type: 'object',
        properties: {
          value: {
            type: ['number', 'null'],
            description: 'Copy the numeric avgViewToSubscriberRatio provided, or null if none was given.',
          },
          assessment: { type: 'string' },
        },
        required: ['value', 'assessment'],
      },
      posting_cadence: {
        type: 'object',
        properties: {
          avg_days_between_posts: {
            type: ['number', 'null'],
            description: 'Copy the numeric avgDaysBetweenUploads provided, or null if none was given.',
          },
          assessment: { type: 'string' },
        },
        required: ['avg_days_between_posts', 'assessment'],
      },
      theme_correction: { type: 'array', items: { type: 'string' } },
      view_maximization_tactics: { type: 'array', items: { type: 'string' } },
      posting_blindspots: { type: 'array', items: { type: 'string' } },
      per_platform_notes: {
        type: 'object',
        description: 'One free-text note per platform actually analyzed, keyed by platform name.',
        additionalProperties: { type: 'string' },
      },
    },
    required: [
      'viral_score',
      'thematic_consistency',
      'view_to_follower_ratio',
      'posting_cadence',
      'theme_correction',
      'view_maximization_tactics',
      'posting_blindspots',
      'per_platform_notes',
    ],
  },
};

const BLUEPRINT_SYSTEM_PROMPT = `You are ViralEngine's Creator Account Deep-Dive strategist.
You are given real, per-platform data gathered about a creator's account(s): for YouTube, official
YouTube Data API v3 numbers (subscriber count, recent upload view/like/comment counts, computed
posting cadence and view-to-subscriber ratio); for TikTok/Instagram, extracted public profile page
content (noisy HTML-derived text, not clean API data — say so in per_platform_notes if it limits
what you can conclude for that platform).

Ground every number you reference in the data actually given to you — never invent a metric that
wasn't provided. Where a metric is null because it genuinely wasn't available, say so plainly in
the relevant assessment/notes field rather than fabricating a value.

Produce a growth blueprint: theme correction (where their content strays from their stated niche),
view maximization tactics (concrete, prioritized), and posting blindspots (gaps in cadence, format,
or platform coverage). Call submit_growth_blueprint exactly once.`;

export interface BlueprintResult {
  viral_score: number;
  analysis: GrowthBlueprint;
}

export async function generateGrowthBlueprint(params: {
  niche: string | null;
  platformData: Record<string, unknown>;
}): Promise<BlueprintResult> {
  const anthropic = getAnthropic();

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 4096,
    system: BLUEPRINT_SYSTEM_PROMPT,
    tools: [BLUEPRINT_TOOL],
    tool_choice: { type: 'tool', name: BLUEPRINT_TOOL_NAME },
    messages: [
      {
        role: 'user',
        content:
          `Creator's stated niche: ${params.niche ?? '(not provided)'}\n\n` +
          `Per-platform data:\n${JSON.stringify(params.platformData, null, 2).slice(0, 16_000)}`,
      },
    ],
  });

  const toolUse = message.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use' && block.name === BLUEPRINT_TOOL_NAME
  );

  if (!toolUse) {
    throw new Error('Anthropic response did not include the expected growth blueprint.');
  }

  const input = toolUse.input as {
    viral_score: number;
    thematic_consistency: GrowthBlueprint['thematic_consistency'];
    view_to_follower_ratio: GrowthBlueprint['view_to_follower_ratio'];
    posting_cadence: GrowthBlueprint['posting_cadence'];
    theme_correction: string[];
    view_maximization_tactics: string[];
    posting_blindspots: string[];
    per_platform_notes: Record<string, string>;
  };

  return {
    viral_score: input.viral_score,
    analysis: {
      thematic_consistency: input.thematic_consistency,
      view_to_follower_ratio: input.view_to_follower_ratio,
      posting_cadence: input.posting_cadence,
      theme_correction: input.theme_correction,
      view_maximization_tactics: input.view_maximization_tactics,
      posting_blindspots: input.posting_blindspots,
      per_platform_notes: input.per_platform_notes,
    },
  };
}

const UPLOAD_TOOL_NAME = 'submit_upload_diagnosis';

const UPLOAD_TOOL: Anthropic.Tool = {
  name: UPLOAD_TOOL_NAME,
  description:
    'Submit the structured Multimodal Video Upload Diagnostic: visual hook clarity, audio/voice ' +
    'balance, B-roll recommendations, text-overlay read speed, retention boosters, and ' +
    'timeline-pinned feedback -- grounded in the actual video frames and waveform image provided.',
  input_schema: {
    type: 'object',
    properties: {
      viral_score: { type: 'number', description: '0-100 overall viral potential score.' },
      visual_hook_clarity: {
        type: 'object',
        properties: {
          score: { type: 'number', description: '0-100, based on the first 1-2 frames provided.' },
          verdict: { type: 'string', enum: ['strong', 'moderate', 'weak'] },
          notes: { type: 'string' },
        },
        required: ['score', 'verdict', 'notes'],
      },
      audio_balance: {
        type: 'object',
        properties: {
          score: { type: 'number', description: '0-100, based on the waveform image provided.' },
          notes: {
            type: 'string',
            description:
              'Read the waveform: flat/quiet stretches, clipping (solid blocks), voice-vs-music balance cues.',
          },
        },
        required: ['score', 'notes'],
      },
      text_overlay_pacing: {
        type: 'object',
        properties: {
          assessment: {
            type: 'string',
            description:
              'Read any on-screen text visible in the frames and assess whether it would be readable at a normal viewing pace, or null-equivalent text if none is visible.',
          },
        },
        required: ['assessment'],
      },
      b_roll_recommendations: { type: 'array', items: { type: 'string' } },
      retention_boosters: { type: 'array', items: { type: 'string' } },
      timeline_recommendations: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            timestamp_seconds: {
              type: 'number',
              description: 'Must be one of the frame timestamps actually provided.',
            },
            issue: { type: 'string' },
            recommendation: { type: 'string' },
            severity: { type: 'string', enum: ['critical', 'moderate', 'minor'] },
          },
          required: ['timestamp_seconds', 'issue', 'recommendation', 'severity'],
        },
      },
    },
    required: [
      'viral_score',
      'visual_hook_clarity',
      'audio_balance',
      'text_overlay_pacing',
      'b_roll_recommendations',
      'retention_boosters',
      'timeline_recommendations',
    ],
  },
};

const UPLOAD_SYSTEM_PROMPT = `You are ViralEngine's Multimodal Video Upload Diagnostic reviewer.
You are given a series of real still frames extracted from an uploaded short-form video at named
timestamps, followed by a real waveform image rendering the video's audio track. These are actual
pixels from the actual upload, not descriptions -- look at them directly.

Apply the same short-form benchmarks used elsewhere in ViralEngine: a strong hook needs to land in
the first 1-2 frames you're shown (the 0-3s window). Judge audio balance from the waveform's shape
(flat/silent stretches, clipped/solid blocks suggesting distortion, relative loudness across the
timeline) -- you cannot hear the audio, so ground every audio claim in what the waveform image
actually shows. Judge text-overlay pacing from any on-screen text visible in the frames.

Every timeline_recommendations entry's timestamp_seconds must be one of the frame timestamps you
were actually given -- do not invent a timestamp for a frame you were not shown.

Call submit_upload_diagnosis exactly once with your complete structured diagnosis.`;

export interface UploadDiagnosisResult {
  viral_score: number;
  analysis: UploadDiagnosis;
  timeline_recommendations: TimelineRecommendation[];
}

export async function generateUploadDiagnosis(params: {
  frames: { timestampSeconds: number; base64: string; mediaType: string }[];
  waveform: { base64: string; mediaType: string } | null;
  durationSeconds: number;
}): Promise<UploadDiagnosisResult> {
  const anthropic = getAnthropic();

  const content: Anthropic.ContentBlockParam[] = [
    {
      type: 'text',
      text:
        `Video duration: ${params.durationSeconds.toFixed(1)}s. ` +
        `${params.frames.length} frames follow, each preceded by its timestamp.`,
    },
  ];

  for (const frame of params.frames) {
    content.push({ type: 'text', text: `Frame at ${frame.timestampSeconds}s:` });
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: frame.mediaType as 'image/jpeg', data: frame.base64 },
    });
  }

  if (params.waveform) {
    content.push({ type: 'text', text: 'Audio waveform for the full video:' });
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: params.waveform.mediaType as 'image/png', data: params.waveform.base64 },
    });
  }

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 4096,
    system: UPLOAD_SYSTEM_PROMPT,
    tools: [UPLOAD_TOOL],
    tool_choice: { type: 'tool', name: UPLOAD_TOOL_NAME },
    messages: [{ role: 'user', content }],
  });

  const toolUse = message.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use' && block.name === UPLOAD_TOOL_NAME
  );

  if (!toolUse) {
    throw new Error('Anthropic response did not include the expected upload diagnosis.');
  }

  const input = toolUse.input as {
    viral_score: number;
    visual_hook_clarity: UploadDiagnosis['visual_hook_clarity'];
    audio_balance: UploadDiagnosis['audio_balance'];
    text_overlay_pacing: UploadDiagnosis['text_overlay_pacing'];
    b_roll_recommendations: string[];
    retention_boosters: string[];
    timeline_recommendations: TimelineRecommendation[];
  };

  return {
    viral_score: input.viral_score,
    analysis: {
      visual_hook_clarity: input.visual_hook_clarity,
      audio_balance: input.audio_balance,
      text_overlay_pacing: input.text_overlay_pacing,
      b_roll_recommendations: input.b_roll_recommendations,
      retention_boosters: input.retention_boosters,
      frames_analyzed: params.frames.length,
    },
    timeline_recommendations: input.timeline_recommendations,
  };
}

const SCRIPT_TOOL_NAME = 'submit_storyboard';

const SCRIPT_TOOL: Anthropic.Tool = {
  name: SCRIPT_TOOL_NAME,
  description:
    'Submit the structured scene-by-scene storyboard: spoken hook, per-scene visual action / ' +
    'dialogue / audio-SFX cue / retention-loop note, and a closing CTA.',
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'A short, punchy working title for this script.' },
      spoken_hook: {
        type: 'string',
        description: 'The opening line, readable aloud in under 3 seconds (roughly 8-10 words max).',
      },
      scenes: {
        type: 'array',
        minItems: 2,
        items: {
          type: 'object',
          properties: {
            scene_number: { type: 'number' },
            visual_action: { type: 'string', description: 'What the camera/creator physically does or shows.' },
            dialogue_or_vo: { type: 'string', description: 'Spoken line or voiceover for this scene.' },
            audio_sfx_cue: { type: 'string', description: 'Music/sound-effect cue, or "none" if silent.' },
            retention_loop_note: {
              type: 'string',
              description: 'Why a viewer keeps watching past this scene specifically.',
            },
          },
          required: ['scene_number', 'visual_action', 'dialogue_or_vo', 'audio_sfx_cue', 'retention_loop_note'],
        },
      },
      cta: { type: 'string', description: 'The closing call-to-action line.' },
    },
    required: ['title', 'spoken_hook', 'scenes', 'cta'],
  },
};

function buildScriptSystemPrompt(hasMemory: boolean): string {
  return `You are ViralEngine's Algorithmic Script & Storyboard Generator, writing for short-form
video (TikTok, YouTube Shorts, Facebook Reels).

Structure every script exactly as: a spoken hook readable in under 3 seconds, then 2-6 scenes each
with a visual action, dialogue/voiceover, an audio/SFX cue, and a note on why that specific scene
keeps the viewer watching (the retention loop), then a single closing CTA line. This mirrors the
format of videos that actually go viral on these platforms, not generic ad copy.

${
  hasMemory
    ? "Below are real memories ViralEngine has previously recorded about this creator's voice and " +
      'tone from their past scripts. Write in a way that is consistent with them — do not contradict ' +
      'an established style choice without a good reason tied to this specific prompt.'
    : 'No prior voice/tone memory exists for this creator yet (this may be their first script, or ' +
      'memory retrieval was unavailable) — write from the prompt and any tone parameters given, and ' +
      'do not claim to be matching an established style that was not actually provided.'
}

Call submit_storyboard exactly once with the complete storyboard.`;
}

export interface ScriptResult {
  title: string;
  storyboard: Storyboard;
}

export async function generateScript(params: {
  prompt: string;
  targetPlatform: string | null;
  toneParameters: Record<string, unknown>;
  creatorMemories: string[];
}): Promise<ScriptResult> {
  const anthropic = getAnthropic();
  const hasMemory = params.creatorMemories.length > 0;

  const userContent =
    `Prompt: ${params.prompt}\n` +
    `Target platform: ${params.targetPlatform ?? '(unspecified)'}\n` +
    `Tone parameters: ${JSON.stringify(params.toneParameters)}\n\n` +
    (hasMemory
      ? `Creator voice/tone memories:\n${params.creatorMemories.map((m) => `- ${m}`).join('\n')}`
      : 'Creator voice/tone memories: (none found)');

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 4096,
    system: buildScriptSystemPrompt(hasMemory),
    tools: [SCRIPT_TOOL],
    tool_choice: { type: 'tool', name: SCRIPT_TOOL_NAME },
    messages: [{ role: 'user', content: userContent }],
  });

  const toolUse = message.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use' && block.name === SCRIPT_TOOL_NAME
  );

  if (!toolUse) {
    throw new Error('Anthropic response did not include the expected storyboard.');
  }

  const input = toolUse.input as {
    title: string;
    spoken_hook: string;
    scenes: ScriptScene[];
    cta: string;
  };

  return {
    title: input.title,
    storyboard: {
      spoken_hook: input.spoken_hook,
      scenes: input.scenes,
      cta: input.cta,
      memory_context_used: hasMemory,
    },
  };
}

const RECOMMENDATIONS_TOOL_NAME = 'submit_tool_recommendations';

const RECOMMENDATIONS_TOOL: Anthropic.Tool = {
  name: RECOMMENDATIONS_TOOL_NAME,
  description:
    'Submit 1-4 contextual tool recommendations grounded in specific findings from the ' +
    "creator's own recent reports/scripts -- never a generic pitch for a tool.",
  input_schema: {
    type: 'object',
    properties: {
      recommendations: {
        type: 'array',
        minItems: 1,
        maxItems: 4,
        items: {
          type: 'object',
          properties: {
            tool: {
              type: 'string',
              enum: ['descript', 'opusclip', 'hyperframes', 'canva'],
              description:
                'descript=audio/transcript repair, opusclip=short-form clip slicing, ' +
                'hyperframes=AI avatar B-roll, canva=thumbnail templates.',
            },
            reason: {
              type: 'string',
              description: 'Must cite the specific finding (score, note, or issue) from the digest that justifies this.',
            },
            action: { type: 'string', description: 'The concrete next step once there.' },
            source: {
              type: 'string',
              description: 'Which item in the digest this is grounded in, quoted or closely paraphrased.',
            },
          },
          required: ['tool', 'reason', 'action', 'source'],
        },
      },
    },
    required: ['recommendations'],
  },
};

const RECOMMENDATIONS_SYSTEM_PROMPT = `You are ViralEngine's Creator Tool Suite Hub. You are given a
digest of a creator's own recent Viral Gap Analyzer / Account Deep-Dive / Upload Diagnostic reports
and generated scripts -- their actual weak points, already identified elsewhere in the product.

Your only job is to route each real weak point to whichever ONE of these four tools actually
addresses it, and say why in terms of that specific finding:
- descript: audio/voice problems (weak audio_balance, mentions of unclear speech).
- opusclip: needs more/better short-form clips from existing longer footage.
- hyperframes: needs B-roll or avatar-driven footage it doesn't have.
- canva: weak/missing thumbnail, or a finding about visual hook clarity tied to a static image, not video content.

Never recommend a tool for a problem it doesn't solve, and never invent a finding that isn't in the
digest -- every recommendation's "source" must trace to something actually given to you. If the
digest has nothing that maps cleanly to one of these four tools, recommend fewer tools rather than
forcing a stretch.

Call submit_tool_recommendations exactly once.`;

export interface RawToolRecommendation {
  tool: SuiteTool;
  reason: string;
  action: string;
  source: string;
}

export async function generateToolRecommendations(digest: string): Promise<RawToolRecommendation[]> {
  const anthropic = getAnthropic();

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 2048,
    system: RECOMMENDATIONS_SYSTEM_PROMPT,
    tools: [RECOMMENDATIONS_TOOL],
    tool_choice: { type: 'tool', name: RECOMMENDATIONS_TOOL_NAME },
    messages: [{ role: 'user', content: `Digest of recent reports/scripts:\n${digest.slice(0, 12_000)}` }],
  });

  const toolUse = message.content.find(
    (block): block is Anthropic.ToolUseBlock =>
      block.type === 'tool_use' && block.name === RECOMMENDATIONS_TOOL_NAME
  );

  if (!toolUse) {
    throw new Error('Anthropic response did not include the expected recommendations.');
  }

  const input = toolUse.input as { recommendations: RawToolRecommendation[] };
  return input.recommendations;
}
