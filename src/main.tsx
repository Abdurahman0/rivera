import React from 'react';
import ReactDOM from 'react-dom/client';
import { initializeStoredDesignVariant } from './lib/design-system';
import './i18n';
import App from './App';
import './styles/tailwind.css';

initializeStoredDesignVariant();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
