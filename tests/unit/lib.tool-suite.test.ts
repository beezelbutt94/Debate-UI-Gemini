import { describe, it, expect } from 'vitest';
import { TOOL_INFO } from '@/lib/tool-suite';

describe('TOOL_INFO', () => {
  const tools = ['descript', 'opusclip', 'hyperframes', 'canva'] as const;

  for (const tool of tools) {
    describe(`tool: ${tool}`, () => {
      it('has a non-empty label', () => {
        expect(TOOL_INFO[tool].label.length).toBeGreaterThan(0);
      });

      it('has a valid HTTPS URL', () => {
        expect(TOOL_INFO[tool].url).toMatch(/^https:\/\//);
      });

      it('has a non-empty specialty', () => {
        expect(TOOL_INFO[tool].specialty.length).toBeGreaterThan(0);
      });
    });
  }

  it('covers exactly 4 tools', () => {
    expect(Object.keys(TOOL_INFO)).toHaveLength(4);
  });

  it('descript URL is correct', () => {
    expect(TOOL_INFO.descript.url).toBe('https://www.descript.com/');
  });

  it('opusclip URL is correct', () => {
    expect(TOOL_INFO.opusclip.url).toBe('https://www.opus.pro/');
  });

  it('hyperframes URL points to heygen.com', () => {
    expect(TOOL_INFO.hyperframes.url).toBe('https://www.heygen.com/');
  });

  it('canva URL is correct', () => {
    expect(TOOL_INFO.canva.url).toBe('https://www.canva.com/');
  });
});
