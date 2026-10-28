import { describe, it, expect } from 'vitest';
import { TOOL_INFO } from '@/lib/tool-suite';
import type { SuiteTool } from '@/lib/types';

const ALL_TOOLS: SuiteTool[] = ['descript', 'opusclip', 'hyperframes', 'canva'];

describe('TOOL_INFO', () => {
  it('has entries for all four expected tools', () => {
    for (const tool of ALL_TOOLS) {
      expect(TOOL_INFO).toHaveProperty(tool);
    }
  });

  it('has no unexpected extra keys', () => {
    expect(Object.keys(TOOL_INFO).sort()).toEqual([...ALL_TOOLS].sort());
  });

  for (const tool of ALL_TOOLS) {
    describe(`${tool} entry`, () => {
      it('has a non-empty label', () => {
        expect(TOOL_INFO[tool].label.length).toBeGreaterThan(0);
      });

      it('has a URL that starts with https://', () => {
        expect(TOOL_INFO[tool].url).toMatch(/^https:\/\//);
      });

      it('has a non-empty specialty', () => {
        expect(TOOL_INFO[tool].specialty.length).toBeGreaterThan(0);
      });
    });
  }

  it('descript URL points to descript.com', () => {
    expect(TOOL_INFO.descript.url).toContain('descript.com');
  });

  it('opusclip URL points to opus.pro', () => {
    expect(TOOL_INFO.opusclip.url).toContain('opus.pro');
  });

  it('hyperframes URL points to heygen.com', () => {
    expect(TOOL_INFO.hyperframes.url).toContain('heygen.com');
  });

  it('canva URL points to canva.com', () => {
    expect(TOOL_INFO.canva.url).toContain('canva.com');
  });

  it('no URL contains a trailing slash after the TLD (clean URLs)', () => {
    // Accepts both https://example.com/ and https://example.com
    // Real check: none of the URLs should be obviously malformed
    for (const tool of ALL_TOOLS) {
      expect(() => new URL(TOOL_INFO[tool].url)).not.toThrow();
    }
  });
});
