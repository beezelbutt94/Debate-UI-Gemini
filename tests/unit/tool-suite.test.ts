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
      expect(TOOL_INFO[tool].label.length).toBeGreaterThan(0);
    }
  });

  it('every entry has a URL that starts with https://', () => {
    for (const tool of TOOLS) {
      expect(TOOL_INFO[tool].url).toMatch(/^https:\/\//);
    }
  });

  it('every URL is parseable', () => {
    for (const tool of TOOLS) {
      expect(() => new URL(TOOL_INFO[tool].url)).not.toThrow();
    }
  });

  it('every entry has a non-empty specialty', () => {
    for (const tool of TOOLS) {
      expect(TOOL_INFO[tool].specialty.length).toBeGreaterThan(0);
    }
  });

  it('descript URL points to descript.com', () => {
    expect(new URL(TOOL_INFO.descript.url).hostname).toContain('descript.com');
  });

  it('opusclip URL points to opus.pro', () => {
    expect(new URL(TOOL_INFO.opusclip.url).hostname).toContain('opus.pro');
  });

  it('hyperframes URL points to heygen.com', () => {
    expect(new URL(TOOL_INFO.hyperframes.url).hostname).toContain('heygen.com');
  });

  it('canva URL points to canva.com', () => {
    expect(new URL(TOOL_INFO.canva.url).hostname).toContain('canva.com');
  });

  it('no extra keys beyond the four tools', () => {
    expect(Object.keys(TOOL_INFO).sort()).toEqual([...TOOLS].sort());
  });
});
