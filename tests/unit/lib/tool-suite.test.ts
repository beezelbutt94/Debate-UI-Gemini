import { describe, it, expect } from 'vitest';
import { TOOL_INFO } from '@/lib/tool-suite';

describe('TOOL_INFO', () => {
  const tools = ['descript', 'opusclip', 'hyperframes', 'canva'] as const;

  it('contains all four required tool keys', () => {
    expect(Object.keys(TOOL_INFO).sort()).toEqual(tools.slice().sort());
  });

  for (const tool of tools) {
    describe(`${tool}`, () => {
      it('has a non-empty label', () => {
        expect(typeof TOOL_INFO[tool].label).toBe('string');
        expect(TOOL_INFO[tool].label.length).toBeGreaterThan(0);
      });

      it('has a valid HTTPS URL', () => {
        expect(TOOL_INFO[tool].url).toMatch(/^https:\/\//);
      });

      it('has a non-empty specialty description', () => {
        expect(typeof TOOL_INFO[tool].specialty).toBe('string');
        expect(TOOL_INFO[tool].specialty.length).toBeGreaterThan(0);
      });
    });
  }

  it('descript points to the correct domain', () => {
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
