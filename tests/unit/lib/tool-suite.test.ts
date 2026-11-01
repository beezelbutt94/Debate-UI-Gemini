import { describe, it, expect } from 'vitest';
import { TOOL_INFO } from '@/lib/tool-suite';
import type { SuiteTool } from '@/lib/types';

const TOOLS: SuiteTool[] = ['descript', 'opusclip', 'hyperframes', 'canva'];

describe('TOOL_INFO', () => {
  it('contains entries for all four supported tools', () => {
    for (const tool of TOOLS) {
      expect(TOOL_INFO[tool]).toBeDefined();
    }
  });

  for (const tool of TOOLS) {
    describe(`TOOL_INFO.${tool}`, () => {
      it('has a non-empty label', () => {
        expect(typeof TOOL_INFO[tool].label).toBe('string');
        expect(TOOL_INFO[tool].label.length).toBeGreaterThan(0);
      });

      it('has a valid HTTPS url', () => {
        const { url } = TOOL_INFO[tool];
        expect(url).toMatch(/^https:\/\//);
        // Verify it's a parseable URL.
        expect(() => new URL(url)).not.toThrow();
      });

      it('has a non-empty specialty description', () => {
        expect(typeof TOOL_INFO[tool].specialty).toBe('string');
        expect(TOOL_INFO[tool].specialty.length).toBeGreaterThan(0);
      });
    });
  }

  it('descript points to descript.com', () => {
    expect(TOOL_INFO.descript.url).toContain('descript.com');
  });

  it('opusclip points to opus.pro', () => {
    expect(TOOL_INFO.opusclip.url).toContain('opus.pro');
  });

  it('hyperframes points to heygen.com', () => {
    expect(TOOL_INFO.hyperframes.url).toContain('heygen.com');
  });

  it('canva points to canva.com', () => {
    expect(TOOL_INFO.canva.url).toContain('canva.com');
  });
});
