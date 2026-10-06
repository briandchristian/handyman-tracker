/**
 * The prerender entry renders the same public App tree the browser hydrates,
 * so the first HTML response already contains the page copy.
 */

import { renderPublicPath } from './entry-server';

describe('renderPublicPath', () => {
  test('includes service-area cities in the HTML string', () => {
    const html = renderPublicPath('/service-area');
    expect(html).toContain('Selmer');
    expect(html).toContain('Nashville');
    expect(html).toContain('Monteagle');
    expect(html).not.toContain('dashboard-component');
  });
});
