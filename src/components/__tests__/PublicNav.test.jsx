/**
 * Sticky public header for /, /bid, and /login — compact branding and
 * one-tap navigation so phone visitors never hunt for Home / Bid / Sign in.
 */

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PublicNav from '../PublicNav';
import { COMPANY_PHONE_TEL } from '../../constants/companyContact';

describe('PublicNav', () => {
  test('renders sticky nav with Home, Bid, Sign in, and a tel: Call link', () => {
    const { container } = render(
      <MemoryRouter>
        <PublicNav />
      </MemoryRouter>
    );

    const nav = screen.getByTestId('public-nav');
    expect(nav).toHaveClass('sticky');
    expect(screen.getByRole('link', { name: /^home$/i })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: /^bid$/i })).toHaveAttribute('href', '/bid');
    expect(screen.getByRole('link', { name: /^sign in$/i })).toHaveAttribute('href', '/login');
    const callLinks = screen.getAllByRole('link', { name: /call/i });
    expect(callLinks.every((el) => el.getAttribute('href') === COMPANY_PHONE_TEL)).toBe(
      true
    );

    const logo = screen.getByAltText('Christian Security Services Logo');
    expect(logo.className).toMatch(/h-12|h-14/);
    expect(container.querySelector('[data-testid="public-nav"]')).toBeTruthy();
  });

  test('uses a single-row header layout from the md breakpoint up', () => {
    render(
      <MemoryRouter>
        <PublicNav />
      </MemoryRouter>
    );

    expect(screen.getByTestId('public-nav-bar')).toHaveClass('md:flex-row');
  });
});

