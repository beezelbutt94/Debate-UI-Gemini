import { describe, it, expect } from 'vitest';
import { TOOL_INFO } from '@/lib/tool-suite';

const ALL_TOOLS = ['descript', 'opusclip', 'hyperframes', 'canva'] as const;

describe('TOOL_INFO', () => {
  it('contains exactly four tools', () => {
    expect(Object.keys(TOOL_INFO)).toHaveLength(4);
  });

  it('contains the expected tool keys', () => {
    expect(Object.keys(TOOL_INFO)).toEqual(
      expect.arrayContaining(['descript', 'opusclip', 'hyperframes', 'canva'])
    );
  });

  for (const tool of ALL_TOOLS) {
    describe(`["${tool}"]`, () => {
      it('has a non-empty label', () => {
        expect(TOOL_INFO[tool].label.length).toBeGreaterThan(0);
      });

      it('has an https URL', () => {
        expect(TOOL_INFO[tool].url).toMatch(/^https:\/\//);
      });

      it('has a non-empty specialty description', () => {
        expect(TOOL_INFO[tool].specialty.length).toBeGreaterThan(0);
      });
    });
  }

  it('descript has the correct URL', () => {
    expect(TOOL_INFO.descript.url).toBe('https://www.descript.com/');
  });

  it('opusclip has the correct URL', () => {
    expect(TOOL_INFO.opusclip.url).toBe('https://www.opus.pro/');
  });

  it('hyperframes has the correct URL', () => {
    expect(TOOL_INFO.hyperframes.url).toBe('https://www.heygen.com/');
  });

  it('canva has the correct URL', () => {
    expect(TOOL_INFO.canva.url).toBe('https://www.canva.com/');
  });

  it('descript label is "Descript"', () => {
    expect(TOOL_INFO.descript.label).toBe('Descript');
  });

  it('canva label is "Canva"', () => {
    expect(TOOL_INFO.canva.label).toBe('Canva');
  });

  it('every tool URL is a valid URL', () => {
    for (const tool of ALL_TOOLS) {
      expect(() => new URL(TOOL_INFO[tool].url)).not.toThrow();
    }
  });
});
