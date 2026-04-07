// API Configuration
// Production (Vercel): same origin — use relative /api/... paths.
// Development: use '' so requests go to the Vite dev host (localhost or LAN IP). Vite proxies /api → backend (vite.config.js).
// Override only if you must hit the API without the dev proxy (e.g. http://192.168.50.89:5000).
const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.MODE === 'production' ? '' : '');

export default API_BASE_URL;

