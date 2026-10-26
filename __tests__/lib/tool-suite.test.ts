import { describe, it, expect } from 'vitest';
import { TOOL_INFO } from '@/lib/tool-suite';

describe('TOOL_INFO', () => {
  const tools = ['descript', 'opusclip', 'hyperframes', 'canva'] as const;

  it('contains exactly the four expected tools', () => {
    expect(Object.keys(TOOL_INFO).sort()).toEqual(tools.slice().sort());
  });

  for (const tool of tools) {
    describe(`${tool} entry`, () => {
      it('has a non-empty label', () => {
        expect(TOOL_INFO[tool].label.length).toBeGreaterThan(0);
      });

      it('has a valid URL starting with https://', () => {
        expect(TOOL_INFO[tool].url).toMatch(/^https:\/\//);
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

  it('descript specialty mentions audio', () => {
    expect(TOOL_INFO.descript.specialty.toLowerCase()).toContain('audio');
  });

  it('canva specialty mentions thumbnail', () => {
    expect(TOOL_INFO.canva.specialty.toLowerCase()).toContain('thumbnail');
  });

  it('opusclip specialty mentions short-form or clip', () => {
    const s = TOOL_INFO.opusclip.specialty.toLowerCase();
    expect(s.includes('short') || s.includes('clip')).toBe(true);
  });
});
