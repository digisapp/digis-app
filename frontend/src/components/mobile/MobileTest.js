import React from 'react';
import { useMobileUI } from './MobileUIProvider';

const MobileTest = () => {
  const { triggerHaptic, isScrollingUp } = useMobileUI();

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Mobile UI Test</h2>
      <p>Scrolling Up: {isScrollingUp ? 'Yes' : 'No'}</p>
      <button 
        onClick={() => triggerHaptic('medium')}
        className="mobile-button-primary mt-4"
      >
        Test Haptic Feedback
      </button>
    </div>
  );
};

export default MobileTest;