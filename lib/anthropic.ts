import Anthropic from '@anthropic-ai/sdk';
import type { ViralGapAnalysis, TimelineRecommendation } from '@/lib/types';

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
