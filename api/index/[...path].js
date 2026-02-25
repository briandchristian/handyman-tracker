/**
 * Vercel catch-all for /api/index/* (e.g. /api/index/login). The rewrite sends
 * /api/login → /api/index/login; this file ensures that path hits the Express app.
 */
import app from '../index.js';
export default app;
