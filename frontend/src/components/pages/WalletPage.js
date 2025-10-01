import React from 'react';
// Import the optimized version
import WalletPageOptimized from './WalletPageOptimized';

// Wrapper component that uses the optimized version
const WalletPage = (props) => {
  return <WalletPageOptimized {...props} />;
};

export default WalletPage;