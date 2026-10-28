import { describe, it, expect } from 'vitest';
import { TOOL_INFO } from '@/lib/tool-suite';

describe('TOOL_INFO', () => {
  const tools = ['descript', 'opusclip', 'hyperframes', 'canva'] as const;

  it.each(tools)('"%s" entry exists', (tool) => {
    expect(TOOL_INFO[tool]).toBeDefined();
  });

  it.each(tools)('"%s" has a non-empty label', (tool) => {
    expect(TOOL_INFO[tool].label.length).toBeGreaterThan(0);
  });

  it.each(tools)('"%s" has a valid https URL', (tool) => {
    expect(TOOL_INFO[tool].url).toMatch(/^https:\/\//);
  });

  it.each(tools)('"%s" has a non-empty specialty', (tool) => {
    expect(TOOL_INFO[tool].specialty.length).toBeGreaterThan(0);
  });

  it('descript specialises in audio/transcript repair', () => {
    expect(TOOL_INFO.descript.specialty.toLowerCase()).toContain('audio');
  });

  it('opusclip specialises in clip slicing', () => {
    expect(TOOL_INFO.opusclip.specialty.toLowerCase()).toContain('clip');
  });

  it('hyperframes specialises in AI avatar / video', () => {
    expect(TOOL_INFO.hyperframes.specialty.toLowerCase()).toContain('video');
  });

  it('canva specialises in thumbnail / images', () => {
    expect(TOOL_INFO.canva.specialty.toLowerCase()).toContain('thumbnail');
  });
});
