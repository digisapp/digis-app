import React from 'react';

const AppSimple = () => {
  console.log('🎯 AppSimple component rendering...');
  
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>🚀 Digis App - Simple Version</h1>
      <p>If you can see this, React routing and basic components are working!</p>
      
      <div style={{ marginTop: '20px', padding: '20px', backgroundColor: '#f0f0f0', borderRadius: '8px' }}>
        <h2>Debug Info:</h2>
        <p>Backend URL: {import.meta.env.VITE_BACKEND_URL || 'Not set'}</p>
        <p>Supabase URL: {import.meta.env.VITE_SUPABASE_URL || 'Not set'}</p>
        <p>Environment: {import.meta.env.MODE}</p>
      </div>
      
      <button 
        onClick={() => window.location.href = '/'}
        style={{
          marginTop: '20px',
          padding: '10px 20px',
          backgroundColor: '#4CAF50',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      >
        Try Full App
      </button>
    </div>
  );
};

export default AppSimple;