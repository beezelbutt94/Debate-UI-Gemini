import { describe, it, expect } from 'vitest';
import { TOOL_INFO } from '@/lib/tool-suite';
import type { SuiteTool } from '@/lib/types';

const ALL_TOOLS: SuiteTool[] = ['descript', 'opusclip', 'hyperframes', 'canva'];

describe('TOOL_INFO', () => {
  it('has an entry for every SuiteTool', () => {
    for (const tool of ALL_TOOLS) {
      expect(TOOL_INFO[tool]).toBeDefined();
    }
  });

  it('each entry has a non-empty label', () => {
    for (const tool of ALL_TOOLS) {
      expect(TOOL_INFO[tool].label.length).toBeGreaterThan(0);
    }
  });

  it('each entry has a non-empty url', () => {
    for (const tool of ALL_TOOLS) {
      expect(TOOL_INFO[tool].url.length).toBeGreaterThan(0);
    }
  });

  it('each url is a valid https URL', () => {
    for (const tool of ALL_TOOLS) {
      const url = new URL(TOOL_INFO[tool].url);
      expect(url.protocol).toBe('https:');
    }
  });

  it('each entry has a non-empty specialty', () => {
    for (const tool of ALL_TOOLS) {
      expect(TOOL_INFO[tool].specialty.length).toBeGreaterThan(0);
    }
  });

  it('descript label is "Descript"', () => {
    expect(TOOL_INFO.descript.label).toBe('Descript');
  });

  it('descript url points to descript.com', () => {
    expect(new URL(TOOL_INFO.descript.url).hostname).toContain('descript.com');
  });

  it('opusclip url points to opus.pro', () => {
    expect(new URL(TOOL_INFO.opusclip.url).hostname).toContain('opus.pro');
  });

  it('hyperframes url points to heygen.com', () => {
    expect(new URL(TOOL_INFO.hyperframes.url).hostname).toContain('heygen.com');
  });

  it('canva url points to canva.com', () => {
    expect(new URL(TOOL_INFO.canva.url).hostname).toContain('canva.com');
  });

  it('no extra keys beyond the four defined tools', () => {
    expect(Object.keys(TOOL_INFO).sort()).toEqual([...ALL_TOOLS].sort());
  });
});
