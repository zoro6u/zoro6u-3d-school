import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './i18n';
import { App } from './app/App';

// Offline app shell (production builds only; sandboxed hosts and the demo build don't allow service workers).
if (import.meta.env.VITE_DEMO !== '1') void import('virtual:pwa-register').then(({ registerSW }) => registerSW({ immediate: true }));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
