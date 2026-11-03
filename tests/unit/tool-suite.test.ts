import { describe, it, expect } from 'vitest';
import { TOOL_INFO } from '@/lib/tool-suite';

const EXPECTED_TOOLS = ['descript', 'opusclip', 'hyperframes', 'canva'] as const;

describe('TOOL_INFO', () => {
  it('contains all four expected tool keys', () => {
    for (const tool of EXPECTED_TOOLS) {
      expect(TOOL_INFO).toHaveProperty(tool);
    }
  });

  it('has exactly four tools', () => {
    expect(Object.keys(TOOL_INFO)).toHaveLength(4);
  });

  for (const tool of EXPECTED_TOOLS) {
    describe(`TOOL_INFO.${tool}`, () => {
      it('has a non-empty label', () => {
        expect(TOOL_INFO[tool].label.length).toBeGreaterThan(0);
      });

      it('has a valid HTTPS URL', () => {
        const { url } = TOOL_INFO[tool];
        expect(url).toMatch(/^https:\/\//);
        // Should be parseable
        expect(() => new URL(url)).not.toThrow();
      });

      it('URL ends with a slash (top-level product page)', () => {
        // All four tool URLs in the constant end with /
        expect(TOOL_INFO[tool].url.endsWith('/')).toBe(true);
      });

      it('has a non-empty specialty description', () => {
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

  it('descript label is "Descript"', () => {
    expect(TOOL_INFO.descript.label).toBe('Descript');
  });

  it('opusclip label is "OpusClip"', () => {
    expect(TOOL_INFO.opusclip.label).toBe('OpusClip');
  });

  it('canva label is "Canva"', () => {
    expect(TOOL_INFO.canva.label).toBe('Canva');
  });
});
