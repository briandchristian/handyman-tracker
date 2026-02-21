/**
 * Vercel catch-all: routes all /api/* (e.g. /api/login, /api/register) to the same
 * Express app as api/index.js. Without this, only /api is handled by index.js and
 * POST /api/login would fall through to the SPA and return 405 on Vercel.
 */
import app from './index.js';
export default app;
