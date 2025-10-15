import React from 'react';
// WalletOptimized is now the single, unified wallet component
// Legacy Wallet.js has been retired in favor of WalletOptimized + Stripe Connect flow
import WalletPageOptimized from './WalletPageOptimized';

// Wrapper component that uses the optimized version
const WalletPage = (props) => {
  return <WalletPageOptimized {...props} />;
};

export default WalletPage;