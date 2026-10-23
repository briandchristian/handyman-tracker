/**
 * www.christian-security-services.com is the only host search engines should
 * index. The Vercel project hostname must redirect there. Prerendered public
 * pages keep their own HTML. Unknown URLs must not be rewritten to the
 * homepage, so the host can answer them with dist/404.html (HTTP 404, noindex).
 * Staff and customer routes still load the app shell.
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

  test('serves prerendered public HTML and leaves unknown URLs off the app shell', () => {
    // Unknown URLs must not match a rewrite. Vercel then returns dist/404.html
    // with HTTP 404. Staff and customer routes still load the app shell.
    const destinations = config.rewrites.map((rule) => `${rule.source} -> ${rule.destination}`);

    expect(destinations).toEqual(
      expect.arrayContaining([
        '/bid -> /bid/index.html',
        '/login -> /login/index.html',
        '/service-area -> /service-area/index.html',
        '/services/burglar-alarms -> /services/burglar-alarms/index.html',
        '/services/fire-alarms -> /services/fire-alarms/index.html',
        '/services/cctv -> /services/cctv/index.html',
        '/services/access-control -> /services/access-control/index.html',
      ])
    );

    const shellSources = config.rewrites
      .filter((rule) => rule.destination === '/index.html')
      .map((rule) => rule.source);

    expect(shellSources).toEqual([
      '/dashboard',
      '/customer',
      '/customers',
      '/customers/:customerId',
      '/installation-history',
      '/projects/:customerId/:projectId',
      '/admin/users',
      '/admin/bid-alerts',
      '/suppliers',
      '/purchase-orders',
      '/inventory',
      '/accounting',
      '/subcontractor',
    ]);
    expect(destinations.some((line) => line.startsWith('/services/:slug'))).toBe(false);
    expect(shellSources.some((source) => source.includes('.*') || source.includes(':path'))).toBe(false);
    expect(config.rewrites.map((rule) => rule.source).some((source) => source.includes('sitemap'))).toBe(
      false
    );
  });

  test('prerender writes dist/404.html from the static noindex document', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'prerender-public.mjs'), 'utf8');
    expect(source).toContain('toStaticNotFoundDocument');
    expect(source).toContain("path.join(root, 'dist', '404.html')");
  });
});
