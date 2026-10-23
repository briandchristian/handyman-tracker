/**
 * Header and hero share the company badge.
 * The header copy is the white-bar size: logo and uppercase name.
 * The hero copy is the large card on the home page.
 */

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BrandMark from '../BrandMark';

describe('BrandMark', () => {
  test('header badge uses the uppercase name at the white-bar size', () => {
    render(
      <MemoryRouter>
        <BrandMark to="/dashboard" />
      </MemoryRouter>
    );

    const badge = screen.getByTestId('brand-lockup');
    expect(badge).toHaveAttribute('href', '/dashboard');
    expect(badge).toHaveTextContent('Christian Security Services');
    expect(badge.className).toContain('gap-2');
    expect(badge.className).not.toContain('bg-white/5');
    expect(badge.querySelector('img').className).toContain('h-12');
    expect(badge.querySelector('span').className).toContain('uppercase');
    expect(badge.querySelector('span').className).toContain('font-bold');
    expect(badge.querySelector('span').className).toContain('text-gray-900');
  });

  test('hero badge uses the large home-page card', () => {
    render(
      <MemoryRouter>
        <BrandMark variant="hero" />
      </MemoryRouter>
    );

    const badge = screen.getByRole('link', { name: 'Christian Security Services' });
    expect(badge.className).toContain('rounded-2xl');
    expect(badge.className).toContain('p-8');
    expect(badge.querySelector('span').className).toContain('uppercase');
  });
});
