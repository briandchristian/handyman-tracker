import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import axios from 'axios';
import App from './App.jsx';
import './index.css';

// On 401, clear auth and redirect to login so expired/invalid tokens don't leave the app stuck.
// Reject after a short delay so: (1) if redirect succeeds, the page unloads and the reject has no effect;
// (2) if redirect fails (e.g. blocked), callers get a rejection and the UI doesn't hang forever.
const REDIRECT_GRACE_MS = 400;
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
      error._handled401Redirect = true; // callers can check this to avoid duplicate error UI
      return new Promise((_, reject) =>
        setTimeout(() => reject(error), REDIRECT_GRACE_MS)
      );
    }
    return Promise.reject(error);
  }
);

const rootEl = document.getElementById('root');
const tree = (
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

// Prerendered HTML matches a logged-out visit. A staff session renders on the
// client so the staff nav is not hydrated into the public markup.
const hasSession = !!localStorage.getItem('token');
if (rootEl.hasChildNodes() && !hasSession) {
  ReactDOM.hydrateRoot(rootEl, tree);
} else {
  ReactDOM.createRoot(rootEl).render(tree);
}
