import { describe, it, expect } from 'vitest';
import { TOOL_INFO } from '@/lib/tool-suite';

const EXPECTED_TOOLS = ['descript', 'opusclip', 'hyperframes', 'canva'] as const;

describe('TOOL_INFO constants', () => {
  it('has exactly the four expected tool keys', () => {
    expect(Object.keys(TOOL_INFO).sort()).toEqual([...EXPECTED_TOOLS].sort());
  });

  for (const tool of EXPECTED_TOOLS) {
    describe(`${tool}`, () => {
      it('has a non-empty label', () => {
        expect(TOOL_INFO[tool].label.trim().length).toBeGreaterThan(0);
      });

      it('has a URL starting with https://', () => {
        expect(TOOL_INFO[tool].url.startsWith('https://')).toBe(true);
      });

      it('has a non-empty specialty string', () => {
        expect(TOOL_INFO[tool].specialty.trim().length).toBeGreaterThan(0);
      });
    });
  }

  it('descript URL is correct', () => {
    expect(TOOL_INFO.descript.url).toBe('https://www.descript.com/');
  });

  it('opusclip URL is correct', () => {
    expect(TOOL_INFO.opusclip.url).toBe('https://www.opus.pro/');
  });

  it('hyperframes URL is correct', () => {
    expect(TOOL_INFO.hyperframes.url).toBe('https://www.heygen.com/');
  });

  it('canva URL is correct', () => {
    expect(TOOL_INFO.canva.url).toBe('https://www.canva.com/');
  });

  it('descript label is "Descript"', () => {
    expect(TOOL_INFO.descript.label).toBe('Descript');
  });

  it('opusclip label is "OpusClip"', () => {
    expect(TOOL_INFO.opusclip.label).toBe('OpusClip');
  });

  it('canva label is "Canva"', () => {
    expect(TOOL_INFO.canva.label).toBe('Canva');
  });

  it('hyperframes label is "HyperFrames by HeyGen"', () => {
    expect(TOOL_INFO.hyperframes.label).toBe('HyperFrames by HeyGen');
  });

  it('every URL ends with a trailing slash', () => {
    for (const tool of EXPECTED_TOOLS) {
      expect(TOOL_INFO[tool].url.endsWith('/')).toBe(true);
    }
  });

  it('every specialty mentions at least one concrete capability (not empty)', () => {
    for (const tool of EXPECTED_TOOLS) {
      expect(TOOL_INFO[tool].specialty.length).toBeGreaterThan(10);
    }
  });

  it('no two tools share the same URL', () => {
    const urls = EXPECTED_TOOLS.map((t) => TOOL_INFO[t].url);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it('no two tools share the same label', () => {
    const labels = EXPECTED_TOOLS.map((t) => TOOL_INFO[t].label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('TOOL_INFO is a frozen-shape object (no dynamic keys at runtime)', () => {
    expect(Object.keys(TOOL_INFO).length).toBe(4);
  });
});
