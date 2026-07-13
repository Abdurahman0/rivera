import React from 'react';
import ReactDOM from 'react-dom/client';
import { initializeStoredDesignVariant } from './lib/design-system';
import './i18n';
import App from './App';
import './styles/tailwind.css';

initializeStoredDesignVariant();

// After a new deploy, an already-open tab still references the previous build's lazy-chunk
// hashes (e.g. BackendPages-<hash>.js). Requesting a hash that no longer exists returns the
// SPA fallback HTML, so the dynamic import fails with a MIME/module error. Reload once to
// fetch the fresh index.html; a short cooldown prevents a reload loop on a genuine failure.
window.addEventListener('vite:preloadError', event => {
  event.preventDefault();
  const lastReload = Number(sessionStorage.getItem('chunk-reload-at') || '0');
  if (Date.now() - lastReload < 10_000) return;
  sessionStorage.setItem('chunk-reload-at', String(Date.now()));
  window.location.reload();
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
