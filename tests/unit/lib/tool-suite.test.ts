import { describe, it, expect } from 'vitest';
import { TOOL_INFO } from '@/lib/tool-suite';
import type { SuiteTool } from '@/lib/types';

const ALL_TOOLS: SuiteTool[] = ['descript', 'opusclip', 'hyperframes', 'canva'];

// ── TOOL_INFO structure ───────────────────────────────────────────────────────

describe('TOOL_INFO', () => {
  it('defines exactly the four supported tools', () => {
    expect(Object.keys(TOOL_INFO).sort()).toEqual([...ALL_TOOLS].sort());
  });

  it('every tool has a non-empty label', () => {
    for (const tool of ALL_TOOLS) {
      expect(TOOL_INFO[tool].label.length).toBeGreaterThan(0);
    }
  });

  it('every tool has a non-empty url', () => {
    for (const tool of ALL_TOOLS) {
      expect(TOOL_INFO[tool].url.length).toBeGreaterThan(0);
    }
  });

  it('every tool has a non-empty specialty', () => {
    for (const tool of ALL_TOOLS) {
      expect(TOOL_INFO[tool].specialty.length).toBeGreaterThan(0);
    }
  });

  it('every tool url is a valid HTTPS URL', () => {
    for (const tool of ALL_TOOLS) {
      const { url } = TOOL_INFO[tool];
      expect(() => new URL(url)).not.toThrow();
      expect(url.startsWith('https://')).toBe(true);
    }
  });

  // ── per-tool values ──────────────────────────────────────────────────────

  it('descript label is "Descript"', () => {
    expect(TOOL_INFO.descript.label).toBe('Descript');
  });

  it('descript url points to descript.com', () => {
    expect(TOOL_INFO.descript.url).toContain('descript.com');
  });

  it('descript specialty mentions audio', () => {
    expect(TOOL_INFO.descript.specialty.toLowerCase()).toContain('audio');
  });

  it('opusclip label is "OpusClip"', () => {
    expect(TOOL_INFO.opusclip.label).toBe('OpusClip');
  });

  it('opusclip url points to opus.pro', () => {
    expect(TOOL_INFO.opusclip.url).toContain('opus.pro');
  });

  it('opusclip specialty mentions clip', () => {
    expect(TOOL_INFO.opusclip.specialty.toLowerCase()).toContain('clip');
  });

  it('hyperframes label includes "HyperFrames"', () => {
    expect(TOOL_INFO.hyperframes.label).toContain('HyperFrames');
  });

  it('hyperframes url points to heygen.com', () => {
    expect(TOOL_INFO.hyperframes.url).toContain('heygen.com');
  });

  it('hyperframes specialty mentions avatar or video', () => {
    const s = TOOL_INFO.hyperframes.specialty.toLowerCase();
    expect(s.includes('avatar') || s.includes('video')).toBe(true);
  });

  it('canva label is "Canva"', () => {
    expect(TOOL_INFO.canva.label).toBe('Canva');
  });

  it('canva url points to canva.com', () => {
    expect(TOOL_INFO.canva.url).toContain('canva.com');
  });

  it('canva specialty mentions thumbnail or image', () => {
    const s = TOOL_INFO.canva.specialty.toLowerCase();
    expect(s.includes('thumbnail') || s.includes('image')).toBe(true);
  });

  // ── all labels are distinct ──────────────────────────────────────────────

  it('all labels are distinct', () => {
    const labels = ALL_TOOLS.map((t) => TOOL_INFO[t].label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('all URLs are distinct', () => {
    const urls = ALL_TOOLS.map((t) => TOOL_INFO[t].url);
    expect(new Set(urls).size).toBe(urls.length);
  });
});
