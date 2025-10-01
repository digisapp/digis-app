// Backup of original index.js
import React from 'react';
import ReactDOM from 'react-dom/client';

// Remove CSS import temporarily to test if that's causing issues
// import './index.css';


// Simple test component to verify React is working
const TestApp = () => {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f8f9fa',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ color: '#007bff', fontSize: '48px', margin: '0 0 20px 0' }}>
          🎥 Digis
        </h1>
        <p style={{ fontSize: '18px', color: '#666', margin: '0 0 30px 0' }}>
          React is working! The frontend is loading successfully.
        </p>
        <div style={{
          padding: '20px',
          backgroundColor: '#e8f5e8',
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          <p style={{ margin: 0, color: '#28a745', fontWeight: 'bold' }}>
            ✅ Frontend Status: Operational
          </p>
        </div>
        <button 
          onClick={() => {
            window.location.reload();
          }}
          style={{
            padding: '12px 24px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '16px'
          }}
        >
          Continue to Full App
        </button>
      </div>
    </div>
  );
};

try {
  const root = ReactDOM.createRoot(document.getElementById('root'));
  
  // Check if we're in test mode
  if (window.location.search.includes('test=true')) {
    root.render(<TestApp />);
  } else {
    
    // Dynamically import the full app to catch any import errors
    import('./App').then(({ default: App }) => {
      import('./contexts/ThemeContext').then(({ ThemeProvider }) => {
        root.render(
          <React.StrictMode>
            <ThemeProvider>
              <App />
            </ThemeProvider>
          </React.StrictMode>
        );
      }).catch(error => {
// console.error('❌ Error loading ThemeProvider:', error);
        root.render(<TestApp />);
      });
    }).catch(error => {
// console.error('❌ Error loading App:', error);
      root.render(<TestApp />);
    });
  }
} catch (error) {
// console.error('❌ Critical error in index.js:', error);
  // Fallback to basic HTML
  document.getElementById('root').innerHTML = `
    <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; font-family: system-ui;">
      <div style="text-align: center;">
        <h1 style="color: #dc3545;">❌ App Loading Error</h1>
        <p>Please check the console for details and refresh the page.</p>
        <button onclick="window.location.reload()" style="padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 4px;">
          Refresh Page
        </button>
      </div>
    </div>
  `;
}