// Mock for API_BASE_URL that doesn't use import.meta (matches dev: relative /api via Vite proxy)
const API_BASE_URL =
  process.env.VITE_API_URL ||
  (process.env.NODE_ENV === 'production' ? '' : '');

export default API_BASE_URL;

