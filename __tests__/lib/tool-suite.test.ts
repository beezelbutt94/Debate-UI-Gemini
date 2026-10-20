import { describe, it, expect } from 'vitest';
import { TOOL_INFO } from '@/lib/tool-suite';
import type { SuiteTool } from '@/lib/types';

const KNOWN_TOOLS: SuiteTool[] = ['descript', 'opusclip', 'hyperframes', 'canva'];

describe('TOOL_INFO', () => {
  it('contains entries for all four expected tools', () => {
    for (const tool of KNOWN_TOOLS) {
      expect(TOOL_INFO).toHaveProperty(tool);
    }
  });

  it('has exactly the four expected keys', () => {
    expect(Object.keys(TOOL_INFO).sort()).toEqual(KNOWN_TOOLS.slice().sort());
  });

  for (const tool of KNOWN_TOOLS) {
    describe(`${tool} entry`, () => {
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
});
