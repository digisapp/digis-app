// Debug entry point to identify issues
console.log('🔍 Debug: Starting app initialization...');

try {
  console.log('🔍 Debug: Importing React...');
  const React = await import('react');
  console.log('✅ React imported successfully');

  console.log('🔍 Debug: Importing ReactDOM...');
  const ReactDOM = await import('react-dom/client');
  console.log('✅ ReactDOM imported successfully');

  console.log('🔍 Debug: Creating simple component...');
  const DebugApp = () => {
    console.log('🔍 Debug: Component rendering...');
    return React.createElement('div', {
      style: {
        padding: '20px',
        fontFamily: 'Arial, sans-serif',
        backgroundColor: '#f0f0f0',
        minHeight: '100vh'
      }
    }, [
      React.createElement('h1', { key: 'title' }, '🔍 Debug Mode'),
      React.createElement('p', { key: 'status' }, 'React is working!'),
      React.createElement('div', { 
        key: 'info',
        style: { 
          backgroundColor: 'white', 
          padding: '20px', 
          borderRadius: '8px',
          marginTop: '20px' 
        } 
      }, [
        React.createElement('h2', { key: 'env-title' }, 'Environment Check:'),
        React.createElement('pre', { 
          key: 'env-info',
          style: { backgroundColor: '#f5f5f5', padding: '10px', overflow: 'auto' }
        }, JSON.stringify({
          VITE_BACKEND_URL: import.meta.env.VITE_BACKEND_URL,
          VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
          VITE_SUPABASE_ANON_KEY: !!import.meta.env.VITE_SUPABASE_ANON_KEY,
          MODE: import.meta.env.MODE,
          BASE_URL: import.meta.env.BASE_URL
        }, null, 2))
      ]),
      React.createElement('button', {
        key: 'button',
        onClick: () => {
          console.log('Loading main app...');
          window.location.href = '/';
        },
        style: {
          marginTop: '20px',
          padding: '10px 20px',
          fontSize: '16px',
          backgroundColor: '#4CAF50',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        }
      }, 'Try Loading Main App')
    ]);
  };

  console.log('🔍 Debug: Getting root element...');
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('Root element not found!');
  }
  console.log('✅ Root element found');

  console.log('🔍 Debug: Creating React root...');
  const root = ReactDOM.createRoot(rootElement);
  console.log('✅ React root created');

  console.log('🔍 Debug: Rendering component...');
  root.render(React.createElement(DebugApp));
  console.log('✅ Component rendered successfully');

} catch (error) {
  console.error('❌ Debug Error:', error);
  console.error('Stack:', error.stack);
  
  // Fallback to show error in DOM
  const rootElement = document.getElementById('root');
  if (rootElement) {
    rootElement.innerHTML = `
      <div style="padding: 20px; font-family: Arial; color: red;">
        <h1>❌ Error Loading App</h1>
        <pre style="background: #f5f5f5; padding: 10px; color: black;">${error.message}</pre>
        <p>Check the browser console for more details.</p>
      </div>
    `;
  }
}