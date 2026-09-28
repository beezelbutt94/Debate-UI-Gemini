import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isOwnedMediaUrl, validateMediaUrls } from '../../lib/media.ts';

const CLOUD = 'democloud';
const USER = 'user_2abcXYZ';
const own = `https://res.cloudinary.com/${CLOUD}/video/upload/v1712345678/viral-trending/uploads/${USER}/clip_01.mp4`;

test('accepts the owner’s own upload, with or without a version segment', () => {
  assert.equal(isOwnedMediaUrl(own, CLOUD, USER), true);
  assert.equal(isOwnedMediaUrl(own.replace('/v1712345678', ''), CLOUD, USER), true);
  assert.equal(isOwnedMediaUrl(own.replace('.mp4', '.mov'), CLOUD, USER), true);
});

test('rejects other users’ folders, other clouds and other hosts', () => {
  assert.equal(isOwnedMediaUrl(own.replace(USER, 'user_other'), CLOUD, USER), false);
  assert.equal(isOwnedMediaUrl(own.replace(CLOUD, 'evilcloud'), CLOUD, USER), false);
  assert.equal(isOwnedMediaUrl(own.replace('res.cloudinary.com', 'res.cloudinary.com.evil.com'), CLOUD, USER), false);
});

test('rejects internal / SSRF targets and URL tricks', () => {
  for (const url of [
    'http://169.254.169.254/latest/meta-data/',
    'http://localhost:3000/api/cron/publish',
    own.replace('https:', 'http:'),
    `https://user:pass@res.cloudinary.com/${CLOUD}/video/upload/viral-trending/uploads/${USER}/a.mp4`,
    `https://res.cloudinary.com:8443/${CLOUD}/video/upload/viral-trending/uploads/${USER}/a.mp4`,
    `${own}?redirect=http://internal`,
    `https://res.cloudinary.com/${CLOUD}/video/upload/viral-trending/uploads/${USER}/../user_other/a.mp4`,
    `https://res.cloudinary.com/${CLOUD}/video/upload/e_blur/viral-trending/uploads/${USER}/a.mp4`,
    `https://res.cloudinary.com/${CLOUD}/image/upload/viral-trending/uploads/${USER}/a.png`,
    'not a url',
  ]) {
    assert.equal(isOwnedMediaUrl(url, CLOUD, USER), false, url);
  }
});

test('validateMediaUrls enforces type, count and ownership', () => {
  assert.deepEqual(validateMediaUrls(undefined, CLOUD, USER), { ok: true, urls: [] });
  assert.deepEqual(validateMediaUrls([own], CLOUD, USER), { ok: true, urls: [own] });
  assert.equal(validateMediaUrls('x', CLOUD, USER).ok, false);
  assert.equal(validateMediaUrls([own, own, own, own, own], CLOUD, USER).ok, false);
  assert.equal(validateMediaUrls(['https://example.com/a.mp4'], CLOUD, USER).ok, false);
  assert.equal(validateMediaUrls([own], undefined, USER).ok, false);
});
