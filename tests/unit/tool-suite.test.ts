import { describe, it, expect } from 'vitest';
import { TOOL_INFO } from '@/lib/tool-suite';

const EXPECTED_TOOLS = ['descript', 'opusclip', 'hyperframes', 'canva'] as const;

describe('TOOL_INFO', () => {
  it('contains all four required tools', () => {
    for (const tool of EXPECTED_TOOLS) {
      expect(TOOL_INFO).toHaveProperty(tool);
    }
  });

  it('has exactly four entries', () => {
    expect(Object.keys(TOOL_INFO)).toHaveLength(4);
  });

  for (const tool of EXPECTED_TOOLS) {
    describe(`TOOL_INFO.${tool}`, () => {
      it('has a non-empty label', () => {
        expect(TOOL_INFO[tool].label).toBeTruthy();
        expect(typeof TOOL_INFO[tool].label).toBe('string');
      });

      it('has a url starting with https://', () => {
        expect(TOOL_INFO[tool].url).toMatch(/^https:\/\//);
      });

      it('has a non-empty specialty string', () => {
        expect(TOOL_INFO[tool].specialty).toBeTruthy();
        expect(typeof TOOL_INFO[tool].specialty).toBe('string');
      });
    });
  }

  it('descript label is "Descript"', () => {
    expect(TOOL_INFO.descript.label).toBe('Descript');
  });

  it('descript URL points to descript.com', () => {
    expect(TOOL_INFO.descript.url).toBe('https://www.descript.com/');
  });

  it('opusclip label is "OpusClip"', () => {
    expect(TOOL_INFO.opusclip.label).toBe('OpusClip');
  });

  it('opusclip URL points to opus.pro', () => {
    expect(TOOL_INFO.opusclip.url).toBe('https://www.opus.pro/');
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

  it('all specialty strings are at least 10 characters (not trivially empty)', () => {
    for (const tool of EXPECTED_TOOLS) {
      expect(TOOL_INFO[tool].specialty.length).toBeGreaterThanOrEqual(10);
    }
  });
});
