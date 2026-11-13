import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './styles/app.css';

declare global { const __APP_VERSION__: string; }

// An installed app on a phone is usually resumed from the background, not reloaded, so the browser
// never checks for a new version on its own. v3.13.0 sat unseen on Seri's phone for that reason.
// Check whenever the app comes back to the screen, and hourly while it stays open. With autoUpdate
// the new service worker takes over and the page reloads itself.
registerSW({
  immediate: true,
  onRegisteredSW(_url, reg) {
    if (!reg) return;
    let last = 0;
    const check = () => {
      if (!navigator.onLine || Date.now() - last < 60_000) return;
      last = Date.now();
      reg.update().catch(() => { /* offline or server hiccup; try again next time */ });
    };
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
    window.addEventListener('focus', check);
    window.addEventListener('online', check);
    setInterval(check, 60 * 60 * 1000);
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
