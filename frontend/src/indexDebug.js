// Debug version with extensive logging
console.log('🚀 [1] Starting Digis app debug...');

import React from 'react';
console.log('✅ [2] React imported');

import ReactDOM from 'react-dom/client';
console.log('✅ [3] ReactDOM imported');

import { BrowserRouter } from 'react-router-dom';
console.log('✅ [4] BrowserRouter imported');

// Try importing styles one by one
try {
  import('./index.css');
  console.log('✅ [5] index.css imported');
} catch (e) {
  console.error('❌ [5] Error importing index.css:', e);
}

// Create minimal components to test
const TestErrorBoundary = ({ children }) => {
  console.log('🎯 [6] TestErrorBoundary rendering');
  return children;
};

const TestAppProvider = ({ children }) => {
  console.log('🎯 [7] TestAppProvider rendering');
  return children;
};

const TestThemeProvider = ({ children }) => {
  console.log('🎯 [8] TestThemeProvider rendering');
  return children;
};

const TestApp = () => {
  console.log('🎯 [9] TestApp rendering');
  return (
    <div style={{ padding: '20px', backgroundColor: 'lightblue', minHeight: '100vh' }}>
      <h1>Debug App is Rendering!</h1>
      <p>If you see this, the basic structure works.</p>
      <button onClick={() => {
        console.log('Button clicked!');
        alert('Button works!');
      }}>Test Button</button>
    </div>
  );
};

console.log('📍 [10] About to get root element...');
const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error('❌ [11] Root element not found!');
  document.body.innerHTML = '<h1 style="color: red;">Root element not found!</h1>';
} else {
  console.log('✅ [11] Root element found:', rootElement);
  
  try {
    console.log('📍 [12] Creating React root...');
    const root = ReactDOM.createRoot(rootElement);
    console.log('✅ [13] React root created');
    
    console.log('📍 [14] About to render...');
    root.render(
      <React.StrictMode>
        <BrowserRouter>
          <TestErrorBoundary>
            <TestAppProvider>
              <TestThemeProvider>
                <TestApp />
              </TestThemeProvider>
            </TestAppProvider>
          </TestErrorBoundary>
        </BrowserRouter>
      </React.StrictMode>
    );
    console.log('✅ [15] Render called successfully!');
    
    // Check if anything was actually rendered
    setTimeout(() => {
      console.log('📍 [16] Checking rendered content...');
      console.log('Root element innerHTML length:', rootElement.innerHTML.length);
      console.log('Root element children:', rootElement.children.length);
      if (rootElement.innerHTML.length < 50) {
        console.error('❌ [17] Nothing was rendered!');
      } else {
        console.log('✅ [17] Content was rendered successfully');
      }
    }, 1000);
    
  } catch (error) {
    console.error('❌ Error during render:', error);
    rootElement.innerHTML = `<h1 style="color: red;">Render Error: ${error.message}</h1>`;
  }
}