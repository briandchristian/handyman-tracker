/**
 * Public service and service-area pages.
 * Each service has its own heading and copy. The service-area page names the
 * Middle Tennessee cities in original regional copy, not a duplicated city
 * template. Homepage service cards link to those pages.
 */

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';

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

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>
  );
}

describe('public service pages', () => {
  test.each([
    ['/services/burglar-alarms', /burglar alarm installation/i],
    ['/services/fire-alarms', /fire alarm installation/i],
    ['/services/cctv', /cctv and monitoring/i],
    ['/services/access-control', /access control installation/i],
  ])('%s has its own heading', (path, heading) => {
    renderAt(path);
    expect(screen.getByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /request a bid/i })).toHaveAttribute('href', '/bid');
  });

  test('service area names every city the company covers', () => {
    renderAt('/service-area');
    expect(
      screen.getByRole('heading', { level: 1, name: /middle tennessee service area/i })
    ).toBeInTheDocument();
    for (const city of CITIES) {
      expect(screen.getByText(new RegExp(city))).toBeInTheDocument();
    }
    expect(screen.getByText(/2622/)).toBeInTheDocument();
  });

  test('homepage service cards link to the service pages and the service area', () => {
    renderAt('/');
    expect(screen.getByRole('link', { name: /burglar alarms/i })).toHaveAttribute(
      'href',
      '/services/burglar-alarms'
    );
    expect(screen.getByRole('link', { name: /fire alarms/i })).toHaveAttribute(
      'href',
      '/services/fire-alarms'
    );
    expect(screen.getByRole('link', { name: /cctv/i })).toHaveAttribute('href', '/services/cctv');
    expect(screen.getByRole('link', { name: /access control/i })).toHaveAttribute(
      'href',
      '/services/access-control'
    );
    expect(screen.getByRole('link', { name: /service area/i })).toHaveAttribute(
      'href',
      '/service-area'
    );
  });
});
