/**
 * Single Vercel serverless entry for all /api/* routes.
 * vercel.json rewrites /api/:path* → /api/catchall so this file is always hit
 * instead of falling through to the SPA (which would return 405 for POST).
 */
import app from './index.js';
export default app;
