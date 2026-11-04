import { describe, it, expect } from 'vitest';
import { TOOL_INFO } from '@/lib/tool-suite';

const EXPECTED_TOOLS = ['descript', 'opusclip', 'hyperframes', 'canva'] as const;

describe('TOOL_INFO', () => {
  it('contains all four expected tools', () => {
    for (const tool of EXPECTED_TOOLS) {
      expect(TOOL_INFO).toHaveProperty(tool);
    }
  });

  it('contains no extra unexpected tools', () => {
    const keys = Object.keys(TOOL_INFO);
    expect(keys.sort()).toEqual([...EXPECTED_TOOLS].sort());
  });

  it('every entry has a non-empty label', () => {
    for (const tool of EXPECTED_TOOLS) {
      expect(TOOL_INFO[tool].label.length).toBeGreaterThan(0);
    }
  });

  it('every entry has a valid https URL', () => {
    for (const tool of EXPECTED_TOOLS) {
      const { url } = TOOL_INFO[tool];
      expect(url).toMatch(/^https:\/\//);
      expect(() => new URL(url)).not.toThrow();
    }
  });

  it('every entry has a non-empty specialty string', () => {
    for (const tool of EXPECTED_TOOLS) {
      expect(TOOL_INFO[tool].specialty.length).toBeGreaterThan(0);
    }
  });

  it('descript URL points to descript.com', () => {
    expect(new URL(TOOL_INFO.descript.url).hostname).toContain('descript');
  });

  it('opusclip URL points to opus.pro', () => {
    expect(new URL(TOOL_INFO.opusclip.url).hostname).toContain('opus');
  });

  it('canva URL points to canva.com', () => {
    expect(new URL(TOOL_INFO.canva.url).hostname).toContain('canva');
  });

  it('hyperframes URL points to heygen.com', () => {
    expect(new URL(TOOL_INFO.hyperframes.url).hostname).toContain('heygen');
  });

  it('labels are distinct', () => {
    const labels = EXPECTED_TOOLS.map((t) => TOOL_INFO[t].label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('URLs are distinct', () => {
    const urls = EXPECTED_TOOLS.map((t) => TOOL_INFO[t].url);
    expect(new Set(urls).size).toBe(urls.length);
  });
});
