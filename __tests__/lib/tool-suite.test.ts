import { describe, it, expect } from 'vitest';
import { TOOL_INFO } from '@/lib/tool-suite';

const EXPECTED_TOOLS = ['descript', 'opusclip', 'hyperframes', 'canva'] as const;

describe('TOOL_INFO', () => {
  it('contains all four expected tools', () => {
    for (const tool of EXPECTED_TOOLS) {
      expect(TOOL_INFO).toHaveProperty(tool);
    }
  });

  it('has no extra tools beyond the four', () => {
    expect(Object.keys(TOOL_INFO).sort()).toEqual([...EXPECTED_TOOLS].sort());
  });

  for (const tool of EXPECTED_TOOLS) {
    describe(`tool: ${tool}`, () => {
      it('has a non-empty label', () => {
        expect(typeof TOOL_INFO[tool].label).toBe('string');
        expect(TOOL_INFO[tool].label.length).toBeGreaterThan(0);
      });

      it('has a url starting with https://', () => {
        expect(TOOL_INFO[tool].url).toMatch(/^https:\/\//);
      });

      it('has a non-empty specialty', () => {
        expect(typeof TOOL_INFO[tool].specialty).toBe('string');
        expect(TOOL_INFO[tool].specialty.length).toBeGreaterThan(0);
      });

      it('url does not end with a space', () => {
        expect(TOOL_INFO[tool].url).toBe(TOOL_INFO[tool].url.trim());
      });
    });
  }

  it('descript url points to descript.com', () => {
    expect(TOOL_INFO.descript.url).toContain('descript.com');
  });

  it('opusclip url points to opus.pro', () => {
    expect(TOOL_INFO.opusclip.url).toContain('opus.pro');
  });

  it('hyperframes url points to heygen.com', () => {
    expect(TOOL_INFO.hyperframes.url).toContain('heygen.com');
  });

  it('canva url points to canva.com', () => {
    expect(TOOL_INFO.canva.url).toContain('canva.com');
  });
});
