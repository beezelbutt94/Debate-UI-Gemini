import { describe, it, expect } from 'vitest';
import { TOOL_INFO } from '@/lib/tool-suite';

const EXPECTED_TOOLS = ['descript', 'opusclip', 'hyperframes', 'canva'] as const;

describe('TOOL_INFO constant', () => {
  it('contains all four expected tools', () => {
    for (const tool of EXPECTED_TOOLS) {
      expect(TOOL_INFO).toHaveProperty(tool);
    }
  });

  it('each tool has a non-empty label', () => {
    for (const tool of EXPECTED_TOOLS) {
      expect(typeof TOOL_INFO[tool].label).toBe('string');
      expect(TOOL_INFO[tool].label.length).toBeGreaterThan(0);
    }
  });

  it('each tool has a valid https URL', () => {
    for (const tool of EXPECTED_TOOLS) {
      const url = TOOL_INFO[tool].url;
      expect(url).toMatch(/^https:\/\//);
      // Verify it parses as a valid URL
      expect(() => new URL(url)).not.toThrow();
    }
  });

  it('each tool has a non-empty specialty', () => {
    for (const tool of EXPECTED_TOOLS) {
      expect(typeof TOOL_INFO[tool].specialty).toBe('string');
      expect(TOOL_INFO[tool].specialty.length).toBeGreaterThan(0);
    }
  });

  it('descript has correct label', () => {
    expect(TOOL_INFO.descript.label).toBe('Descript');
  });

  it('opusclip has correct label', () => {
    expect(TOOL_INFO.opusclip.label).toBe('OpusClip');
  });

  it('hyperframes has correct label', () => {
    expect(TOOL_INFO.hyperframes.label).toBe('HyperFrames by HeyGen');
  });

  it('canva has correct label', () => {
    expect(TOOL_INFO.canva.label).toBe('Canva');
  });

  it('descript URL points to descript.com', () => {
    expect(new URL(TOOL_INFO.descript.url).hostname).toBe('www.descript.com');
  });

  it('opusclip URL points to opus.pro', () => {
    expect(new URL(TOOL_INFO.opusclip.url).hostname).toBe('www.opus.pro');
  });

  it('hyperframes URL points to heygen.com', () => {
    expect(new URL(TOOL_INFO.hyperframes.url).hostname).toBe('www.heygen.com');
  });

  it('canva URL points to canva.com', () => {
    expect(new URL(TOOL_INFO.canva.url).hostname).toBe('www.canva.com');
  });

  it('has exactly 4 tools (no extras)', () => {
    expect(Object.keys(TOOL_INFO).length).toBe(4);
  });
});
