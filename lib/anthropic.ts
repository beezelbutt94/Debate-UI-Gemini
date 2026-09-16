import Anthropic from '@anthropic-ai/sdk';
import type { ViralGapAnalysis, TimelineRecommendation, GrowthBlueprint } from '@/lib/types';

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
