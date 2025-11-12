// API Configuration
// In production (Vercel), API is on same domain (serverless functions)
// In development, use local backend server
const API_BASE_URL = import.meta.env.VITE_API_URL || 
  (import.meta.env.MODE === 'production' ? '' : 'http://192.168.50.87:5000');

export default API_BASE_URL;

