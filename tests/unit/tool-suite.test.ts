import { describe, it, expect } from 'vitest';
import { TOOL_INFO } from '@/lib/tool-suite';
import type { SuiteTool } from '@/lib/types';

const ALL_TOOLS: SuiteTool[] = ['descript', 'opusclip', 'hyperframes', 'canva'];

describe('TOOL_INFO', () => {
  it('has an entry for every SuiteTool', () => {
    for (const tool of ALL_TOOLS) {
      expect(TOOL_INFO[tool]).toBeDefined();
    }
  });

  it('every entry has a non-empty label', () => {
    for (const tool of ALL_TOOLS) {
      expect(TOOL_INFO[tool].label.length).toBeGreaterThan(0);
    }
  });

  it('every entry has a non-empty specialty', () => {
    for (const tool of ALL_TOOLS) {
      expect(TOOL_INFO[tool].specialty.length).toBeGreaterThan(0);
    }
  });

  it('every URL starts with https://', () => {
    for (const tool of ALL_TOOLS) {
      expect(TOOL_INFO[tool].url).toMatch(/^https:\/\//);
    }
  });

  it('descript label is "Descript"', () => {
    expect(TOOL_INFO.descript.label).toBe('Descript');
  });

  it('opusclip label is "OpusClip"', () => {
    expect(TOOL_INFO.opusclip.label).toBe('OpusClip');
  });

  it('hyperframes mentions HeyGen in its URL', () => {
    expect(TOOL_INFO.hyperframes.url).toContain('heygen.com');
  });

  it('canva URL points to canva.com', () => {
    expect(TOOL_INFO.canva.url).toContain('canva.com');
  });

  it('has exactly 4 entries (one per SuiteTool)', () => {
    expect(Object.keys(TOOL_INFO).length).toBe(4);
  });

  it('all keys match the SuiteTool type values', () => {
    const keys = Object.keys(TOOL_INFO);
    for (const tool of ALL_TOOLS) {
      expect(keys).toContain(tool);
    }
  });
});
