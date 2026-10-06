/**
 * Google Search Console HTML-file verification.
 *
 * Search Console proves ownership by fetching a user-specific file at the
 * property root (https://example.com/google6542801e3cca663e.html). The body
 * must be the token Google issued. The name and token must not be edited.
 * Trailing newlines are allowed; HTML wrappers, auth walls, and cross-domain
 * redirects are not. Vercel checks the filesystem before rewrites, and this
 * app also excludes the file from the SPA fallback so a catch-all rewrite
 * cannot replace the token with index.html.
 */

const fs = require('fs');
const path = require('path');

const FILE_NAME = 'google6542801e3cca663e.html';
const TOKEN = `google-site-verification: ${FILE_NAME}`;
const ROOT = path.join(__dirname, '..', '..');

function readUtf8(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function spaRewriteSource() {
  const config = JSON.parse(readUtf8('vercel.json'));
  const spa = config.rewrites.find((rule) => rule.destination === '/index.html');
  if (!spa) {
    throw new Error('SPA rewrite to /index.html is missing');
  }
  return spa.source;
}

describe('Google Search Console HTML file', () => {
  test('is published from public/ with the exact token and no HTML wrapper', () => {
    const raw = readUtf8(path.join('public', FILE_NAME)).replace(/^\uFEFF/, '');
    const body = raw.replace(/\r\n/g, '\n').replace(/\n+$/, '');

    expect(body).toBe(TOKEN);
    expect(raw).not.toMatch(/<!doctype|<html|<meta/i);
    expect(path.basename(FILE_NAME)).toBe(FILE_NAME);
  });

  test('is excluded from the SPA rewrite and is not extension-stripped', () => {
    const config = JSON.parse(readUtf8('vercel.json'));
    const source = spaRewriteSource();
    const rewrite = new RegExp(`^${source}$`);
    const verificationPath = `/${FILE_NAME}`;

    expect(config.cleanUrls).not.toBe(true);
    expect(rewrite.test(verificationPath)).toBe(false);
    expect(rewrite.test('/')).toBe(true);
    expect(rewrite.test('/request-bid')).toBe(true);
    expect(rewrite.test('/api/health')).toBe(false);
  });
});
