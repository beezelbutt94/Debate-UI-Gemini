import { describe, it, expect } from 'vitest';
import { TOOL_INFO } from '@/lib/tool-suite';
import type { SuiteTool } from '@/lib/types';

const ALL_TOOLS: SuiteTool[] = ['descript', 'opusclip', 'hyperframes', 'canva'];

describe('TOOL_INFO', () => {
  it('has an entry for every SuiteTool value', () => {
    for (const tool of ALL_TOOLS) {
      expect(TOOL_INFO[tool]).toBeDefined();
    }
  });

  describe('shape', () => {
    for (const tool of ALL_TOOLS) {
      it(`${tool} has a non-empty label`, () => {
        expect(TOOL_INFO[tool].label).toBeTruthy();
        expect(typeof TOOL_INFO[tool].label).toBe('string');
      });

      it(`${tool} has a valid HTTPS URL`, () => {
        expect(TOOL_INFO[tool].url).toMatch(/^https:\/\//);
      });

      it(`${tool} has a non-empty specialty string`, () => {
        expect(TOOL_INFO[tool].specialty).toBeTruthy();
        expect(typeof TOOL_INFO[tool].specialty).toBe('string');
      });
    }
  });

  describe('individual entries', () => {
    it('descript has the correct label', () => {
      expect(TOOL_INFO.descript.label).toBe('Descript');
    });

    it('descript URL points to descript.com', () => {
      expect(TOOL_INFO.descript.url).toContain('descript.com');
    });

    it('opusclip has the correct label', () => {
      expect(TOOL_INFO.opusclip.label).toBe('OpusClip');
    });

    it('opusclip URL points to opus.pro', () => {
      expect(TOOL_INFO.opusclip.url).toContain('opus.pro');
    });

    it('hyperframes label mentions HeyGen', () => {
      expect(TOOL_INFO.hyperframes.label).toContain('HeyGen');
    });

    it('hyperframes URL points to heygen.com', () => {
      expect(TOOL_INFO.hyperframes.url).toContain('heygen.com');
    });

    it('canva has the correct label', () => {
      expect(TOOL_INFO.canva.label).toBe('Canva');
    });

    it('canva URL points to canva.com', () => {
      expect(TOOL_INFO.canva.url).toContain('canva.com');
    });
  });

  it('contains exactly 4 entries (no phantom tools)', () => {
    expect(Object.keys(TOOL_INFO).length).toBe(4);
  });
});
