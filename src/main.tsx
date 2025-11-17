import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './styles/globals.css';
import { App } from './App';
import './i18n';
import { registerSW } from 'virtual:pwa-register';

registerSW({ immediate: true });

// Default theme: dark
document.documentElement.dataset.theme = 'dark';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);