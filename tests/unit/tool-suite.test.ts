import { describe, it, expect } from 'vitest';
import { TOOL_INFO } from '@/lib/tool-suite';
import type { SuiteTool } from '@/lib/types';

const EXPECTED_TOOLS: SuiteTool[] = ['descript', 'opusclip', 'hyperframes', 'canva'];

describe('TOOL_INFO', () => {
  it('contains all four expected tools', () => {
    for (const tool of EXPECTED_TOOLS) {
      expect(TOOL_INFO).toHaveProperty(tool);
    }
  });

  it('has no unexpected tools', () => {
    const actualKeys = Object.keys(TOOL_INFO);
    for (const key of actualKeys) {
      expect(EXPECTED_TOOLS).toContain(key);
    }
  });

  it('every entry has a non-empty label', () => {
    for (const tool of EXPECTED_TOOLS) {
      expect(TOOL_INFO[tool].label.length).toBeGreaterThan(0);
    }
  });

  it('every entry has a URL starting with https://', () => {
    for (const tool of EXPECTED_TOOLS) {
      expect(TOOL_INFO[tool].url).toMatch(/^https:\/\//);
    }
  });

  it('every entry has a non-empty specialty description', () => {
    for (const tool of EXPECTED_TOOLS) {
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

  it('all URLs use HTTPS (no HTTP)', () => {
    for (const tool of EXPECTED_TOOLS) {
      expect(TOOL_INFO[tool].url).not.toMatch(/^http:\/\//);
    }
  });
});
