/**
 * Bing Webmaster Tools XML-file verification.
 *
 * Bing fetches https://www.christian-security-services.com/BingSiteAuth.xml
 * and checks the user code. The file name and body must stay as Bing issued
 * them. The SPA fallback must not replace the XML with index.html.
 */

const fs = require('fs');
const path = require('path');

const FILE_NAME = 'BingSiteAuth.xml';
const USER_CODE = 'E2E6A52B0C93E00CA948E67590C10B86';
const ROOT = path.join(__dirname, '..', '..');

function readUtf8(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

describe('Bing site verification file', () => {
  test('is published from public/ with Bing’s user code and no HTML wrapper', () => {
    const raw = readUtf8(path.join('public', FILE_NAME)).replace(/^\uFEFF/, '');
    const body = raw.replace(/\r\n/g, '\n');

    expect(body).toContain(`<user>${USER_CODE}</user>`);
    expect(body).toMatch(/<users>/);
    expect(body).not.toMatch(/<!doctype|<html/i);
  });

  test('is excluded from the SPA rewrite', () => {
    const config = JSON.parse(readUtf8('vercel.json'));
    const spa = config.rewrites.find((rule) => rule.destination === '/index.html');
    const rewrite = new RegExp(`^${spa.source}$`);

    expect(config.cleanUrls).not.toBe(true);
    expect(rewrite.test(`/${FILE_NAME}`)).toBe(false);
    expect(rewrite.test('/')).toBe(true);
  });
});
