import { describe, it, expect } from 'vitest';
import { TOOL_INFO } from '@/lib/tool-suite';
import type { SuiteTool } from '@/lib/types';

const EXPECTED_TOOLS: SuiteTool[] = ['descript', 'opusclip', 'hyperframes', 'canva'];

describe('TOOL_INFO', () => {
  it('contains all four expected tools', () => {
    expect(Object.keys(TOOL_INFO).sort()).toEqual(EXPECTED_TOOLS.slice().sort());
  });

  it.each(EXPECTED_TOOLS)('%s has a non-empty label', (tool) => {
    expect(TOOL_INFO[tool].label).toBeTruthy();
  });

  it.each(EXPECTED_TOOLS)('%s has a valid https URL', (tool) => {
    const { url } = TOOL_INFO[tool];
    expect(url).toMatch(/^https:\/\//);
  });

  it.each(EXPECTED_TOOLS)('%s has a non-empty specialty', (tool) => {
    expect(TOOL_INFO[tool].specialty).toBeTruthy();
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

  it('no URL contains localhost or a private/placeholder domain', () => {
    for (const tool of EXPECTED_TOOLS) {
      const { url } = TOOL_INFO[tool];
      expect(url).not.toContain('localhost');
      expect(url).not.toContain('example.com');
    }
  });
});
