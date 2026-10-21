import { describe, it, expect } from 'vitest';
import { TOOL_INFO } from '@/lib/tool-suite';

const EXPECTED_TOOLS = ['descript', 'opusclip', 'hyperframes', 'canva'] as const;

describe('TOOL_INFO', () => {
  it('contains exactly the four expected tools', () => {
    expect(Object.keys(TOOL_INFO).sort()).toEqual([...EXPECTED_TOOLS].sort());
  });

  for (const tool of EXPECTED_TOOLS) {
    describe(`tool: ${tool}`, () => {
      it('has a non-empty label', () => {
        expect(TOOL_INFO[tool].label.length).toBeGreaterThan(0);
      });

      it('has a valid HTTPS URL', () => {
        const url = TOOL_INFO[tool].url;
        expect(url).toMatch(/^https:\/\//);
        expect(() => new URL(url)).not.toThrow();
      });

      it('has a non-empty specialty description', () => {
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

  it('descript specialty mentions audio or transcript', () => {
    expect(TOOL_INFO.descript.specialty.toLowerCase()).toMatch(/audio|transcript/);
  });

  it('opusclip specialty mentions clip or short-form', () => {
    expect(TOOL_INFO.opusclip.specialty.toLowerCase()).toMatch(/clip|short/);
  });

  it('hyperframes specialty mentions avatar or b-roll or video', () => {
    expect(TOOL_INFO.hyperframes.specialty.toLowerCase()).toMatch(/avatar|b-roll|video/);
  });

  it('canva specialty mentions thumbnail or image or template', () => {
    expect(TOOL_INFO.canva.specialty.toLowerCase()).toMatch(/thumbnail|image|template/);
  });

  it('all labels are strings', () => {
    for (const tool of EXPECTED_TOOLS) {
      expect(typeof TOOL_INFO[tool].label).toBe('string');
    }
  });

  it('all urls are strings', () => {
    for (const tool of EXPECTED_TOOLS) {
      expect(typeof TOOL_INFO[tool].url).toBe('string');
    }
  });
});
