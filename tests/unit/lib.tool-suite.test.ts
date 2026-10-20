import { describe, it, expect } from 'vitest';
import { TOOL_INFO } from '@/lib/tool-suite';
import type { SuiteTool } from '@/lib/types';

const TOOLS: SuiteTool[] = ['descript', 'opusclip', 'hyperframes', 'canva'];

describe('TOOL_INFO constant', () => {
  it('defines all four suite tools', () => {
    for (const tool of TOOLS) {
      expect(TOOL_INFO[tool]).toBeDefined();
    }
  });

  it.each(TOOLS)('%s has a non-empty label', (tool) => {
    expect(TOOL_INFO[tool].label.length).toBeGreaterThan(0);
  });

  it.each(TOOLS)('%s has a valid https URL', (tool) => {
    expect(TOOL_INFO[tool].url).toMatch(/^https:\/\//);
  });

  it.each(TOOLS)('%s has a non-empty specialty string', (tool) => {
    expect(TOOL_INFO[tool].specialty.length).toBeGreaterThan(0);
  });

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

  it('has exactly four entries (no extras)', () => {
    expect(Object.keys(TOOL_INFO)).toHaveLength(4);
  });
});
