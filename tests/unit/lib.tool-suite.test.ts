import { describe, it, expect } from 'vitest';
import { TOOL_INFO } from '@/lib/tool-suite';
import type { SuiteTool } from '@/lib/types';

const EXPECTED_TOOLS: SuiteTool[] = ['descript', 'opusclip', 'hyperframes', 'canva'];

describe('TOOL_INFO', () => {
  it('defines exactly the four expected tools', () => {
    const keys = Object.keys(TOOL_INFO).sort();
    expect(keys).toEqual([...EXPECTED_TOOLS].sort());
  });

  for (const tool of EXPECTED_TOOLS) {
    describe(`TOOL_INFO.${tool}`, () => {
      it('has a non-empty label', () => {
        expect(TOOL_INFO[tool].label.length).toBeGreaterThan(0);
      });

      it('has a valid https URL', () => {
        expect(TOOL_INFO[tool].url).toMatch(/^https:\/\//);
      });

      it('URL is parseable', () => {
        expect(() => new URL(TOOL_INFO[tool].url)).not.toThrow();
      });

      it('has a non-empty specialty string', () => {
        expect(TOOL_INFO[tool].specialty.length).toBeGreaterThan(0);
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
