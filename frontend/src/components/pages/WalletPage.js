import React, { useState } from 'react';
import TokenPurchase from '../TokenPurchase';
import Wallet from '../Wallet';
import CreatorPayoutDashboard from '../CreatorPayoutDashboard';
import PayoutSettings from '../PayoutSettings';
import { 
  WalletIcon,
  PlusIcon,
  BanknotesIcon,
  CogIcon
} from '@heroicons/react/24/outline';

const WalletPage = ({ user, isCreator, isAdmin, tokenBalance, onTokenUpdate, onViewProfile, onTokenPurchase }) => {
  const [activeSection, setActiveSection] = useState('overview');

  const sections = [
    { id: 'overview', label: 'Overview', icon: WalletIcon },
    { id: 'purchase', label: 'Buy Tokens', icon: PlusIcon },
    ...(isCreator ? [
      { id: 'payouts', label: 'Payouts', icon: BanknotesIcon },
      { id: 'payout-settings', label: 'Banking', icon: CogIcon }
    ] : [])
  ];


  return (
    <div className="space-y-8">
      {/* Header with Balance */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl p-6 md:p-8 text-white shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-3">
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
            <WalletIcon className="w-7 h-7 md:w-8 md:h-8" />
            My Wallet
          </h1>
          <span className="text-sm bg-white/20 px-3 py-1 rounded-full">
            {isCreator ? 'Creator Account' : 'Fan Account'}
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
          <div className="bg-white/20 rounded-xl p-4">
            <div className="text-sm text-purple-100 mb-2 font-medium">Token Balance</div>
            <div className="flex items-baseline gap-2">
              <div className="text-3xl font-bold">
                {tokenBalance?.toLocaleString() || 0}
              </div>
              <div className="text-sm text-purple-100">tokens</div>
            </div>
          </div>
          <div className="bg-white/20 rounded-xl p-4">
            <div className="text-sm text-purple-100 mb-2 font-medium">USD Value</div>
            <div className="text-2xl font-semibold">
              ${((tokenBalance || 0) * 0.05).toFixed(2)}
            </div>
            <div className="text-sm text-purple-100">~$0.05 per token</div>
          </div>
          <div className="bg-white/20 rounded-xl p-4 flex items-center justify-center sm:col-span-2 md:col-span-1">
            {isCreator ? (
              <button
                onClick={() => setActiveSection('payouts')}
                className="w-full sm:w-auto bg-white text-purple-600 hover:bg-white/90 rounded-lg py-2.5 px-4 sm:px-6 transition-all duration-200 flex items-center justify-center gap-2 font-medium shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                <BanknotesIcon className="w-5 h-5" />
                <span>View Payouts</span>
              </button>
            ) : (
              <button
                onClick={() => setActiveSection('purchase')}
                className="w-full sm:w-auto bg-white text-purple-600 hover:bg-white/90 rounded-lg py-2.5 px-4 sm:px-6 transition-all duration-200 flex items-center justify-center gap-2 font-medium shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                <PlusIcon className="w-5 h-5" />
                <span>Buy Tokens</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Section Navigation */}
      <div className="bg-white rounded-xl shadow-sm p-1">
        <nav className="flex flex-wrap gap-1">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`flex items-center gap-2 py-3 px-4 rounded-lg font-medium text-sm transition-all duration-200 flex-1 min-w-[120px] ${
                activeSection === section.id
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md transform scale-[1.02]'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <section.icon className="w-5 h-5" />
              <span className="whitespace-nowrap">{section.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Content Sections */}
      <div className="min-h-[400px] relative">
        {/* Loading overlay */}
        {false && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-10 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
              <span className="text-gray-600 font-medium">Loading...</span>
            </div>
          </div>
        )}
        {activeSection === 'overview' && (
          <div className="space-y-6">
            {/* Buy Tokens CTA */}
            {!isCreator && (
              <div className="bg-gradient-to-br from-purple-50 via-pink-50 to-purple-50 border border-purple-200 rounded-xl p-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-pink-500/5"></div>
                <div className="relative flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
                      <span className="text-2xl">✨</span>
                      Need More Tokens?
                    </h3>
                    <p className="text-gray-700">Purchase tokens to enjoy premium features and support your favorite creators</p>
                  </div>
                  <button
                    onClick={() => setActiveSection('purchase')}
                    className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-6 py-3 rounded-lg font-medium transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl flex items-center gap-2 whitespace-nowrap"
                  >
                    <PlusIcon className="w-5 h-5" />
                    Buy Tokens
                  </button>
                </div>
              </div>
            )}
            
            <Wallet 
              user={user}
              tokenBalance={tokenBalance}
              onTokenUpdate={onTokenUpdate}
              onViewProfile={onViewProfile}
              onTokenPurchase={onTokenPurchase}
              isCreator={isCreator}
              isAdmin={isAdmin}
            />
          </div>
        )}

        {activeSection === 'purchase' && (
          <div className="max-w-2xl mx-auto">
            <TokenPurchase
              user={user}
              onSuccess={(tokensAdded, metadata) => {
                onTokenUpdate?.();
                setActiveSection('overview');
              }}
              onClose={() => setActiveSection('overview')}
              isModal={false}
            />
          </div>
        )}

        {activeSection === 'payouts' && isCreator && (
          <CreatorPayoutDashboard />
        )}

        {activeSection === 'payout-settings' && isCreator && (
          <PayoutSettings />
        )}

      </div>
    </div>
  );
};

export default WalletPage;