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

  it('every entry has a URL that starts with https://', () => {
    for (const tool of ALL_TOOLS) {
      expect(TOOL_INFO[tool].url).toMatch(/^https:\/\//);
    }
  });

  it('every entry has a non-empty specialty', () => {
    for (const tool of ALL_TOOLS) {
      expect(TOOL_INFO[tool].specialty.length).toBeGreaterThan(0);
    }
  });

  it('descript label is "Descript"', () => {
    expect(TOOL_INFO.descript.label).toBe('Descript');
  });

  it('descript URL is correct', () => {
    expect(TOOL_INFO.descript.url).toBe('https://www.descript.com/');
  });

  it('descript specialty mentions audio', () => {
    expect(TOOL_INFO.descript.specialty.toLowerCase()).toContain('audio');
  });

  it('opusclip label is "OpusClip"', () => {
    expect(TOOL_INFO.opusclip.label).toBe('OpusClip');
  });

  it('opusclip URL is correct', () => {
    expect(TOOL_INFO.opusclip.url).toBe('https://www.opus.pro/');
  });

  it('opusclip specialty mentions short-form', () => {
    expect(TOOL_INFO.opusclip.specialty.toLowerCase()).toContain('short');
  });

  it('hyperframes label contains "HyperFrames"', () => {
    expect(TOOL_INFO.hyperframes.label).toContain('HyperFrames');
  });

  it('hyperframes URL points to heygen.com', () => {
    expect(TOOL_INFO.hyperframes.url).toContain('heygen.com');
  });

  it('hyperframes specialty mentions AI', () => {
    expect(TOOL_INFO.hyperframes.specialty.toLowerCase()).toContain('ai');
  });

  it('canva label is "Canva"', () => {
    expect(TOOL_INFO.canva.label).toBe('Canva');
  });

  it('canva URL is correct', () => {
    expect(TOOL_INFO.canva.url).toBe('https://www.canva.com/');
  });

  it('canva specialty mentions thumbnail', () => {
    expect(TOOL_INFO.canva.specialty.toLowerCase()).toContain('thumbnail');
  });

  it('no two tools share the same URL', () => {
    const urls = ALL_TOOLS.map((t) => TOOL_INFO[t].url);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it('no two tools share the same label', () => {
    const labels = ALL_TOOLS.map((t) => TOOL_INFO[t].label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('contains exactly 4 tools', () => {
    expect(Object.keys(TOOL_INFO).length).toBe(4);
  });
});
