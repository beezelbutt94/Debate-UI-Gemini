import { describe, it, expect } from 'vitest';
import { TOOL_INFO } from '@/lib/tool-suite';

const EXPECTED_TOOLS = ['descript', 'opusclip', 'hyperframes', 'canva'] as const;

describe('TOOL_INFO', () => {
  it('contains exactly the four supported tools', () => {
    expect(Object.keys(TOOL_INFO)).toEqual(expect.arrayContaining(EXPECTED_TOOLS));
    expect(Object.keys(TOOL_INFO).length).toBe(4);
  });

  for (const tool of EXPECTED_TOOLS) {
    describe(`tool: ${tool}`, () => {
      it('has a non-empty label', () => {
        expect(TOOL_INFO[tool].label).toBeTruthy();
        expect(typeof TOOL_INFO[tool].label).toBe('string');
      });

      it('has a valid HTTPS url', () => {
        expect(TOOL_INFO[tool].url).toMatch(/^https:\/\//);
      });

      it('has a non-empty specialty', () => {
        expect(TOOL_INFO[tool].specialty).toBeTruthy();
      });
    });
  }

  it('descript url points to descript.com', () => {
    expect(TOOL_INFO.descript.url).toContain('descript.com');
  });

  it('opusclip url points to opus.pro', () => {
    expect(TOOL_INFO.opusclip.url).toContain('opus.pro');
  });

  it('hyperframes url points to heygen.com', () => {
    expect(TOOL_INFO.hyperframes.url).toContain('heygen.com');
  });

  it('canva url points to canva.com', () => {
    expect(TOOL_INFO.canva.url).toContain('canva.com');
  });
});
