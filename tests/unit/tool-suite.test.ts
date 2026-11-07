import { describe, it, expect } from 'vitest';
import { TOOL_INFO } from '@/lib/tool-suite';
import type { SuiteTool } from '@/lib/types';

const TOOLS: SuiteTool[] = ['descript', 'opusclip', 'hyperframes', 'canva'];

describe('TOOL_INFO', () => {
  it('has an entry for every SuiteTool', () => {
    for (const tool of TOOLS) {
      expect(TOOL_INFO[tool]).toBeDefined();
    }
  });

  it('every entry has a non-empty label', () => {
    for (const tool of TOOLS) {
      expect(TOOL_INFO[tool].label.length).toBeGreaterThan(0);
    }
  });

  it('every entry has a non-empty specialty', () => {
    for (const tool of TOOLS) {
      expect(TOOL_INFO[tool].specialty.length).toBeGreaterThan(0);
    }
  });

  it('every URL starts with https://', () => {
    for (const tool of TOOLS) {
      expect(TOOL_INFO[tool].url).toMatch(/^https:\/\//);
    }
  });

  it('every URL is parseable', () => {
    for (const tool of TOOLS) {
      expect(() => new URL(TOOL_INFO[tool].url)).not.toThrow();
    }
  });

  // ── specific values ──────────────────────────────────────────────────────

  it('descript label is "Descript"', () => {
    expect(TOOL_INFO.descript.label).toBe('Descript');
  });

  it('descript URL contains descript.com', () => {
    expect(TOOL_INFO.descript.url).toContain('descript.com');
  });

  it('opusclip label is "OpusClip"', () => {
    expect(TOOL_INFO.opusclip.label).toBe('OpusClip');
  });

  it('opusclip URL contains opus.pro', () => {
    expect(TOOL_INFO.opusclip.url).toContain('opus.pro');
  });

  it('hyperframes label contains "HyperFrames"', () => {
    expect(TOOL_INFO.hyperframes.label).toContain('HyperFrames');
  });

  it('hyperframes URL contains heygen.com', () => {
    expect(TOOL_INFO.hyperframes.url).toContain('heygen.com');
  });

  it('canva label is "Canva"', () => {
    expect(TOOL_INFO.canva.label).toBe('Canva');
  });

  it('canva URL contains canva.com', () => {
    expect(TOOL_INFO.canva.url).toContain('canva.com');
  });

  it('no two tools share the same URL', () => {
    const urls = TOOLS.map(t => TOOL_INFO[t].url);
    const unique = new Set(urls);
    expect(unique.size).toBe(TOOLS.length);
  });
});
