/**
 * After `vite build`, render each public route to static HTML and write
 * sitemap.xml and robots.txt into dist/. Vercel serves those files as the
 * first response for www.christian-security-services.com.
 */

process.env.VITE_DEV_NO_HTTPS = '1';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const vite = await createServer({
  root,
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
});

let exitCode = 0;

try {
  const { renderPublicPath } = await vite.ssrLoadModule('/src/seo/entry-server.jsx');
  const seo = await vite.ssrLoadModule('/src/seo/siteMetadata.js');
  const template = fs.readFileSync(path.join(root, 'dist', 'index.html'), 'utf8');

  const pages = [
    ...seo.INDEXABLE_PAGES.map((page) => ({ ...page, robots: 'index, follow' })),
    {
      path: '/login',
      title: 'Sign in | Christian Security Services',
      description:
        'Customer and staff sign in for Christian Security Services. This page is not for public search.',
      robots: 'noindex, follow',
    },
  ];

  for (const page of pages) {
    const body = renderPublicPath(page.path);
    const html = seo.applySeoTemplate(template, {
      title: page.title,
      description: page.description,
      canonical: seo.canonicalUrl(page.path),
      robots: page.robots,
      body,
    });
    const outfile =
      page.path === '/'
        ? path.join(root, 'dist', 'index.html')
        : path.join(root, 'dist', page.path.replace(/^\//, ''), 'index.html');
    fs.mkdirSync(path.dirname(outfile), { recursive: true });
    fs.writeFileSync(outfile, html);
    if (!html.includes('<h1')) {
      throw new Error(`Prerender for ${page.path} did not include a heading`);
    }
  }

  fs.writeFileSync(path.join(root, 'dist', 'sitemap.xml'), seo.buildSitemapXml());
  fs.writeFileSync(path.join(root, 'dist', 'robots.txt'), seo.buildRobotsTxt());
  console.log(`Prerendered ${pages.length} public pages and wrote sitemap.xml`);
} catch (error) {
  exitCode = 1;
  console.error(error);
} finally {
  // Vite's middleware server can keep the event loop alive after prerender.
  // Race the close so `npm run build` still finishes on Vercel.
  await Promise.race([
    vite.close(),
    new Promise((resolve) => setTimeout(resolve, 3000)),
  ]);
}

process.exit(exitCode);
