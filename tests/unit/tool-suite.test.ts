import { describe, it, expect } from 'vitest';
import { TOOL_INFO } from '@/lib/tool-suite';

const TOOLS = ['descript', 'opusclip', 'hyperframes', 'canva'] as const;

describe('TOOL_INFO constant', () => {
  it('contains all four expected tools', () => {
    for (const tool of TOOLS) {
      expect(TOOL_INFO).toHaveProperty(tool);
    }
  });

  it('every tool has a non-empty label', () => {
    for (const tool of TOOLS) {
      expect(TOOL_INFO[tool].label.length).toBeGreaterThan(0);
    }
  });

  it('every tool URL starts with https://', () => {
    for (const tool of TOOLS) {
      expect(TOOL_INFO[tool].url).toMatch(/^https:\/\//);
    }
  });

  it('every tool has a non-empty specialty', () => {
    for (const tool of TOOLS) {
      expect(TOOL_INFO[tool].specialty.length).toBeGreaterThan(0);
    }
  });

  it('descript URL is correct', () => {
    expect(TOOL_INFO.descript.url).toBe('https://www.descript.com/');
  });

  it('opusclip URL is correct', () => {
    expect(TOOL_INFO.opusclip.url).toBe('https://www.opus.pro/');
  });

  it('hyperframes URL is correct (HeyGen)', () => {
    expect(TOOL_INFO.hyperframes.url).toBe('https://www.heygen.com/');
  });

  it('canva URL is correct', () => {
    expect(TOOL_INFO.canva.url).toBe('https://www.canva.com/');
  });

  it('no tool has an undefined or null url', () => {
    for (const tool of TOOLS) {
      expect(TOOL_INFO[tool].url).toBeTruthy();
    }
  });
});
