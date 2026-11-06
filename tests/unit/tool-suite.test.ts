import { describe, it, expect } from 'vitest';
import { TOOL_INFO } from '@/lib/tool-suite';
import type { SuiteTool } from '@/lib/types';

const TOOLS: SuiteTool[] = ['descript', 'opusclip', 'hyperframes', 'canva'];

describe('TOOL_INFO constants', () => {
  it('has an entry for every SuiteTool value', () => {
    for (const tool of TOOLS) {
      expect(TOOL_INFO).toHaveProperty(tool);
    }
  });

  it('every entry has a non-empty label', () => {
    for (const tool of TOOLS) {
      expect(typeof TOOL_INFO[tool].label).toBe('string');
      expect(TOOL_INFO[tool].label.length).toBeGreaterThan(0);
    }
  });

  it('every entry has a valid HTTPS url', () => {
    for (const tool of TOOLS) {
      const { url } = TOOL_INFO[tool];
      expect(url).toMatch(/^https:\/\//);
      expect(() => new URL(url)).not.toThrow();
    }
  });

  it('every entry has a non-empty specialty', () => {
    for (const tool of TOOLS) {
      expect(typeof TOOL_INFO[tool].specialty).toBe('string');
      expect(TOOL_INFO[tool].specialty.length).toBeGreaterThan(0);
    }
  });

  // Spot-check individual tools

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

  it('no two entries share the same URL', () => {
    const urls = TOOLS.map(t => TOOL_INFO[t].url);
    expect(new Set(urls).size).toBe(urls.length);
  });
});
