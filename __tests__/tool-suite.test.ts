import { describe, it, expect } from 'vitest';
import { TOOL_INFO } from '@/lib/tool-suite';
import type { SuiteTool } from '@/lib/types';

const ALL_TOOLS: SuiteTool[] = ['descript', 'opusclip', 'hyperframes', 'canva'];

describe('TOOL_INFO', () => {
  it('is defined', () => {
    expect(TOOL_INFO).toBeDefined();
  });

  it('contains an entry for every SuiteTool', () => {
    for (const tool of ALL_TOOLS) {
      expect(TOOL_INFO).toHaveProperty(tool);
    }
  });

  it('has no extra / unexpected keys', () => {
    const keys = Object.keys(TOOL_INFO);
    expect(keys.sort()).toEqual([...ALL_TOOLS].sort());
  });

  it.each(ALL_TOOLS)('%s has a non-empty label', (tool) => {
    expect(TOOL_INFO[tool].label.length).toBeGreaterThan(0);
  });

  it.each(ALL_TOOLS)('%s has a valid https URL', (tool) => {
    const { url } = TOOL_INFO[tool];
    expect(url).toMatch(/^https:\/\//);
    expect(() => new URL(url)).not.toThrow();
  });

  it.each(ALL_TOOLS)('%s has a non-empty specialty description', (tool) => {
    expect(TOOL_INFO[tool].specialty.length).toBeGreaterThan(0);
  });

  // Spot-check known stable values
  it('descript has the correct URL', () => {
    expect(TOOL_INFO.descript.url).toBe('https://www.descript.com/');
  });

  it('opusclip has the correct URL', () => {
    expect(TOOL_INFO.opusclip.url).toBe('https://www.opus.pro/');
  });

  it('hyperframes has the correct URL', () => {
    expect(TOOL_INFO.hyperframes.url).toBe('https://www.heygen.com/');
  });

  it('canva has the correct URL', () => {
    expect(TOOL_INFO.canva.url).toBe('https://www.canva.com/');
  });

  it('descript label is "Descript"', () => {
    expect(TOOL_INFO.descript.label).toBe('Descript');
  });

  it('opusclip label is "OpusClip"', () => {
    expect(TOOL_INFO.opusclip.label).toBe('OpusClip');
  });

  it('canva label is "Canva"', () => {
    expect(TOOL_INFO.canva.label).toBe('Canva');
  });

  it('all URLs are reachable-looking (host is non-empty)', () => {
    for (const tool of ALL_TOOLS) {
      const parsed = new URL(TOOL_INFO[tool].url);
      expect(parsed.hostname.length).toBeGreaterThan(0);
    }
  });

  it('descript specialty mentions audio', () => {
    expect(TOOL_INFO.descript.specialty.toLowerCase()).toContain('audio');
  });

  it('opusclip specialty mentions short-form or clip', () => {
    expect(TOOL_INFO.opusclip.specialty.toLowerCase()).toMatch(/short|clip/);
  });

  it('canva specialty mentions thumbnail or image or template', () => {
    expect(TOOL_INFO.canva.specialty.toLowerCase()).toMatch(/thumbnail|image|template/);
  });
});
