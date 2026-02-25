// Mock for API_BASE_URL that doesn't use import.meta
const API_BASE_URL = process.env.VITE_API_URL || 
  (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5000');

export default API_BASE_URL;

