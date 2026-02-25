// API Configuration
// In production (Vercel), API is on same domain (serverless functions)
// In development, use local backend (localhost). Set VITE_API_URL for LAN access (e.g. http://192.168.50.87:5000).
const API_BASE_URL = import.meta.env.VITE_API_URL ||
  (import.meta.env.MODE === 'production' ? '' : 'http://localhost:5000');

export default API_BASE_URL;

