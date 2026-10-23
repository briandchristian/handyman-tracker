/**
 * Public privacy policy at /privacy-policy.
 * The notice is written for a US business that installs alarms in Tennessee.
 * It must name the Tennessee Information Protection Act rights, tell people
 * how to appeal, and disclose that GA4 Google Signals associates site visits
 * with signed-in Google accounts.
 */

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../../App';
import { COMPANY_PHONE_TEL } from '../../constants/companyContact';
import { isPublicPath } from '../../constants/publicRoutes';
import { INDEXABLE_PAGES, buildSitemapXml, SITE_ORIGIN } from '../../seo/siteMetadata';

function renderPolicy() {
  return render(
    <MemoryRouter initialEntries={['/privacy-policy']}>
      <App />
    </MemoryRouter>
  );
}

describe('privacy policy', () => {
  test('is a public, indexable page', () => {
    expect(isPublicPath('/privacy-policy')).toBe(true);
    expect(INDEXABLE_PAGES.some((page) => page.path === '/privacy-policy')).toBe(true);
    expect(buildSitemapXml()).toContain(`${SITE_ORIGIN}/privacy-policy`);
  });

  test('states TIPA rights and how to use them', () => {
    renderPolicy();

    expect(screen.getByRole('heading', { level: 1, name: /privacy policy/i })).toBeInTheDocument();
    expect(screen.getByText(/Tennessee Information Protection Act/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^access$/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^correct$/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^delete$/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^opt-out$/i })).toBeInTheDocument();
    expect(screen.getAllByText(/45 days/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/60 days/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Attorney General/).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /privacy request/i })).toHaveAttribute(
      'href',
      COMPANY_PHONE_TEL
    );
  });

  test('discloses GA4 Google Signals data association and privacy choices', () => {
    renderPolicy();

    expect(
      screen.getByRole('heading', { name: /google analytics & data association/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/Google Analytics 4/)).toBeInTheDocument();
    expect(screen.getByText('G-24HYB6KRJX')).toBeInTheDocument();
    expect(screen.getAllByText(/Google Signals/).length).toBeGreaterThan(0);
    expect(
      screen.getByText(/link site visitation data with signed-in Google accounts/i)
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /your privacy choices/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /your privacy choices/i })).toBeInTheDocument();
    expect(screen.getByText(/ad personalization starts as denied/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /google ads settings/i })).toHaveAttribute(
      'href',
      'https://adssettings.google.com'
    );
  });
});
