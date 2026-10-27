import { describe, it, expect } from 'vitest';
import { TOOL_INFO } from '@/lib/tool-suite';

describe('TOOL_INFO', () => {
  const tools = ['descript', 'opusclip', 'hyperframes', 'canva'] as const;

  it('contains all four expected tool keys', () => {
    expect(Object.keys(TOOL_INFO).sort()).toEqual(['canva', 'descript', 'hyperframes', 'opusclip']);
  });

  it('every entry has a non-empty label', () => {
    tools.forEach((tool) => {
      expect(TOOL_INFO[tool].label.length).toBeGreaterThan(0);
    });
  });

  it('every entry has a valid https url', () => {
    tools.forEach((tool) => {
      expect(TOOL_INFO[tool].url).toMatch(/^https:\/\//);
    });
  });

  it('every entry has a non-empty specialty', () => {
    tools.forEach((tool) => {
      expect(TOOL_INFO[tool].specialty.length).toBeGreaterThan(0);
    });
  });

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

  it('descript label is "Descript"', () => {
    expect(TOOL_INFO.descript.label).toBe('Descript');
  });

  it('opusclip label is "OpusClip"', () => {
    expect(TOOL_INFO.opusclip.label).toBe('OpusClip');
  });

  it('canva label is "Canva"', () => {
    expect(TOOL_INFO.canva.label).toBe('Canva');
  });
});
