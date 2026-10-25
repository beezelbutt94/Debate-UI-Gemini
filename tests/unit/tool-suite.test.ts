import { describe, it, expect } from 'vitest';
import { TOOL_INFO } from '@/lib/tool-suite';
import type { SuiteTool } from '@/lib/types';

const KNOWN_TOOLS: SuiteTool[] = ['descript', 'opusclip', 'hyperframes', 'canva'];

describe('TOOL_INFO', () => {
  it('has entries for all four tools', () => {
    expect(Object.keys(TOOL_INFO)).toHaveLength(4);
    for (const tool of KNOWN_TOOLS) {
      expect(TOOL_INFO).toHaveProperty(tool);
    }
  });

  it('every entry has a label string', () => {
    for (const tool of KNOWN_TOOLS) {
      expect(typeof TOOL_INFO[tool].label).toBe('string');
      expect(TOOL_INFO[tool].label.length).toBeGreaterThan(0);
    }
  });

  it('every entry has a valid URL starting with https://', () => {
    for (const tool of KNOWN_TOOLS) {
      const { url } = TOOL_INFO[tool];
      expect(url).toMatch(/^https:\/\//);
      // Also parseable
      expect(() => new URL(url)).not.toThrow();
    }
  });

  it('every entry has a non-empty specialty string', () => {
    for (const tool of KNOWN_TOOLS) {
      expect(typeof TOOL_INFO[tool].specialty).toBe('string');
      expect(TOOL_INFO[tool].specialty.length).toBeGreaterThan(0);
    }
  });

  it('descript points to descript.com', () => {
    expect(new URL(TOOL_INFO.descript.url).hostname).toContain('descript.com');
  });

  it('opusclip points to opus.pro', () => {
    expect(new URL(TOOL_INFO.opusclip.url).hostname).toContain('opus.pro');
  });

  it('hyperframes points to heygen.com', () => {
    expect(new URL(TOOL_INFO.hyperframes.url).hostname).toContain('heygen.com');
  });

  it('canva points to canva.com', () => {
    expect(new URL(TOOL_INFO.canva.url).hostname).toContain('canva.com');
  });

  it('descript label is Descript', () => {
    expect(TOOL_INFO.descript.label).toBe('Descript');
  });

  it('opusclip label is OpusClip', () => {
    expect(TOOL_INFO.opusclip.label).toBe('OpusClip');
  });

  it('canva label is Canva', () => {
    expect(TOOL_INFO.canva.label).toBe('Canva');
  });

  it('descript specialty mentions audio', () => {
    expect(TOOL_INFO.descript.specialty.toLowerCase()).toContain('audio');
  });

  it('opusclip specialty mentions clip or short-form', () => {
    const s = TOOL_INFO.opusclip.specialty.toLowerCase();
    expect(s.includes('clip') || s.includes('short')).toBe(true);
  });

  it('hyperframes specialty mentions AI', () => {
    expect(TOOL_INFO.hyperframes.specialty.toLowerCase()).toContain('ai');
  });

  it('canva specialty mentions thumbnail or image', () => {
    const s = TOOL_INFO.canva.specialty.toLowerCase();
    expect(s.includes('thumbnail') || s.includes('image') || s.includes('template')).toBe(true);
  });
});
