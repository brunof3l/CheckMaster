import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { App } from './App';
import './i18n';
import { registerSW } from 'virtual:pwa-register';

registerSW({ immediate: true });

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);