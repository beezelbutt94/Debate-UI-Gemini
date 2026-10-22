import { describe, it, expect } from 'vitest';
import { TOOL_INFO } from '@/lib/tool-suite';

describe('TOOL_INFO', () => {
  const platforms = ['descript', 'opusclip', 'hyperframes', 'canva'] as const;

  it('defines all four tools', () => {
    for (const tool of platforms) {
      expect(TOOL_INFO[tool]).toBeDefined();
    }
  });

  it('each entry has a non-empty label', () => {
    for (const tool of platforms) {
      expect(typeof TOOL_INFO[tool].label).toBe('string');
      expect(TOOL_INFO[tool].label.length).toBeGreaterThan(0);
    }
  });

  it('each entry has a valid https URL', () => {
    for (const tool of platforms) {
      expect(TOOL_INFO[tool].url).toMatch(/^https:\/\//);
    }
  });

  it('each entry has a non-empty specialty description', () => {
    for (const tool of platforms) {
      expect(TOOL_INFO[tool].specialty.length).toBeGreaterThan(0);
    }
  });

  it('descript label is "Descript"', () => {
    expect(TOOL_INFO.descript.label).toBe('Descript');
  });

  it('descript URL points to descript.com', () => {
    expect(TOOL_INFO.descript.url).toContain('descript.com');
  });

  it('opusclip URL points to opus.pro', () => {
    expect(TOOL_INFO.opusclip.url).toContain('opus.pro');
  });

  it('hyperframes URL points to heygen.com', () => {
    expect(TOOL_INFO.hyperframes.url).toContain('heygen.com');
  });

  it('canva URL points to canva.com', () => {
    expect(TOOL_INFO.canva.url).toContain('canva.com');
  });

  it('no two tools share the same URL', () => {
    const urls = platforms.map((t) => TOOL_INFO[t].url);
    const unique = new Set(urls);
    expect(unique.size).toBe(platforms.length);
  });

  it('no two tools share the same label', () => {
    const labels = platforms.map((t) => TOOL_INFO[t].label);
    const unique = new Set(labels);
    expect(unique.size).toBe(platforms.length);
  });
});
