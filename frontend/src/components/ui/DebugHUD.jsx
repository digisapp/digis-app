import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import useHybridStore from '../../stores/useHybridStore';

/**
 * DebugHUD - Mobile troubleshooting overlay
 *
 * Shows real-time auth and routing state when ?debug=1 is in the URL.
 * Helps diagnose loading issues, redirect loops, and state mismatches on mobile devices.
 *
 * Usage: Visit https://digis.cc/?debug=1
 */
const DebugHUD = () => {
  const location = useLocation();
  const { authLoading, roleResolved, role, currentUser } = useAuth();
  const currentView = useHybridStore(state => state.currentView);
  const [show, setShow] = useState(false);

  // Check if debug mode is enabled
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setShow(params.get('debug') === '1');
  }, [location.search]);

  if (!show) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '10px',
        left: '10px',
        zIndex: 9999,
        background: 'rgba(0, 0, 0, 0.85)',
        color: '#0f0',
        padding: '8px 12px',
        fontFamily: 'ui-monospace, "SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, monospace',
        fontSize: '11px',
        lineHeight: '1.4',
        borderRadius: '8px',
        maxWidth: '280px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
        border: '1px solid rgba(0, 255, 0, 0.3)'
      }}
    >
      <div style={{ fontWeight: 'bold', marginBottom: '4px', color: '#ff0' }}>
        Debug HUD
      </div>
      <div>authLoading: <span style={{ color: authLoading ? '#f00' : '#0f0' }}>{String(authLoading)}</span></div>
      <div>roleResolved: <span style={{ color: roleResolved ? '#0f0' : '#f00' }}>{String(roleResolved)}</span></div>
      <div>role: <span style={{ color: '#0ff' }}>{role || 'null'}</span></div>
      <div>user: <span style={{ color: '#0ff' }}>{currentUser?.email || 'null'}</span></div>
      <div>path: <span style={{ color: '#fff' }}>{location.pathname}</span></div>
      <div>view: <span style={{ color: '#f0f' }}>{currentView || 'null'}</span></div>
    </div>
  );
};

export default DebugHUD;
