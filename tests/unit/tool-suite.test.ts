import { describe, it, expect } from 'vitest';
import { TOOL_INFO } from '@/lib/tool-suite';

const TOOLS = ['descript', 'opusclip', 'hyperframes', 'canva'] as const;

describe('TOOL_INFO', () => {
  it('has an entry for every SuiteTool value', () => {
    for (const tool of TOOLS) {
      expect(TOOL_INFO).toHaveProperty(tool);
    }
  });

  it('every entry has a non-empty label', () => {
    for (const tool of TOOLS) {
      expect(TOOL_INFO[tool].label).toBeTruthy();
      expect(typeof TOOL_INFO[tool].label).toBe('string');
    }
  });

  it('every entry has a valid HTTPS url', () => {
    for (const tool of TOOLS) {
      const url = TOOL_INFO[tool].url;
      expect(url).toMatch(/^https:\/\//);
      expect(() => new URL(url)).not.toThrow();
    }
  });

  it('every entry has a non-empty specialty', () => {
    for (const tool of TOOLS) {
      expect(TOOL_INFO[tool].specialty).toBeTruthy();
    }
  });

  it('descript label is "Descript"', () => {
    expect(TOOL_INFO.descript.label).toBe('Descript');
  });

  it('opusclip label is "OpusClip"', () => {
    expect(TOOL_INFO.opusclip.label).toBe('OpusClip');
  });

  it('hyperframes url points to heygen.com', () => {
    expect(TOOL_INFO.hyperframes.url).toContain('heygen.com');
  });

  it('canva url points to canva.com', () => {
    expect(TOOL_INFO.canva.url).toContain('canva.com');
  });

  it('descript specialty mentions audio', () => {
    expect(TOOL_INFO.descript.specialty.toLowerCase()).toContain('audio');
  });

  it('opusclip specialty mentions clip or short', () => {
    expect(TOOL_INFO.opusclip.specialty.toLowerCase()).toMatch(/clip|short/);
  });

  it('no two tools share the same url', () => {
    const urls = TOOLS.map((t) => TOOL_INFO[t].url);
    const unique = new Set(urls);
    expect(unique.size).toBe(urls.length);
  });
});
