import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adsTxt, adsenseClient, siteOrigin, supportEmail } from '../../lib/site.ts';

test('accepts only well-formed AdSense publisher IDs', () => {
  assert.equal(adsenseClient(' ca-pub-7861953801165225 '), 'ca-pub-7861953801165225');
  assert.equal(adsenseClient('pub-7861953801165225'), null);
  assert.equal(adsenseClient('ca-pub-12<script>'), null);
  assert.equal(adsenseClient(''), null);
  assert.equal(adsenseClient(undefined), null);
});

test('ads.txt carries Google’s DIRECT record for the publisher', () => {
  assert.equal(adsTxt('ca-pub-7861953801165225'), 'google.com, pub-7861953801165225, DIRECT, f08c47fec0942fa0\n');
});

test('site origin trims trailing slashes and falls back to the www host', () => {
  assert.equal(siteOrigin('https://www.viraltrending.online///'), 'https://www.viraltrending.online');
  assert.equal(siteOrigin('  '), 'https://www.viraltrending.online');
  assert.equal(siteOrigin(undefined), 'https://www.viraltrending.online');
});

test('support email must look like an address', () => {
  assert.equal(supportEmail(' help@example.com '), 'help@example.com');
  assert.equal(supportEmail('not an email'), null);
  assert.equal(supportEmail(undefined), null);
});
