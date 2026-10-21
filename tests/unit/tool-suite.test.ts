import { describe, it, expect } from 'vitest';
import { TOOL_INFO } from '@/lib/tool-suite';
import type { SuiteTool } from '@/lib/types';

const ALL_TOOLS: SuiteTool[] = ['descript', 'opusclip', 'hyperframes', 'canva'];

describe('TOOL_INFO', () => {
  it('contains an entry for every SuiteTool value', () => {
    for (const tool of ALL_TOOLS) {
      expect(TOOL_INFO[tool]).toBeDefined();
    }
  });

  it('has exactly the four expected tools (no extras, no missing)', () => {
    expect(Object.keys(TOOL_INFO).sort()).toEqual([...ALL_TOOLS].sort());
  });

  it('every entry has a non-empty label', () => {
    for (const tool of ALL_TOOLS) {
      expect(TOOL_INFO[tool].label.length).toBeGreaterThan(0);
    }
  });

  it('every entry has a non-empty url', () => {
    for (const tool of ALL_TOOLS) {
      expect(TOOL_INFO[tool].url.length).toBeGreaterThan(0);
    }
  });

  it('every entry has a non-empty specialty', () => {
    for (const tool of ALL_TOOLS) {
      expect(TOOL_INFO[tool].specialty.length).toBeGreaterThan(0);
    }
  });

  it('every url is a valid HTTPS URL', () => {
    for (const tool of ALL_TOOLS) {
      const url = TOOL_INFO[tool].url;
      expect(() => new URL(url)).not.toThrow();
      expect(new URL(url).protocol).toBe('https:');
    }
  });

  it('descript points to descript.com', () => {
    expect(TOOL_INFO.descript.url).toContain('descript.com');
  });

  it('opusclip points to opus.pro', () => {
    expect(TOOL_INFO.opusclip.url).toContain('opus.pro');
  });

  it('hyperframes points to heygen.com', () => {
    expect(TOOL_INFO.hyperframes.url).toContain('heygen.com');
  });

  it('canva points to canva.com', () => {
    expect(TOOL_INFO.canva.url).toContain('canva.com');
  });

  it('each label matches the expected display name', () => {
    expect(TOOL_INFO.descript.label).toBe('Descript');
    expect(TOOL_INFO.opusclip.label).toBe('OpusClip');
    expect(TOOL_INFO.hyperframes.label).toBe('HyperFrames by HeyGen');
    expect(TOOL_INFO.canva.label).toBe('Canva');
  });
});
