/**
 * Server render for public routes. Used by scripts/prerender-public.mjs after
 * the client build so Google receives the page copy in the first HTML response.
 * Logged-out markup matches what the browser hydrates when no session exists.
 */

import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router';
import App from '../App.jsx';

export function renderPublicPath(pathname) {
  return renderToString(
    <StaticRouter location={pathname}>
      <App />
    </StaticRouter>
  );
}
