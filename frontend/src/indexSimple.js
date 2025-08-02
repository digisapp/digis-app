// Simplified entry point to test basic functionality
console.log('🚀 Starting Digis app (Simple version)...');

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import AppSimple from './AppSimple';

console.log('📦 Basic imports loaded');

try {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('Root element not found');
  }

  const root = ReactDOM.createRoot(rootElement);
  
  root.render(
    <React.StrictMode>
      <BrowserRouter>
        <AppSimple />
      </BrowserRouter>
    </React.StrictMode>
  );
  
  console.log('✅ Simple app rendered successfully!');
} catch (error) {
  console.error('❌ Error in simple app:', error);
  document.getElementById('root').innerHTML = `
    <div style="padding: 20px; color: red;">
      <h1>Error Loading App</h1>
      <pre>${error.message}</pre>
    </div>
  `;
}