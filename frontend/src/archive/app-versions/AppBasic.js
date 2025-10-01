import React from 'react';

const AppBasic = () => {
  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h1>Digis App - Basic Test</h1>
      <p>If you see this, React is mounting correctly!</p>
      <p>Time: {new Date().toLocaleTimeString()}</p>
    </div>
  );
};

export default AppBasic;