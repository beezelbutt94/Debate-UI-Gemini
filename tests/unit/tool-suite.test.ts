import { describe, it, expect } from 'vitest';
import { TOOL_INFO } from '@/lib/tool-suite';

const EXPECTED_TOOLS = ['descript', 'opusclip', 'hyperframes', 'canva'] as const;

describe('TOOL_INFO', () => {
  it('contains exactly the four supported tools', () => {
    expect(Object.keys(TOOL_INFO).sort()).toEqual([...EXPECTED_TOOLS].sort());
  });

  it('every tool has a label', () => {
    for (const tool of EXPECTED_TOOLS) {
      expect(TOOL_INFO[tool].label).toBeTruthy();
      expect(typeof TOOL_INFO[tool].label).toBe('string');
    }
  });

  it('every tool has a url', () => {
    for (const tool of EXPECTED_TOOLS) {
      expect(TOOL_INFO[tool].url).toBeTruthy();
    }
  });

  it('every tool URL starts with https://', () => {
    for (const tool of EXPECTED_TOOLS) {
      expect(TOOL_INFO[tool].url).toMatch(/^https:\/\//);
    }
  });

  it('every tool has a non-empty specialty', () => {
    for (const tool of EXPECTED_TOOLS) {
      expect(TOOL_INFO[tool].specialty).toBeTruthy();
      expect(typeof TOOL_INFO[tool].specialty).toBe('string');
    }
  });

  // Spot-check individual tools
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

  it('descript label is "Descript"', () => {
    expect(TOOL_INFO.descript.label).toBe('Descript');
  });

  it('opusclip label is "OpusClip"', () => {
    expect(TOOL_INFO.opusclip.label).toBe('OpusClip');
  });

  it('canva label is "Canva"', () => {
    expect(TOOL_INFO.canva.label).toBe('Canva');
  });

  it('URLs are parseable as valid URL objects', () => {
    for (const tool of EXPECTED_TOOLS) {
      expect(() => new URL(TOOL_INFO[tool].url)).not.toThrow();
    }
  });
});
