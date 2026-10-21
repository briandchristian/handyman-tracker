/**
 * Google Analytics tag for www.christian-security-services.com.
 *
 * Measurement ID G-24HYB6KRJX is installed once in the shared HTML shell,
 * immediately after <head>, so every route — including prerendered public
 * pages — loads the same tag and no page loads a second copy.
 */

import fs from 'node:fs';
import path from 'node:path';
import { applySeoTemplate, SITE_ORIGIN } from './siteMetadata';

const MEASUREMENT_ID = 'G-24HYB6KRJX';
const GTAG_SRC = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;

const SHELL_PATH = path.resolve(__dirname, '../../index.html');

function readShell() {
  return fs.readFileSync(SHELL_PATH, 'utf8');
}

describe('Google Analytics tag', () => {
  test('the shared HTML shell loads one Google tag immediately after head', () => {
    const html = readShell();
    const headOpen = html.indexOf('<head>');
    expect(headOpen).toBeGreaterThan(-1);

    const afterHead = html.slice(headOpen + '<head>'.length).trimStart();
    expect(afterHead.startsWith('<!-- Google tag (gtag.js) -->')).toBe(true);
    expect(afterHead).toContain(`<script async src="${GTAG_SRC}"></script>`);
    expect(afterHead).toContain(`gtag('config', '${MEASUREMENT_ID}');`);

    expect(html.match(new RegExp(GTAG_SRC.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'))).toHaveLength(1);
    expect(html.match(new RegExp(`gtag\\('config', '${MEASUREMENT_ID}'\\)`, 'g'))).toHaveLength(1);
  });

  test('prerender keeps that single tag on each public page', () => {
    const html = applySeoTemplate(readShell(), {
      title: 'Request a Bid | Christian Security Services',
      description: 'Request a bid for alarm installation.',
      canonical: `${SITE_ORIGIN}/bid`,
      robots: 'index, follow',
      body: '<h1>Request a bid</h1>',
    });

    const head = html.slice(html.indexOf('<head>'), html.indexOf('</head>'));
    expect(head.match(new RegExp(GTAG_SRC.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'))).toHaveLength(1);
    expect(head.match(new RegExp(`gtag\\('config', '${MEASUREMENT_ID}'\\)`, 'g'))).toHaveLength(1);
    expect(head.indexOf('<!-- Google tag (gtag.js) -->')).toBeLessThan(head.indexOf('<title>'));
  });
});
