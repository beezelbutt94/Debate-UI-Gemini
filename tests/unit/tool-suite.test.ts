import { describe, it, expect } from 'vitest';
import { TOOL_INFO } from '@/lib/tool-suite';
import type { SuiteTool } from '@/lib/types';

const ALL_TOOLS: SuiteTool[] = ['descript', 'opusclip', 'hyperframes', 'canva'];

describe('TOOL_INFO', () => {
  it('contains all four expected tools', () => {
    expect(Object.keys(TOOL_INFO)).toEqual(expect.arrayContaining(ALL_TOOLS));
    expect(Object.keys(TOOL_INFO).length).toBe(ALL_TOOLS.length);
  });

  for (const tool of ALL_TOOLS) {
    describe(`${tool}`, () => {
      it('has a non-empty label', () => {
        expect(TOOL_INFO[tool].label.length).toBeGreaterThan(0);
      });

      it('has a valid https URL', () => {
        expect(TOOL_INFO[tool].url).toMatch(/^https:\/\//);
      });

      it('has a non-empty specialty', () => {
        expect(TOOL_INFO[tool].specialty.length).toBeGreaterThan(0);
      });

      it('URL ends with a trailing slash', () => {
        expect(TOOL_INFO[tool].url).toMatch(/\/$/);
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

  it('all URLs are distinct', () => {
    const urls = ALL_TOOLS.map((t) => TOOL_INFO[t].url);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it('all labels are distinct', () => {
    const labels = ALL_TOOLS.map((t) => TOOL_INFO[t].label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('descript specialty mentions audio-related functionality', () => {
    expect(TOOL_INFO.descript.specialty.toLowerCase()).toMatch(/audio|transcript|sound/);
  });

  it('opusclip specialty mentions short-form or clip', () => {
    expect(TOOL_INFO.opusclip.specialty.toLowerCase()).toMatch(/short|clip/);
  });

  it('canva specialty mentions thumbnail or image', () => {
    expect(TOOL_INFO.canva.specialty.toLowerCase()).toMatch(/thumbnail|image|template/);
  });
});
