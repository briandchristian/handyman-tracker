import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import axios from 'axios';
import App from './App.jsx';
import './index.css';

// On 401, clear auth and redirect to login so expired/invalid tokens don't leave the app stuck
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('userRole');
      const loginPath = '/login';
      const url = window.location.pathname === loginPath
        ? loginPath
        : `${loginPath}?session_expired=1`;
      window.location.href = url;
      // Don't reject: page is navigating away; avoid catch blocks running and causing race conditions or duplicate error UI
      return new Promise(() => {});
    }
    return Promise.reject(error);
  }
);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
