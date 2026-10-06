/**
 * www.christian-security-services.com is the only host search engines should
 * index. The Vercel project hostname must redirect there. Prerendered public
 * pages and the sitemap must not be replaced by the app shell.
 */

const fs = require('fs');
const path = require('path');

const config = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', '..', 'vercel.json'), 'utf8')
);

describe('canonical host routing', () => {
  test('redirects the Vercel hostname to www.christian-security-services.com', () => {
    const redirect = config.redirects.find((rule) =>
      (rule.has || []).some(
        (condition) =>
          condition.type === 'host' && condition.value === 'handyman-tracker.vercel.app'
      )
    );

    expect(redirect).toBeTruthy();
    expect(redirect.permanent).toBe(true);
    expect(redirect.destination).toBe('https://www.christian-security-services.com/:path*');
  });

  test('serves prerendered public HTML and leaves sitemap and robots out of the app rewrite', () => {
    const destinations = config.rewrites.map((rule) => `${rule.source} -> ${rule.destination}`);
    const spa = config.rewrites.find((rule) => rule.destination === '/index.html');
    const spaPattern = new RegExp(`^${spa.source}$`);

    expect(destinations).toEqual(
      expect.arrayContaining([
        '/bid -> /bid/index.html',
        '/service-area -> /service-area/index.html',
        '/services/:slug -> /services/:slug/index.html',
      ])
    );
    expect(spaPattern.test('/sitemap.xml')).toBe(false);
    expect(spaPattern.test('/robots.txt')).toBe(false);
    expect(spaPattern.test('/google6542801e3cca663e.html')).toBe(false);
    expect(spaPattern.test('/dashboard')).toBe(true);
  });
});
