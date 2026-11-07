import { describe, it, expect } from 'vitest';
import { TOOL_INFO } from '@/lib/tool-suite';

const TOOLS = ['descript', 'opusclip', 'hyperframes', 'canva'] as const;

describe('TOOL_INFO', () => {
  it('contains entries for all four tools', () => {
    expect(Object.keys(TOOL_INFO).sort()).toEqual([...TOOLS].sort());
  });

  for (const tool of TOOLS) {
    describe(`tool "${tool}"`, () => {
      it('has a non-empty label', () => {
        expect(TOOL_INFO[tool].label.trim().length).toBeGreaterThan(0);
      });

      it('has a valid HTTPS url', () => {
        const { url } = TOOL_INFO[tool];
        expect(() => new URL(url)).not.toThrow();
        expect(new URL(url).protocol).toBe('https:');
      });

      it('has a non-empty specialty description', () => {
        expect(TOOL_INFO[tool].specialty.trim().length).toBeGreaterThan(0);
      });
    });
  }

  it('descript url points to descript.com', () => {
    expect(new URL(TOOL_INFO.descript.url).hostname).toContain('descript.com');
  });

  it('opusclip url points to opus.pro', () => {
    expect(new URL(TOOL_INFO.opusclip.url).hostname).toContain('opus.pro');
  });

  it('hyperframes url points to heygen.com', () => {
    expect(new URL(TOOL_INFO.hyperframes.url).hostname).toContain('heygen.com');
  });

  it('canva url points to canva.com', () => {
    expect(new URL(TOOL_INFO.canva.url).hostname).toContain('canva.com');
  });
});
