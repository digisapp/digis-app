// src/index.js
console.log('🚀 Starting Digis app...');

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import './styles/utilities.css';
import './styles/enhanced-landing.css';
import './styles/mobile-enhancements.css';
import './styles/mobile-experience-enhanced.css';
import App from './App';
// import AppDebug from './AppDebug'; // TEMPORARY DEBUG
import { AppProvider } from './contexts/AppContext';
import { ThemeProvider } from './contexts/ThemeContext';
import ErrorBoundary from './components/ui/ErrorBoundary';

console.log('📦 All imports loaded successfully');

const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error('❌ Root element not found!');
  throw new Error('Root element not found');
}

console.log('🎯 Creating React root...');
const root = ReactDOM.createRoot(rootElement);

console.log('🎨 Rendering app...');
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <ErrorBoundary>
        <AppProvider>
          <ThemeProvider>
            <App />
          </ThemeProvider>
        </AppProvider>
      </ErrorBoundary>
    </BrowserRouter>
  </React.StrictMode>
);

console.log('✅ App rendered successfully!');