import { describe, it, expect } from 'vitest';
import { TOOL_INFO } from '@/lib/tool-suite';
import type { SuiteTool } from '@/lib/types';

const TOOLS: SuiteTool[] = ['descript', 'opusclip', 'hyperframes', 'canva'];

describe('TOOL_INFO constant', () => {
  it('has exactly the four expected tool keys', () => {
    expect(Object.keys(TOOL_INFO).sort()).toEqual(TOOLS.slice().sort());
  });

  it.each(TOOLS)('%s has a non-empty label', (tool) => {
    expect(TOOL_INFO[tool].label.length).toBeGreaterThan(0);
  });

  it.each(TOOLS)('%s has an https URL', (tool) => {
    expect(TOOL_INFO[tool].url).toMatch(/^https:\/\//);
  });

  it.each(TOOLS)('%s URL is parseable', (tool) => {
    expect(() => new URL(TOOL_INFO[tool].url)).not.toThrow();
  });

  it.each(TOOLS)('%s has a non-empty specialty description', (tool) => {
    expect(TOOL_INFO[tool].specialty.length).toBeGreaterThan(0);
  });

  it('descript points to descript.com', () => {
    expect(new URL(TOOL_INFO.descript.url).hostname).toBe('www.descript.com');
  });

  it('opusclip points to opus.pro', () => {
    expect(new URL(TOOL_INFO.opusclip.url).hostname).toBe('www.opus.pro');
  });

  it('hyperframes points to heygen.com', () => {
    expect(new URL(TOOL_INFO.hyperframes.url).hostname).toBe('www.heygen.com');
  });

  it('canva points to canva.com', () => {
    expect(new URL(TOOL_INFO.canva.url).hostname).toBe('www.canva.com');
  });

  it('all entries have exactly label, url, specialty fields', () => {
    for (const tool of TOOLS) {
      const keys = Object.keys(TOOL_INFO[tool]).sort();
      expect(keys).toEqual(['label', 'specialty', 'url']);
    }
  });
});
