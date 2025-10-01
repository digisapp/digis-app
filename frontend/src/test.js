import React from 'react';
import ReactDOM from 'react-dom/client';

const TestApp = () => {
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial' }}>
      <h1>🧪 Test App Working!</h1>
      <p>If you can see this, React is loading properly.</p>
      <button onClick={() => alert('Button works!')}>Test Button</button>
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<TestApp />);