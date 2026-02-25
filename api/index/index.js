/**
 * Vercel route /api/index/* — invoked when vercel.json rewrites /api/:path* to /api/index/:path*.
 * Re-exports the main Express app so POST /api/login etc. hit the API instead of the SPA.
 */
import app from '../index.js';
export default app;
