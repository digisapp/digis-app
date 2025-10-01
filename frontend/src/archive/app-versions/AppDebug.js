import React, { useEffect } from 'react';

const AppDebug = () => {
  useEffect(() => {
    // Check if we're rendering but invisible
    const root = document.getElementById('root');
    
    // Auto-test imports
    
    // Test App.js
    import('./App.js').then(module => {
    }).catch(err => {
// console.error('❌ Error importing App.js:', err.message);
    });
    
    // Test AppContext
    import('./contexts/AppContext.js').then(module => {
    }).catch(err => {
// console.error('❌ Error importing AppContext:', err.message);
    });
    
    // Test Supabase
    import('./utils/supabase.js').then(module => {
    }).catch(err => {
// console.error('❌ Error importing Supabase:', err.message);
    });
  }, []);

  return (
    <div style={{ 
      padding: '20px', 
      backgroundColor: 'lightgreen', 
      minHeight: '100vh',
      color: 'black',
      fontSize: '16px'
    }}>
      <h1 style={{ color: 'black' }}>🐛 App Debug Mode</h1>
      <p>This is the minimal App component.</p>
      
      <div style={{ marginTop: '20px', padding: '10px', backgroundColor: 'white', border: '2px solid black' }}>
        <h2>Quick Tests:</h2>
        <button 
          onClick={() => {
            import('./App.js').then(module => {
            }).catch(err => {
// console.error('❌ Error importing App.js:', err);
            });
          }}
          style={{ margin: '5px', padding: '10px' }}
        >
          Test Import App.js
        </button>
        
        <button 
          onClick={() => {
            import('./contexts/AppContext.js').then(module => {
            }).catch(err => {
// console.error('❌ Error importing AppContext:', err);
            });
          }}
          style={{ margin: '5px', padding: '10px' }}
        >
          Test Import AppContext
        </button>
        
        <button 
          onClick={() => {
            import('./utils/supabase.js').then(module => {
            }).catch(err => {
// console.error('❌ Error importing Supabase:', err);
            });
          }}
          style={{ margin: '5px', padding: '10px' }}
        >
          Test Import Supabase
        </button>
      </div>
      
      <div style={{ marginTop: '20px', padding: '10px', backgroundColor: 'yellow' }}>
        <p>If you can see this yellow box, the component is rendering!</p>
      </div>
    </div>
  );
};

export default AppDebug;