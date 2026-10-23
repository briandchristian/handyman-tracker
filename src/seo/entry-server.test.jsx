/**
 * The prerender entry renders the same public App tree the browser hydrates,
 * so the first HTML response already contains the page copy.
 */

import { renderPublicPath } from './entry-server';

describe('renderPublicPath', () => {
  test('unknown URLs render the not-found page instead of the homepage', () => {
    const html = renderPublicPath('/old-handyman-page');
    expect(html).toContain('Page not found');
    expect(html).not.toContain('Security you can trust in Tennessee');
  });

  test('includes service-area cities in the HTML string', () => {
    const html = renderPublicPath('/service-area');
    expect(html).toContain('Selmer');
    expect(html).toContain('Nashville');
    expect(html).toContain('Monteagle');
    expect(html).not.toContain('dashboard-component');
  });
});
