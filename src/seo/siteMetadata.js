/**
 * Search metadata for the public marketing site.
 *
 * Canonical host is https://www.christian-security-services.com. The sitemap
 * lists only pages a visitor can read without signing in. Login is prerendered
 * with noindex and is omitted here. Staff and API paths are omitted and
 * blocked in robots.txt. lastmod changes only when this public copy changes.
 */

import { COMPANY_NAME, COMPANY_PHONE_DISPLAY } from '../constants/companyContact';

export const SITE_ORIGIN = 'https://www.christian-security-services.com';
export const CONTENT_UPDATED = '2026-10-06';
export const LICENSE_ID = '2622';
export const PHONE_E164 = '+1-931-279-7879';

export const SERVICE_REGIONS = [
  {
    id: 'southwest',
    title: 'Tennessee River and Wayne County',
    summary:
      'Homes, shops, and churches from the Tennessee River towns east toward Wayne County.',
    cities: ['Selmer', 'Savannah', 'Clifton', 'Waynesboro'],
  },
  {
    id: 'south-central',
    title: 'Lawrence, Giles, and Lewis counties',
    summary:
      'Alarm, camera, and access work for residences and small businesses in the south-central towns.',
    cities: ['Lawrenceburg', 'Pulaski', 'Hohenwald'],
  },
  {
    id: 'highland',
    title: 'Eastern Highland Rim',
    summary:
      'Commercial and residential systems across Lincoln, Moore, and Coffee counties and up onto the plateau.',
    cities: ['Fayetteville', 'Lynchburg', 'Tullahoma', 'Decherd', 'Winchester', 'Monteagle'],
  },
  {
    id: 'corridor',
    title: 'Maury County to Davidson County',
    summary:
      'Installations from Maury and Bedford counties through Williamson County into Davidson County.',
    cities: ['Columbia', 'Chapel Hill', 'Shelbyville', 'Franklin', 'Nashville'],
  },
];

export const SERVICE_CITIES = SERVICE_REGIONS.flatMap((region) => region.cities);

export const SERVICES = [
  {
    slug: 'burglar-alarms',
    path: '/services/burglar-alarms',
    cardTitle: 'Burglar alarms',
    h1: 'Burglar alarm installation',
    title: 'Burglar Alarm Installation | Christian Security Services',
    description:
      'Burglar alarm installation for homes, churches, and businesses across Middle Tennessee. Licensed alarm contractor ID 2622. Request a bid or call (931) 279-7879.',
    lead: 'Intrusion detection planned for the building you have, not a one-size panel and a handful of contacts.',
    paragraphs: [
      'A burglar alarm should watch the doors, the glass, and the rooms that matter, then tell you and a monitoring center when something is wrong. We lay out sensors, the control panel, and the siren for houses, churches, offices, and shops, including loud or silent alarm options.',
      'Monitoring, app alerts, and how the system behaves when you arm it are part of the same bid. If you already have wiring or a panel, say so when you request a quote and we will inspect what can stay.',
      'Christian Security Services is Tennessee alarm contracting company ID 2622. We install across the Middle Tennessee towns listed on our service area page, from Selmer and Savannah north through Columbia to Franklin and Nashville.',
    ],
  },
  {
    slug: 'fire-alarms',
    path: '/services/fire-alarms',
    cardTitle: 'Fire alarms',
    h1: 'Fire alarm installation',
    title: 'Fire Alarm Installation | Christian Security Services',
    description:
      'Fire alarm design and installation for commercial and residential buildings in Middle Tennessee. Licensed alarm contractor ID 2622. Request a bid.',
    lead: 'Detection and notification designed around the building, the occupants, and the local requirements for that site.',
    paragraphs: [
      'Fire alarm work covers smoke and heat detection, notification appliances, and the panel that supervises them. Churches, offices, retail, and houses each need a different layout. We walk the site, identify the devices, and price the installation before work starts.',
      'We design to the conditions of the building and coordinate with the authority having jurisdiction when a review or acceptance test is required. Bring drawings or photos with the bid request if you have them.',
      'The same licensed team handles burglar, camera, and access projects, so a building that needs more than one system can be bid together. License ID 2622.',
    ],
  },
  {
    slug: 'cctv',
    path: '/services/cctv',
    cardTitle: 'CCTV & monitoring',
    h1: 'CCTV and monitoring',
    title: 'CCTV Installation and Monitoring | Christian Security Services',
    description:
      'Camera systems, recording, and remote viewing for Middle Tennessee homes and businesses. Licensed alarm contractor ID 2622. Call (931) 279-7879.',
    lead: 'Cameras placed for the doors, lots, and rooms you need to see, with recording you can open from a phone or a desk.',
    paragraphs: [
      'We install cameras, recorders, and remote viewing for homes and businesses. The bid names the views, how long video is kept, and whether the system stands alone or ties into the alarm. Monitoring is available when you want a person notified, not only a recording after the fact.',
      'Lighting, camera height, and what the lens can actually see decide whether the system is useful. We look at those on site instead of selling a fixed package.',
      'Service covers the same Middle Tennessee area as our alarm work, including Tullahoma, Winchester, Columbia, Franklin, and Nashville, and the southern towns from Selmer to Pulaski.',
    ],
  },
  {
    slug: 'access-control',
    path: '/services/access-control',
    cardTitle: 'Access control',
    h1: 'Access control installation',
    title: 'Access Control Installation | Christian Security Services',
    description:
      'Keycard and fob access control for offices, churches, and shops in Middle Tennessee. Licensed alarm contractor ID 2622. Request a bid.',
    lead: 'Controlled doors so staff, members, and tenants get in, and the doors you choose stay locked for everyone else.',
    paragraphs: [
      'Access control replaces shared keys on the doors that need a record of who entered. We install readers, locks or strikes, and credentials for offices, churches, clinics, and retail back rooms. The system can cover one employee entrance or several doors with schedules.',
      'Tell us which doors should lock on a schedule, which need a buzzer, and whether you want the access system connected to the alarm. We include that in the bid.',
      'Installation is by Christian Security Services, Tennessee alarm contracting company ID 2622, throughout the service area from Waynesboro and Hohenwald to Shelbyville, Franklin, and Nashville.',
    ],
  },
];

export const INDEXABLE_PAGES = [
  {
    path: '/',
    title: 'Christian Security Services | Middle Tennessee Alarms',
    description:
      'Licensed alarm contractor for burglar alarms, fire alarms, CCTV, and access control across Middle Tennessee. ID 2622. Call (931) 279-7879 or request a bid.',
  },
  {
    path: '/bid',
    title: 'Request a Bid | Christian Security Services',
    description:
      'Request a bid for alarm, fire, camera, or access control installation in Middle Tennessee. Christian Security Services, license ID 2622.',
  },
  {
    path: '/service-area',
    title: 'Middle Tennessee Service Area | Christian Security Services',
    description:
      'Alarm installation from Selmer, Savannah, and Waynesboro through Columbia and Shelbyville to Franklin and Nashville, including Tullahoma and Winchester.',
  },
  ...SERVICES.map((service) => ({
    path: service.path,
    title: service.title,
    description: service.description,
  })),
];

export function canonicalUrl(pathname) {
  if (pathname === '/') return `${SITE_ORIGIN}/`;
  return `${SITE_ORIGIN}${pathname}`;
}

export function buildSitemapXml() {
  const urls = INDEXABLE_PAGES.map(
    (page) => `  <url>
    <loc>${canonicalUrl(page.path)}</loc>
    <lastmod>${CONTENT_UPDATED}</lastmod>
  </url>`
  ).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

export function buildRobotsTxt() {
  return `User-agent: *
Allow: /
Disallow: /api/
Disallow: /dashboard
Disallow: /customer
Disallow: /customers
Disallow: /projects/
Disallow: /installation-history
Disallow: /admin/
Disallow: /suppliers
Disallow: /purchase-orders
Disallow: /inventory
Disallow: /accounting
Disallow: /subcontractor

Sitemap: ${SITE_ORIGIN}/sitemap.xml
`;
}

export function buildLocalBusinessJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: COMPANY_NAME,
    url: `${SITE_ORIGIN}/`,
    telephone: PHONE_E164,
    image: `${SITE_ORIGIN}/logo.png`,
    identifier: `Tennessee alarm contracting company ID ${LICENSE_ID}`,
    description: `Burglar alarms, fire alarms, CCTV, and access control for homes and businesses across Middle Tennessee. Call ${COMPANY_PHONE_DISPLAY}.`,
    areaServed: SERVICE_CITIES.map((name) => ({
      '@type': 'City',
      name,
      addressRegion: 'TN',
      addressCountry: 'US',
    })),
    knowsAbout: ['Burglar alarms', 'Fire alarms', 'CCTV', 'Access control'],
  };
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Inserts unique head tags and the prerendered body into Vite's built HTML shell.
 * The body is already escaped by the renderer. Head text is escaped here.
 */
export function applySeoTemplate(template, { title, description, canonical, robots, body }) {
  const headTags = [
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}" />`,
    `<link rel="canonical" href="${escapeHtml(canonical)}" />`,
    `<meta name="robots" content="${escapeHtml(robots)}" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<meta property="og:url" content="${escapeHtml(canonical)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:image" content="${SITE_ORIGIN}/logo.png" />`,
  ].join('\n    ');

  const withoutTitle = template.replace(/<title>[\s\S]*?<\/title>/i, '');
  const withHead = withoutTitle.replace('</head>', `    ${headTags}\n  </head>`);
  return withHead.replace('<div id="root"></div>', `<div id="root">${body}</div>`);
}
