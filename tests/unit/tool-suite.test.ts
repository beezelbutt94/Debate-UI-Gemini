import { describe, it, expect } from 'vitest';
import { TOOL_INFO } from '@/lib/tool-suite';

const TOOLS = ['descript', 'opusclip', 'hyperframes', 'canva'] as const;

describe('TOOL_INFO', () => {
  it('contains all four expected tools', () => {
    for (const tool of TOOLS) {
      expect(TOOL_INFO).toHaveProperty(tool);
    }
  });

  it.each(TOOLS)('%s has a non-empty label', (tool) => {
    expect(TOOL_INFO[tool].label.length).toBeGreaterThan(0);
  });

  it.each(TOOLS)('%s has a valid HTTPS URL', (tool) => {
    const url = TOOL_INFO[tool].url;
    expect(url).toMatch(/^https:\/\//);
    expect(() => new URL(url)).not.toThrow();
  });

  it.each(TOOLS)('%s has a non-empty specialty', (tool) => {
    expect(TOOL_INFO[tool].specialty.length).toBeGreaterThan(0);
  });

  it('descript label is "Descript"', () => {
    expect(TOOL_INFO.descript.label).toBe('Descript');
  });

  it('opusclip label is "OpusClip"', () => {
    expect(TOOL_INFO.opusclip.label).toBe('OpusClip');
  });

  it('hyperframes label contains "HyperFrames"', () => {
    expect(TOOL_INFO.hyperframes.label).toContain('HyperFrames');
  });

  it('canva label is "Canva"', () => {
    expect(TOOL_INFO.canva.label).toBe('Canva');
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

  it('contains exactly 4 tools (no extra keys)', () => {
    expect(Object.keys(TOOL_INFO)).toHaveLength(4);
  });
});
