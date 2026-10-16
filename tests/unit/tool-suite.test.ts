import { describe, it, expect } from 'vitest';
import { TOOL_INFO } from '@/lib/tool-suite';

const EXPECTED_TOOLS = ['descript', 'opusclip', 'hyperframes', 'canva'] as const;

describe('TOOL_INFO', () => {
  it('contains all four expected tools', () => {
    for (const tool of EXPECTED_TOOLS) {
      expect(TOOL_INFO).toHaveProperty(tool);
    }
  });

  it('has no extra keys beyond the four expected tools', () => {
    expect(Object.keys(TOOL_INFO).sort()).toEqual([...EXPECTED_TOOLS].sort());
  });

  for (const tool of EXPECTED_TOOLS) {
    describe(`tool: ${tool}`, () => {
      it('has a non-empty label', () => {
        expect(TOOL_INFO[tool].label).toBeTruthy();
        expect(typeof TOOL_INFO[tool].label).toBe('string');
      });

      it('has a valid https URL', () => {
        const url = TOOL_INFO[tool].url;
        expect(() => new URL(url)).not.toThrow();
        expect(new URL(url).protocol).toBe('https:');
      });

      it('has a non-empty specialty description', () => {
        expect(TOOL_INFO[tool].specialty).toBeTruthy();
        expect(typeof TOOL_INFO[tool].specialty).toBe('string');
      });
    });
  }

  it('descript URL is descript.com', () => {
    expect(TOOL_INFO.descript.url).toContain('descript.com');
  });

  it('opusclip URL is opus.pro', () => {
    expect(TOOL_INFO.opusclip.url).toContain('opus.pro');
  });

  it('hyperframes URL is heygen.com', () => {
    expect(TOOL_INFO.hyperframes.url).toContain('heygen.com');
  });

  it('canva URL is canva.com', () => {
    expect(TOOL_INFO.canva.url).toContain('canva.com');
  });

  it('descript label is Descript', () => {
    expect(TOOL_INFO.descript.label).toBe('Descript');
  });

  it('canva label is Canva', () => {
    expect(TOOL_INFO.canva.label).toBe('Canva');
  });
});
