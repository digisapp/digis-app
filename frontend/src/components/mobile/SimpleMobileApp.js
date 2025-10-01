import React from 'react';

const SimpleMobileApp = ({ user, logout }) => {
  return (
    <div style={{ padding: '20px', background: '#e0e0e0', minHeight: '100vh' }}>
      <h1>Simple Mobile App</h1>
      <p>User: {user ? user.email : 'Not logged in'}</p>
      <button onClick={logout} style={{ padding: '10px', background: '#007bff', color: 'white', border: 'none', borderRadius: '5px' }}>
        Logout
      </button>
    </div>
  );
};

export default SimpleMobileApp;