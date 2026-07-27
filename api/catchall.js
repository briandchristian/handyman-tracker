/**
 * Single Vercel serverless entry for all /api/* routes.
 * vercel.json rewrites /api/:path* → /api/catchall so this is the only function in /api/.
 */
import app from '../server/app.js';
export default app;
