import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ToastHost } from './components/ToastHost';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <ToastHost />
  </StrictMode>
);

if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    // Production only: register the offline/PWA service worker.
    // Self-healing: when a NEW service worker takes control after a deploy, reload once so the
    // page can't get stuck on a stale app shell that references chunk files the deploy renamed
    // (the classic "white screen after update"). Guarded against the first-ever install and loops.
    if (navigator.serviceWorker.controller) {
      let reloading = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloading) return;
        reloading = true;
        window.location.reload();
      });
    }
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('SW registered:', registration);
          // Poll for a new SW version whenever the app regains focus.
          document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') registration.update();
          });
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  console.log('New SW available, update ready');
                }
              });
            }
          });
        })
        .catch((error) => {
          console.log('SW registration failed:', error);
        });
    });
  } else {
    // Development: the SW is cache-first on .js/.css, which makes the Expo Go WebView
    // serve stale code after edits. Ensure any previously-installed SW + its caches are
    // removed so dev always loads the latest build.
    navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
    if (window.caches) {
      caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
    }
  }
}
