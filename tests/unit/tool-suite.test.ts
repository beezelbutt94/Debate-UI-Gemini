import { describe, it, expect } from 'vitest';
import { TOOL_INFO } from '@/lib/tool-suite';
import type { SuiteTool } from '@/lib/types';

const ALL_TOOLS: SuiteTool[] = ['descript', 'opusclip', 'hyperframes', 'canva'];

describe('TOOL_INFO', () => {
  it('contains all four tools', () => {
    for (const tool of ALL_TOOLS) {
      expect(TOOL_INFO).toHaveProperty(tool);
    }
  });

  it('has no extra keys beyond the four expected tools', () => {
    expect(Object.keys(TOOL_INFO).sort()).toEqual([...ALL_TOOLS].sort());
  });

  for (const tool of ALL_TOOLS) {
    describe(`${tool}`, () => {
      it('has a non-empty label', () => {
        expect(TOOL_INFO[tool].label.length).toBeGreaterThan(0);
      });

      it('has a valid https URL', () => {
        expect(TOOL_INFO[tool].url).toMatch(/^https:\/\//);
      });

      it('has a non-empty specialty description', () => {
        expect(TOOL_INFO[tool].specialty.length).toBeGreaterThan(0);
      });
    });
  }

  it('descript label is "Descript"', () => {
    expect(TOOL_INFO.descript.label).toBe('Descript');
  });

  it('descript URL is the Descript homepage', () => {
    expect(TOOL_INFO.descript.url).toBe('https://www.descript.com/');
  });

  it('opusclip label is "OpusClip"', () => {
    expect(TOOL_INFO.opusclip.label).toBe('OpusClip');
  });

  it('opusclip URL points to opus.pro', () => {
    expect(TOOL_INFO.opusclip.url).toBe('https://www.opus.pro/');
  });

  it('hyperframes label is "HyperFrames by HeyGen"', () => {
    expect(TOOL_INFO.hyperframes.label).toBe('HyperFrames by HeyGen');
  });

  it('hyperframes URL points to heygen.com', () => {
    expect(TOOL_INFO.hyperframes.url).toBe('https://www.heygen.com/');
  });

  it('canva label is "Canva"', () => {
    expect(TOOL_INFO.canva.label).toBe('Canva');
  });

  it('canva URL points to canva.com', () => {
    expect(TOOL_INFO.canva.url).toBe('https://www.canva.com/');
  });

  it('all URLs are parseable as valid URLs', () => {
    for (const tool of ALL_TOOLS) {
      expect(() => new URL(TOOL_INFO[tool].url)).not.toThrow();
    }
  });

  it('specialty strings are unique across all tools', () => {
    const specialties = ALL_TOOLS.map((t) => TOOL_INFO[t].specialty);
    const unique = new Set(specialties);
    expect(unique.size).toBe(ALL_TOOLS.length);
  });
});
