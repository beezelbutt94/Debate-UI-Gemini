import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { TOOL_INFO } from '../../lib/tool-suite.ts';

const EXPECTED_TOOLS = ['descript', 'opusclip', 'hyperframes', 'canva'] as const;

describe('TOOL_INFO', () => {
  test('contains exactly 4 tools', () => {
    assert.equal(Object.keys(TOOL_INFO).length, 4);
  });

  test('has all required tool keys', () => {
    for (const tool of EXPECTED_TOOLS) {
      assert.ok(tool in TOOL_INFO, `Missing tool: "${tool}"`);
    }
  });

  for (const tool of EXPECTED_TOOLS) {
    describe(`${tool}`, () => {
      test('has a non-empty label', () => {
        assert.ok(
          typeof TOOL_INFO[tool].label === 'string' && TOOL_INFO[tool].label.length > 0,
          `TOOL_INFO.${tool}.label is empty`
        );
      });

      test('has a valid HTTPS URL', () => {
        const url = TOOL_INFO[tool].url;
        assert.ok(url.startsWith('https://'), `TOOL_INFO.${tool}.url should start with https://`);
        assert.doesNotThrow(() => new URL(url), `TOOL_INFO.${tool}.url is not a valid URL`);
      });

      test('has a non-empty specialty', () => {
        assert.ok(
          typeof TOOL_INFO[tool].specialty === 'string' && TOOL_INFO[tool].specialty.length > 0,
          `TOOL_INFO.${tool}.specialty is empty`
        );
      });
    });
  }

  test('descript URL is descript.com', () => {
    assert.ok(TOOL_INFO.descript.url.includes('descript.com'));
  });

  test('opusclip URL is opus.pro', () => {
    assert.ok(TOOL_INFO.opusclip.url.includes('opus.pro'));
  });

  test('hyperframes URL is heygen.com', () => {
    assert.ok(TOOL_INFO.hyperframes.url.includes('heygen.com'));
  });

  test('canva URL is canva.com', () => {
    assert.ok(TOOL_INFO.canva.url.includes('canva.com'));
  });

  test('descript specialty mentions audio', () => {
    assert.ok(TOOL_INFO.descript.specialty.toLowerCase().includes('audio'));
  });

  test('opusclip specialty mentions clip', () => {
    assert.ok(TOOL_INFO.opusclip.specialty.toLowerCase().includes('clip'));
  });
});
