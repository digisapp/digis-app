import React from 'react';

const SimpleApp = () => {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f8f9fa',
      flexDirection: 'column',
      fontFamily: 'Inter, sans-serif'
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          fontSize: '64px',
          marginBottom: '20px'
        }}>
          🎥
        </div>
        <div style={{
          fontSize: '32px',
          color: '#333',
          marginBottom: '10px',
          fontWeight: 'bold'
        }}>
          Digis
        </div>
        <div style={{
          fontSize: '18px',
          color: '#666',
          marginBottom: '30px'
        }}>
          Platform is loading successfully!
        </div>
        <div style={{
          padding: '20px',
          backgroundColor: '#e8f5e8',
          borderRadius: '12px',
          border: '1px solid #c3e6cb'
        }}>
          <h3 style={{ color: '#28a745', margin: '0 0 10px 0' }}>✅ React App is Working</h3>
          <p style={{ margin: 0, color: '#666' }}>
            The frontend is running correctly. You can now sign in and start using Digis!
          </p>
        </div>
        <button 
          onClick={() => window.location.reload()} 
          style={{
            marginTop: '20px',
            padding: '12px 24px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: '600'
          }}
        >
          Load Full App
        </button>
      </div>
    </div>
  );
};

export default SimpleApp;