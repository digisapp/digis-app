import React from 'react';

const SimpleApp = () => {
  console.log('🔍 SimpleApp component rendering...');
  
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1 style={{ color: 'blue' }}>✅ React is Working!</h1>
      <p>If you can see this, React is rendering properly.</p>
      <div style={{ 
        backgroundColor: '#f0f0f0', 
        padding: '10px', 
        borderRadius: '5px',
        marginTop: '20px' 
      }}>
        <h2>Debug Information:</h2>
        <ul>
          <li>React Version: {React.version}</li>
          <li>Environment: {process.env.NODE_ENV}</li>
          <li>Timestamp: {new Date().toISOString()}</li>
        </ul>
      </div>
    </div>
  );
};

export default SimpleApp;