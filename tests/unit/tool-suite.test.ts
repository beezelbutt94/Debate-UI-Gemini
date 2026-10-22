import { describe, it, expect } from 'vitest';
import { TOOL_INFO } from '@/lib/tool-suite';

describe('TOOL_INFO', () => {
  const expectedTools = ['descript', 'opusclip', 'hyperframes', 'canva'] as const;

  it('contains all four expected tools', () => {
    expectedTools.forEach((tool) => {
      expect(TOOL_INFO).toHaveProperty(tool);
    });
  });

  it('each tool entry has label, url, and specialty', () => {
    expectedTools.forEach((tool) => {
      const entry = TOOL_INFO[tool];
      expect(typeof entry.label).toBe('string');
      expect(entry.label.length).toBeGreaterThan(0);
      expect(typeof entry.url).toBe('string');
      expect(entry.url.startsWith('https://')).toBe(true);
      expect(typeof entry.specialty).toBe('string');
      expect(entry.specialty.length).toBeGreaterThan(0);
    });
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
});
