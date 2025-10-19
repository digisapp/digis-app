// src/index.js
// Import console override first to suppress all console outputs in production
import './utils/console-override.js';

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { initSentry } from './utils/sentry';
import { initializeTheme } from './utils/theme-init';
import { initServiceWorkerHotfix } from './utils/runtime-sw-hotfix';
import { autoCleanupStaleServiceWorkers } from './utils/clearServiceWorker';
import './index.css';
import './styles/utilities.css';
import './styles/enhanced-landing.css';
import './styles/mobile-enhancements.css';
import './styles/mobile-experience-enhanced.css';
import './styles/mobile-viewport-fix.css';
import App from './App';
import AppShell from './components/AppShell';

// Initialize Service Worker hotfix FIRST to clear stale caches
initServiceWorkerHotfix();

// Auto-cleanup any stale service workers (prevents chunk 404 errors)
autoCleanupStaleServiceWorkers();

// Initialize Sentry for error tracking
initSentry();

// Initialize theme (defaults to light, respects user preference)
initializeTheme();

// Set proper viewport height for mobile devices
const setViewportHeight = () => {
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--vh', `${vh}px`);
  document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
};

// Set on load
setViewportHeight();

// Update on resize and orientation change
window.addEventListener('resize', setViewportHeight);
window.addEventListener('orientationchange', () => {
  setTimeout(setViewportHeight, 100);
});

// All imports loaded successfully

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

// Creating React root
const root = ReactDOM.createRoot(rootElement);

// Rendering app with AppShell (fail-safe error + loading handling)
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <AppShell>
        <App />
      </AppShell>
    </BrowserRouter>
  </React.StrictMode>
);