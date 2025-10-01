import React from 'react';

function TestApp() {
  return (
    <div style={{ 
      padding: '20px', 
      textAlign: 'center',
      background: '#f0f0f0',
      minHeight: '100vh'
    }}>
      <h1>React App is Loading!</h1>
      <p>If you see this, React is working.</p>
      <p>Current time: {new Date().toLocaleString()}</p>
      <button onClick={() => alert('Button clicked!')}>
        Test Button
      </button>
    </div>
  );
}

export default TestApp;