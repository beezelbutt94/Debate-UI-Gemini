import { describe, it, expect } from 'vitest';
import { TOOL_INFO } from '@/lib/tool-suite';

describe('TOOL_INFO', () => {
  const expectedTools = ['descript', 'opusclip', 'hyperframes', 'canva'] as const;

  it('has an entry for every SuiteTool', () => {
    for (const tool of expectedTools) {
      expect(TOOL_INFO[tool]).toBeDefined();
    }
  });

  it('every entry has a non-empty label', () => {
    for (const tool of expectedTools) {
      expect(typeof TOOL_INFO[tool].label).toBe('string');
      expect(TOOL_INFO[tool].label.length).toBeGreaterThan(0);
    }
  });

  it('every entry has a valid https URL', () => {
    for (const tool of expectedTools) {
      const url = TOOL_INFO[tool].url;
      expect(url).toMatch(/^https:\/\//);
      expect(() => new URL(url)).not.toThrow();
    }
  });

  it('every entry has a non-empty specialty', () => {
    for (const tool of expectedTools) {
      expect(typeof TOOL_INFO[tool].specialty).toBe('string');
      expect(TOOL_INFO[tool].specialty.length).toBeGreaterThan(0);
    }
  });

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

  it('has exactly 4 tools (no extras)', () => {
    expect(Object.keys(TOOL_INFO).length).toBe(4);
  });
});
