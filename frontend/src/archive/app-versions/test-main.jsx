import React from 'react';
import ReactDOM from 'react-dom/client';

console.log('Test main.jsx loading...');

const TestApp = () => {
  return (
    <div style={{ padding: '20px', background: '#f0f0f0' }}>
      <h1>Digis Test App</h1>
      <p>If you see this, React is working!</p>
      <p>Time: {new Date().toLocaleTimeString()}</p>
      <hr />
      <h2>Debug Info:</h2>
      <pre>{JSON.stringify(import.meta.env, null, 2)}</pre>
    </div>
  );
};

try {
  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(<TestApp />);
  console.log('Test app rendered successfully');
} catch (error) {
  console.error('Test app error:', error);
  document.body.innerHTML = `<pre>Error: ${error.message}\n${error.stack}</pre>`;
}