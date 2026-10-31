import { describe, it, expect } from 'vitest';
import { TOOL_INFO } from '@/lib/tool-suite';

describe('TOOL_INFO', () => {
  const EXPECTED_TOOLS = ['descript', 'opusclip', 'hyperframes', 'canva'] as const;

  it('defines all four tool entries', () => {
    for (const tool of EXPECTED_TOOLS) {
      expect(TOOL_INFO[tool]).toBeDefined();
    }
  });

  it('each entry has a non-empty label', () => {
    for (const tool of EXPECTED_TOOLS) {
      expect(typeof TOOL_INFO[tool].label).toBe('string');
      expect(TOOL_INFO[tool].label.length).toBeGreaterThan(0);
    }
  });

  it('each entry has a valid https URL', () => {
    for (const tool of EXPECTED_TOOLS) {
      expect(TOOL_INFO[tool].url).toMatch(/^https:\/\//);
    }
  });

  it('each entry has a non-empty specialty description', () => {
    for (const tool of EXPECTED_TOOLS) {
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
});
