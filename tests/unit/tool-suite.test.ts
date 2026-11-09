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
      expect(TOOL_INFO[tool].label).toBeTruthy();
      expect(typeof TOOL_INFO[tool].label).toBe('string');
    }
  });

  it('every entry has a non-empty url', () => {
    for (const tool of TOOLS) {
      expect(TOOL_INFO[tool].url).toBeTruthy();
    }
  });

  it('every entry url starts with https://', () => {
    for (const tool of TOOLS) {
      expect(TOOL_INFO[tool].url).toMatch(/^https:\/\//);
    }
  });

  it('every entry has a non-empty specialty', () => {
    for (const tool of TOOLS) {
      expect(TOOL_INFO[tool].specialty).toBeTruthy();
    }
  });

  it('descript label is "Descript"', () => {
    expect(TOOL_INFO.descript.label).toBe('Descript');
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

  it('no entries have duplicate URLs', () => {
    const urls = TOOLS.map((t) => TOOL_INFO[t].url);
    const unique = new Set(urls);
    expect(unique.size).toBe(urls.length);
  });

  it('no entries have duplicate labels', () => {
    const labels = TOOLS.map((t) => TOOL_INFO[t].label);
    const unique = new Set(labels);
    expect(unique.size).toBe(labels.length);
  });

  it('contains exactly 4 tools', () => {
    expect(Object.keys(TOOL_INFO).length).toBe(4);
  });
});
