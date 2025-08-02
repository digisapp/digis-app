import React, { useState } from 'react';
import { signUp, signIn } from '../utils/supabase-auth.js';
import { getAuthToken } from '../utils/auth-helpers';

const AuthDebug = () => {
  const [email, setEmail] = useState('test@example.com');
  const [password, setPassword] = useState('password123');
  const [logs, setLogs] = useState([]);

  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { timestamp, message, type }]);
    console.log(`[${type}] ${message}`);
  };

  const testSignUp = async () => {
    setLogs([]);
    addLog('Starting sign up test...');
    
    try {
      addLog('Checking environment variables...');
      addLog(`Backend URL: ${import.meta.env.VITE_BACKEND_URL}`);
      addLog(`Supabase URL: ${import.meta.env.VITE_SUPABASE_URL}`);
      addLog(`Supabase Anon Key exists: ${!!import.meta.env.VITE_SUPABASE_ANON_KEY}`);
      
      addLog('Calling Supabase signUp...');
      const userCredential = await signUp(email, password);
      addLog(`Success! User created with ID: ${userCredential.user.id}`, 'success');
      
      addLog('Getting ID token...');
      const token = data.session?.access_token;
      addLog(`Token obtained: ${token.substring(0, 20)}...`, 'success');
      
      addLog('Calling backend to create profile...');
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/auth/create-profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          username: email.split('@')[0],
          displayName: email.split('@')[0],
          bio: '',
          accountType: 'user'
        })
      });
      
      addLog(`Backend response status: ${response.status}`);
      const data = await response.json();
      
      if (response.ok) {
        addLog('Profile created successfully!', 'success');
        addLog(`Response: ${JSON.stringify(data)}`, 'success');
      } else {
        addLog(`Backend error: ${JSON.stringify(data)}`, 'error');
      }
      
    } catch (error) {
      addLog(`Error: ${error.message}`, 'error');
      addLog(`Error code: ${error.code}`, 'error');
      addLog(`Full error: ${JSON.stringify(error)}`, 'error');
    }
  };

  const testSignIn = async () => {
    setLogs([]);
    addLog('Starting sign in test...');
    
    try {
      addLog('Calling Supabase signIn...');
      const userCredential = await signIn(email, password);
      addLog(`Success! User signed in with ID: ${userCredential.user.id}`, 'success');
      
      addLog('Getting ID token...');
      const token = data.session?.access_token;
      addLog(`Token obtained: ${token.substring(0, 20)}...`, 'success');
      
    } catch (error) {
      addLog(`Error: ${error.message}`, 'error');
      addLog(`Error code: ${error.code}`, 'error');
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h2>Authentication Debug Panel</h2>
      
      <div style={{ marginBottom: '20px' }}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          style={{ padding: '10px', marginRight: '10px', width: '250px' }}
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          style={{ padding: '10px', marginRight: '10px', width: '200px' }}
        />
      </div>
      
      <div style={{ marginBottom: '20px' }}>
        <button onClick={testSignUp} style={{ padding: '10px 20px', marginRight: '10px' }}>
          Test Sign Up
        </button>
        <button onClick={testSignIn} style={{ padding: '10px 20px' }}>
          Test Sign In
        </button>
      </div>
      
      <div style={{ 
        backgroundColor: '#f0f0f0', 
        padding: '15px', 
        borderRadius: '5px',
        maxHeight: '400px',
        overflow: 'auto'
      }}>
        <h3>Debug Logs:</h3>
        {logs.length === 0 && <p>No logs yet. Click a button to test.</p>}
        {logs.map((log, index) => (
          <div key={index} style={{ 
            marginBottom: '5px',
            color: log.type === 'error' ? 'red' : log.type === 'success' ? 'green' : 'black'
          }}>
            [{log.timestamp}] {log.message}
          </div>
        ))}
      </div>
    </div>
  );
};

export default AuthDebug;