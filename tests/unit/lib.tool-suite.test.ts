import { describe, it, expect } from 'vitest';
import { TOOL_INFO } from '@/lib/tool-suite';
import type { SuiteTool } from '@/lib/types';

const EXPECTED_TOOLS: SuiteTool[] = ['descript', 'opusclip', 'hyperframes', 'canva'];

describe('TOOL_INFO constant', () => {
  it('contains all four expected tools', () => {
    for (const tool of EXPECTED_TOOLS) {
      expect(TOOL_INFO).toHaveProperty(tool);
    }
  });

  it('contains no extra keys beyond the four tools', () => {
    expect(Object.keys(TOOL_INFO).sort()).toEqual([...EXPECTED_TOOLS].sort());
  });

  for (const tool of EXPECTED_TOOLS) {
    describe(`${tool}`, () => {
      it('has a non-empty label', () => {
        expect(TOOL_INFO[tool].label).toBeTruthy();
        expect(typeof TOOL_INFO[tool].label).toBe('string');
      });

      it('has a valid https URL', () => {
        const { url } = TOOL_INFO[tool];
        expect(url).toMatch(/^https:\/\//);
        // Should be parseable
        expect(() => new URL(url)).not.toThrow();
      });

      it('has a non-empty specialty description', () => {
        expect(TOOL_INFO[tool].specialty).toBeTruthy();
        expect(typeof TOOL_INFO[tool].specialty).toBe('string');
      });
    });
  }

  it('descript URL points to descript.com', () => {
    expect(new URL(TOOL_INFO.descript.url).hostname).toContain('descript.com');
  });

  it('opusclip URL points to opus.pro', () => {
    expect(new URL(TOOL_INFO.opusclip.url).hostname).toContain('opus.pro');
  });

  it('hyperframes URL points to heygen.com', () => {
    expect(new URL(TOOL_INFO.hyperframes.url).hostname).toContain('heygen.com');
  });

  it('canva URL points to canva.com', () => {
    expect(new URL(TOOL_INFO.canva.url).hostname).toContain('canva.com');
  });
});
