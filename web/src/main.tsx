import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './i18n';
import { registerSW } from 'virtual:pwa-register';
import { App } from './app/App';

registerSW({ immediate: true }); // no-op in dev; caches the app shell in production builds

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
