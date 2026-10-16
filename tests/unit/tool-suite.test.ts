import { describe, it, expect } from 'vitest';
import { TOOL_INFO } from '@/lib/tool-suite';
import type { SuiteTool } from '@/lib/types';

const EXPECTED_TOOLS: SuiteTool[] = ['descript', 'opusclip', 'hyperframes', 'canva'];

describe('TOOL_INFO', () => {
  it('defines all four expected tools', () => {
    EXPECTED_TOOLS.forEach((tool) => {
      expect(TOOL_INFO).toHaveProperty(tool);
    });
  });

  it('has no extra / unexpected keys', () => {
    expect(Object.keys(TOOL_INFO).sort()).toEqual([...EXPECTED_TOOLS].sort());
  });

  EXPECTED_TOOLS.forEach((tool) => {
    describe(`TOOL_INFO["${tool}"]`, () => {
      it('has a non-empty label', () => {
        expect(TOOL_INFO[tool].label.length).toBeGreaterThan(0);
      });

      it('has a valid HTTPS url', () => {
        const url = TOOL_INFO[tool].url;
        expect(() => new URL(url)).not.toThrow();
        expect(url.startsWith('https://')).toBe(true);
      });

      it('has a non-empty specialty description', () => {
        expect(TOOL_INFO[tool].specialty.length).toBeGreaterThan(0);
      });
    });
  });

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
