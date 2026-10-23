/**
 * Google Analytics tag for www.christian-security-services.com.
 *
 * Measurement ID G-24HYB6KRJX is installed once in the shared HTML shell,
 * immediately after <head>, so every route — including prerendered public
 * pages — loads the same tag and no page loads a second copy.
 */

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { applySeoTemplate, SITE_ORIGIN } from './siteMetadata';

const MEASUREMENT_ID = 'G-24HYB6KRJX';
const GTAG_SRC = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;

const SHELL_PATH = path.resolve(__dirname, '../../index.html');

function readShell() {
  return fs.readFileSync(SHELL_PATH, 'utf8');
}

const CONSENT_GRANTED = {
  analytics_storage: 'granted',
  ad_storage: 'granted',
  ad_user_data: 'granted',
  ad_personalization: 'denied',
};

const CONSENT_DENIED = {
  analytics_storage: 'denied',
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
};

function consentScript(html) {
  const match = html.match(/<head>\s*<script>([\s\S]*?)<\/script>/);
  if (!match) throw new Error('Consent script is not the first script in head');
  return match[1];
}

function loadConsent(stored = {}) {
  const store = { ...stored };
  const localStorage = {
    getItem: (key) => (Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null),
    setItem: (key, value) => {
      store[key] = String(value);
    },
    removeItem: (key) => {
      delete store[key];
    },
  };
  const context = { localStorage, window: { localStorage } };
  vm.createContext(context);
  vm.runInContext(consentScript(readShell()), context);
  return {
    store,
    calls: () => context.window.dataLayer.map((entry) => Array.from(entry)),
    update: context.window.updateUserPrivacyPreferences,
  };
}

describe('Google Analytics tag', () => {
  test('sets Consent Mode defaults before the Google tag script loads', () => {
    const html = readShell();
    const headOpen = html.indexOf('<head>');
    expect(headOpen).toBeGreaterThan(-1);

    const afterHead = html.slice(headOpen + '<head>'.length).trimStart();
    expect(afterHead.startsWith('<script>')).toBe(true);
    const srcAt = html.indexOf(GTAG_SRC);
    const consentAt = html.indexOf("gtag('consent', 'default'");
    const configAt = html.indexOf(`gtag('config', '${MEASUREMENT_ID}')`);
    expect(consentAt).toBeGreaterThan(-1);
    expect(consentAt).toBeLessThan(srcAt);
    expect(srcAt).toBeLessThan(configAt);
    expect(html).toContain('window.updateUserPrivacyPreferences = function');

    expect(html.match(new RegExp(GTAG_SRC.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'))).toHaveLength(1);
    expect(html.match(new RegExp(`gtag\\('config', '${MEASUREMENT_ID}'\\)`, 'g'))).toHaveLength(1);

    const loaded = loadConsent();
    expect(loaded.calls()[0]).toEqual(['consent', 'default', CONSENT_GRANTED]);
  });

  test('updateUserPrivacyPreferences denies every consent type, and opting back in restores the defaults', () => {
    const loaded = loadConsent();
    loaded.update(true);
    expect(loaded.calls().at(-1)).toEqual(['consent', 'update', CONSENT_DENIED]);
    expect(loaded.store.privacyOptOut).toBe('1');

    const returning = loadConsent({ privacyOptOut: '1' });
    expect(returning.calls()[0]).toEqual(['consent', 'default', CONSENT_DENIED]);

    returning.update(false);
    expect(returning.calls().at(-1)).toEqual(['consent', 'update', CONSENT_GRANTED]);
    expect(returning.store.privacyOptOut).toBeUndefined();
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
    expect(head.indexOf("gtag('consent', 'default'")).toBeLessThan(head.indexOf(GTAG_SRC));
    expect(head.indexOf('<!-- Google tag (gtag.js) -->')).toBeLessThan(head.indexOf('<title>'));
  });
});
