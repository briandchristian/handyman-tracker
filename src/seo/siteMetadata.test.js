/**
 * Public search metadata for www.christian-security-services.com.
 * The sitemap lists only indexable marketing URLs. Staff, login, and API
 * routes stay out of it. LocalBusiness data names the license, phone, and
 * the Middle Tennessee cities the company actually serves.
 */

import {
  SITE_ORIGIN,
  INDEXABLE_PAGES,
  SERVICE_REGIONS,
  buildLocalBusinessJsonLd,
  buildRobotsTxt,
  buildSitemapXml,
  applySeoTemplate,
} from './siteMetadata';

const CITIES = [
  'Selmer',
  'Savannah',
  'Clifton',
  'Waynesboro',
  'Lawrenceburg',
  'Pulaski',
  'Fayetteville',
  'Lynchburg',
  'Tullahoma',
  'Decherd',
  'Winchester',
  'Monteagle',
  'Columbia',
  'Chapel Hill',
  'Shelbyville',
  'Hohenwald',
  'Franklin',
  'Nashville',
];

describe('public search metadata', () => {
  test('sitemap lists the marketing pages on the www host and nothing private', () => {
    const xml = buildSitemapXml();
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);

    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(locs).toEqual(INDEXABLE_PAGES.map((page) => `${SITE_ORIGIN}${page.path === '/' ? '/' : page.path}`));
    expect(locs).toEqual(
      expect.arrayContaining([
        `${SITE_ORIGIN}/`,
        `${SITE_ORIGIN}/bid`,
        `${SITE_ORIGIN}/service-area`,
        `${SITE_ORIGIN}/services/burglar-alarms`,
        `${SITE_ORIGIN}/services/fire-alarms`,
        `${SITE_ORIGIN}/services/cctv`,
        `${SITE_ORIGIN}/services/access-control`,
      ])
    );
    expect(xml).not.toMatch(/\/login|\/dashboard|\/customers|\/api\//);
    expect(new Set(INDEXABLE_PAGES.map((page) => page.title)).size).toBe(INDEXABLE_PAGES.length);
    expect(new Set(INDEXABLE_PAGES.map((page) => page.description)).size).toBe(
      INDEXABLE_PAGES.length
    );
  });

  test('robots.txt points at the sitemap and blocks staff and API paths', () => {
    const robots = buildRobotsTxt();
    expect(robots).toContain(`Sitemap: ${SITE_ORIGIN}/sitemap.xml`);
    expect(robots).toContain('Disallow: /api/');
    expect(robots).toContain('Disallow: /dashboard');
    expect(robots).toContain('Disallow: /customers');
    expect(robots).not.toContain('Disallow: /service-area');
    expect(robots).not.toContain('Disallow: /bid');
  });

  test('local business data includes the license, phone, and every service city', () => {
    const data = buildLocalBusinessJsonLd();
    const served = data.areaServed.map((city) => city.name);

    expect(data['@type']).toBe('LocalBusiness');
    expect(data.name).toBe('Christian Security Services');
    expect(data.url).toBe(`${SITE_ORIGIN}/`);
    expect(data.telephone).toBe('+1-931-279-7879');
    expect(data.identifier).toMatch(/2622/);
    expect(served).toEqual(expect.arrayContaining(CITIES));
    expect(served).toHaveLength(CITIES.length);
    expect(SERVICE_REGIONS.flatMap((region) => region.cities)).toEqual(
      expect.arrayContaining(CITIES)
    );
  });

  test('applySeoTemplate puts the page title, canonical URL, and rendered body in the HTML shell', () => {
    const html = applySeoTemplate('<html><head><title>Old</title></head><body><div id="root"></div></body></html>', {
      title: 'Burglar alarms | Christian Security Services',
      description: 'Intrusion alarms for homes and businesses.',
      canonical: `${SITE_ORIGIN}/services/burglar-alarms`,
      robots: 'index, follow',
      body: '<h1>Burglar alarm installation</h1>',
    });

    expect(html).toContain('<title>Burglar alarms | Christian Security Services</title>');
    expect(html).toContain(`<link rel="canonical" href="${SITE_ORIGIN}/services/burglar-alarms" />`);
    expect(html).toContain('<h1>Burglar alarm installation</h1>');
    expect(html).not.toContain('<title>Old</title>');
    expect(html).not.toContain('<div id="root"></div>');
  });
});
