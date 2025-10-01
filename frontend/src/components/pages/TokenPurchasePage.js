import React from 'react';
import { useNavigate } from 'react-router-dom';
import TokenPurchase from '../TokenPurchase';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

const TokenPurchasePage = ({ user, onTokenUpdate, ...props }) => {
  const navigate = useNavigate();

  const handleSuccess = (tokensAdded, metadata) => {
    onTokenUpdate?.();
    navigate('/wallet');
  };

  const handleClose = () => {
    navigate('/wallet');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-500 to-blue-600 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={handleClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <ArrowLeftIcon className="w-6 h-6" />
          </button>
          <h1 className="text-xl sm:text-2xl font-bold">Buy Tokens</h1>
        </div>
        <p className="text-green-100">
          Add tokens to your wallet to interact with creators
        </p>
      </div>

      {/* Purchase Component */}
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <TokenPurchase
            user={user}
            onSuccess={handleSuccess}
            onClose={handleClose}
            isModal={false}
            {...props}
          />
        </div>
      </div>
    </div>
  );
};

export default TokenPurchasePage;