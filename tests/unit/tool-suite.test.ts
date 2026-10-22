import { describe, it, expect } from 'vitest';
import { TOOL_INFO } from '@/lib/tool-suite';

const EXPECTED_TOOLS = ['descript', 'opusclip', 'hyperframes', 'canva'] as const;

describe('TOOL_INFO', () => {
  it('contains all four expected tools', () => {
    for (const tool of EXPECTED_TOOLS) {
      expect(TOOL_INFO).toHaveProperty(tool);
    }
  });

  it('has no extra or missing keys', () => {
    expect(Object.keys(TOOL_INFO).sort()).toEqual([...EXPECTED_TOOLS].sort());
  });

  it.each(EXPECTED_TOOLS)('%s has a non-empty label', (tool) => {
    expect(TOOL_INFO[tool].label.length).toBeGreaterThan(0);
  });

  it.each(EXPECTED_TOOLS)('%s has a valid https URL', (tool) => {
    const { url } = TOOL_INFO[tool];
    expect(() => new URL(url)).not.toThrow();
    expect(new URL(url).protocol).toBe('https:');
  });

  it.each(EXPECTED_TOOLS)('%s has a non-empty specialty description', (tool) => {
    expect(TOOL_INFO[tool].specialty.length).toBeGreaterThan(0);
  });

  it('descript URL is descript.com', () => {
    expect(TOOL_INFO.descript.url).toContain('descript.com');
  });

  it('opusclip URL is opus.pro', () => {
    expect(TOOL_INFO.opusclip.url).toContain('opus.pro');
  });

  it('hyperframes URL is heygen.com', () => {
    expect(TOOL_INFO.hyperframes.url).toContain('heygen.com');
  });

  it('canva URL is canva.com', () => {
    expect(TOOL_INFO.canva.url).toContain('canva.com');
  });

  it('descript specialty mentions audio', () => {
    expect(TOOL_INFO.descript.specialty.toLowerCase()).toContain('audio');
  });

  it('opusclip specialty mentions short-form or clip', () => {
    expect(TOOL_INFO.opusclip.specialty.toLowerCase()).toMatch(/short|clip/);
  });
});
