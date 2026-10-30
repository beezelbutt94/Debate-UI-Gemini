import { describe, it, expect } from 'vitest';
import { TOOL_INFO } from '@/lib/tool-suite';

const EXPECTED_TOOLS = ['descript', 'opusclip', 'hyperframes', 'canva'] as const;

describe('TOOL_INFO', () => {
  it('contains all four tools', () => {
    for (const tool of EXPECTED_TOOLS) {
      expect(TOOL_INFO).toHaveProperty(tool);
    }
  });

  it('each tool has a non-empty label', () => {
    for (const tool of EXPECTED_TOOLS) {
      expect(TOOL_INFO[tool].label.length).toBeGreaterThan(0);
    }
  });

  it('each tool has a valid https URL', () => {
    for (const tool of EXPECTED_TOOLS) {
      expect(TOOL_INFO[tool].url).toMatch(/^https:\/\//);
    }
  });

  it('each tool has a non-empty specialty string', () => {
    for (const tool of EXPECTED_TOOLS) {
      expect(TOOL_INFO[tool].specialty.length).toBeGreaterThan(0);
    }
  });

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

  it('descript label is "Descript"', () => {
    expect(TOOL_INFO.descript.label).toBe('Descript');
  });

  it('opusclip label is "OpusClip"', () => {
    expect(TOOL_INFO.opusclip.label).toBe('OpusClip');
  });

  it('canva label is "Canva"', () => {
    expect(TOOL_INFO.canva.label).toBe('Canva');
  });

  it('descript specialty mentions audio or transcript', () => {
    expect(TOOL_INFO.descript.specialty.toLowerCase()).toMatch(/audio|transcript/);
  });

  it('opusclip specialty mentions clip or short', () => {
    expect(TOOL_INFO.opusclip.specialty.toLowerCase()).toMatch(/clip|short/);
  });

  it('hyperframes specialty mentions avatar or video', () => {
    expect(TOOL_INFO.hyperframes.specialty.toLowerCase()).toMatch(/avatar|video/);
  });

  it('canva specialty mentions thumbnail or image', () => {
    expect(TOOL_INFO.canva.specialty.toLowerCase()).toMatch(/thumbnail|image|template/);
  });
});
