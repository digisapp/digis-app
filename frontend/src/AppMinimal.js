import React from 'react';

const AppMinimal = () => {
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>Digis App - Minimal Test</h1>
      <p>If you can see this, React is working!</p>
      <div style={{ marginTop: '20px', padding: '10px', background: '#f0f0f0', borderRadius: '5px' }}>
        <p>Debug Info:</p>
        <ul>
          <li>React Version: {React.version}</li>
          <li>Window Location: {window.location.href}</li>
          <li>User Agent: {navigator.userAgent}</li>
        </ul>
      </div>
    </div>
  );
};

export default AppMinimal;