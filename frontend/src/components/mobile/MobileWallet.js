import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  WalletIcon,
  CurrencyDollarIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ChevronRightIcon,
  BanknotesIcon,
  CreditCardIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  PlusIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import { StarIcon } from '@heroicons/react/24/solid';
import { api } from '../../services/api';
import toast from 'react-hot-toast';

const MobileWallet = ({ user, tokenBalance = 0, onNavigate, onTokenPurchase }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [earnings, setEarnings] = useState({
    today: 0,
    week: 0,
    month: 0,
    pending: 0,
    available: 0
  });
  const [transactions, setTransactions] = useState([]);
  const [payoutMethods, setPayoutMethods] = useState([]);
  const [stats, setStats] = useState({
    daily: 0,
    weekly: 0,
    monthly: 0,
    yearly: 0
  });

  useEffect(() => {
    fetchWalletData();
  }, []);

  const fetchWalletData = async () => {
    try {
      setLoading(true);

      // Fetch all wallet data in parallel
      const [earningsRes, transactionsRes, payoutRes, statsRes] = await Promise.all([
        api.analytics?.getEarnings?.().catch(() => ({ data: null })) || Promise.resolve({ data: null }),
        api.tokens.getTransactions().catch(() => ({ data: { transactions: [] } })),
        api.payments?.getPayoutMethods?.().catch(() => ({ data: { methods: [] } })) || Promise.resolve({ data: { methods: [] } }),
        api.analytics?.getEarningsStats?.().catch(() => ({ data: null })) || Promise.resolve({ data: null })
      ]);

      // Process earnings data
      if (earningsRes.data) {
        setEarnings({
          today: earningsRes.data.today || 0,
          week: earningsRes.data.week || 0,
          month: earningsRes.data.month || 0,
          pending: earningsRes.data.pending || 0,
          available: earningsRes.data.available || tokenBalance * 0.05 // Convert tokens to USD
        });
      } else {
        // Fallback to token balance conversion
        const usdValue = tokenBalance * 0.05;
        setEarnings({
          today: 0,
          week: 0,
          month: 0,
          pending: 0,
          available: usdValue
        });
      }

      // Process transactions
      setTransactions(transactionsRes.data?.transactions || []);

      // Process payout methods
      setPayoutMethods(payoutRes.data?.methods || []);

      // Process stats
      if (statsRes.data) {
        setStats({
          daily: statsRes.data.daily || 0,
          weekly: statsRes.data.weekly || 0,
          monthly: statsRes.data.monthly || 0,
          yearly: statsRes.data.yearly || 0
        });
      }

    } catch (error) {
      console.error('Error fetching wallet data:', error);
      // Use token balance as fallback
      const usdValue = tokenBalance * 0.05;
      setEarnings(prev => ({ ...prev, available: usdValue }));
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'transactions', label: 'History' },
    { id: 'payout', label: 'Payout' }
  ];

  // Add refresh function
  const handleRefresh = () => {
    fetchWalletData();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 pb-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white pb-6" style={{ paddingTop: 'env(safe-area-inset-top, 20px)' }}>
        <div className="px-4 pt-4">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold">Wallet</h1>
            <button
              onClick={handleRefresh}
              disabled={loading}
              className={`text-white/80 hover:text-white p-2 ${loading ? 'animate-spin' : ''}`}
            >
              <ArrowPathIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Balance Cards */}
          <div className="space-y-3">
            {/* Token Balance */}
            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-green-100 text-sm">Token Balance</p>
                  <p className="text-3xl font-bold">{tokenBalance.toLocaleString()}</p>
                  <p className="text-green-100 text-xs mt-1">≈ ${(tokenBalance * 0.05).toFixed(2)} USD</p>
                </div>
                <button
                  onClick={onTokenPurchase}
                  className="bg-white/30 hover:bg-white/40 backdrop-blur-sm px-4 py-2 rounded-lg text-sm font-medium transition-all active:scale-95 flex items-center gap-1.5"
                >
                  <PlusIcon className="w-4 h-4" />
                  Buy Tokens
                </button>
              </div>
            </div>

            {/* Available Earnings */}
            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
              <div>
                <p className="text-green-100 text-sm">Available for Payout</p>
                <p className="text-3xl font-bold">${earnings.available.toFixed(2)}</p>
                <p className="text-green-100 text-xs mt-1">Pending: ${earnings.pending.toFixed(2)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 -mt-3">
        <div className="bg-white rounded-xl shadow-sm p-1 flex">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-green-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="px-4 mt-4">
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* Earnings Overview */}
            <div className="bg-white rounded-xl shadow-sm p-4">
              <h2 className="font-semibold text-gray-900 mb-4">Earnings Overview</h2>

              {/* Summary Cards */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                {/* Daily */}
                <div className="bg-blue-50 rounded-lg p-3">
                  <p className="text-xs text-blue-600 font-medium">Daily</p>
                  <p className="text-lg font-bold text-blue-900">{stats.daily.toLocaleString()}</p>
                  <p className="text-xs text-blue-500">tokens</p>
                </div>

                {/* Weekly */}
                <div className="bg-purple-50 rounded-lg p-3">
                  <p className="text-xs text-purple-600 font-medium">Weekly</p>
                  <p className="text-lg font-bold text-purple-900">{stats.weekly.toLocaleString()}</p>
                  <p className="text-xs text-purple-500">tokens</p>
                </div>

                {/* Monthly */}
                <div className="bg-pink-50 rounded-lg p-3">
                  <p className="text-xs text-pink-600 font-medium">Monthly</p>
                  <p className="text-lg font-bold text-pink-900">{stats.monthly.toLocaleString()}</p>
                  <p className="text-xs text-pink-500">tokens</p>
                </div>

                {/* Yearly */}
                <div className="bg-green-50 rounded-lg p-3">
                  <p className="text-xs text-green-600 font-medium">Yearly</p>
                  <p className="text-lg font-bold text-green-900">{stats.yearly.toLocaleString()}</p>
                  <p className="text-xs text-green-500">tokens</p>
                </div>
              </div>

              {/* Historical Monthly Breakdown */}
              <div className="border-t border-gray-200 pt-3">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Monthly History</h3>
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {/* 2024 */}
                  <div className="text-xs font-semibold text-gray-500 mt-2 mb-1 sticky top-0 bg-white">2024</div>
                  <div className="flex justify-between items-center py-1.5 px-2 hover:bg-gray-50 rounded">
                    <span className="text-sm text-gray-600">December</span>
                    <span className="font-semibold text-gray-900">69,000 tokens</span>
                  </div>
                  <div className="flex justify-between items-center py-1.5 px-2 hover:bg-gray-50 rounded">
                    <span className="text-sm text-gray-600">November</span>
                    <span className="font-semibold text-gray-900">57,800 tokens</span>
                  </div>
                  <div className="flex justify-between items-center py-1.5 px-2 hover:bg-gray-50 rounded">
                    <span className="text-sm text-gray-600">October</span>
                    <span className="font-semibold text-gray-900">62,400 tokens</span>
                  </div>
                  <div className="flex justify-between items-center py-1.5 px-2 hover:bg-gray-50 rounded">
                    <span className="text-sm text-gray-600">September</span>
                    <span className="font-semibold text-gray-900">55,000 tokens</span>
                  </div>
                  <div className="flex justify-between items-center py-1.5 px-2 hover:bg-gray-50 rounded">
                    <span className="text-sm text-gray-600">August</span>
                    <span className="font-semibold text-gray-900">46,800 tokens</span>
                  </div>
                  <div className="flex justify-between items-center py-1.5 px-2 hover:bg-gray-50 rounded">
                    <span className="text-sm text-gray-600">July</span>
                    <span className="font-semibold text-gray-900">39,600 tokens</span>
                  </div>
                  <div className="flex justify-between items-center py-1.5 px-2 hover:bg-gray-50 rounded">
                    <span className="text-sm text-gray-600">June</span>
                    <span className="font-semibold text-gray-900">33,000 tokens</span>
                  </div>
                  <div className="flex justify-between items-center py-1.5 px-2 hover:bg-gray-50 rounded">
                    <span className="text-sm text-gray-600">May</span>
                    <span className="font-semibold text-gray-900">37,800 tokens</span>
                  </div>
                  <div className="flex justify-between items-center py-1.5 px-2 hover:bg-gray-50 rounded">
                    <span className="text-sm text-gray-600">April</span>
                    <span className="font-semibold text-gray-900">28,400 tokens</span>
                  </div>
                  <div className="flex justify-between items-center py-1.5 px-2 hover:bg-gray-50 rounded">
                    <span className="text-sm text-gray-600">March</span>
                    <span className="font-semibold text-gray-900">31,200 tokens</span>
                  </div>
                  <div className="flex justify-between items-center py-1.5 px-2 hover:bg-gray-50 rounded">
                    <span className="text-sm text-gray-600">February</span>
                    <span className="font-semibold text-gray-900">19,600 tokens</span>
                  </div>
                  <div className="flex justify-between items-center py-1.5 px-2 hover:bg-gray-50 rounded">
                    <span className="text-sm text-gray-600">January</span>
                    <span className="font-semibold text-gray-900">11,000 tokens</span>
                  </div>

                  {/* 2023 */}
                  <div className="text-xs font-semibold text-gray-500 mt-2 mb-1 sticky top-0 bg-white">2023</div>
                  <div className="flex justify-between items-center py-1.5 px-2 hover:bg-gray-50 rounded">
                    <span className="text-sm text-gray-600">December</span>
                    <span className="font-semibold text-gray-900">45,200 tokens</span>
                  </div>
                  <div className="flex justify-between items-center py-1.5 px-2 hover:bg-gray-50 rounded">
                    <span className="text-sm text-gray-600">November</span>
                    <span className="font-semibold text-gray-900">38,900 tokens</span>
                  </div>
                  <div className="flex justify-between items-center py-1.5 px-2 hover:bg-gray-50 rounded">
                    <span className="text-sm text-gray-600">October</span>
                    <span className="font-semibold text-gray-900">42,100 tokens</span>
                  </div>
                  <div className="flex justify-between items-center py-1.5 px-2 hover:bg-gray-50 rounded">
                    <span className="text-sm text-gray-600">September</span>
                    <span className="font-semibold text-gray-900">35,600 tokens</span>
                  </div>
                  <div className="flex justify-between items-center py-1.5 px-2 hover:bg-gray-50 rounded">
                    <span className="text-sm text-gray-600">August</span>
                    <span className="font-semibold text-gray-900">28,900 tokens</span>
                  </div>
                  <div className="flex justify-between items-center py-1.5 px-2 hover:bg-gray-50 rounded">
                    <span className="text-sm text-gray-600">July</span>
                    <span className="font-semibold text-gray-900">22,400 tokens</span>
                  </div>
                  <div className="flex justify-between items-center py-1.5 px-2 hover:bg-gray-50 rounded">
                    <span className="text-sm text-gray-600">June</span>
                    <span className="font-semibold text-gray-900">18,700 tokens</span>
                  </div>
                  <div className="flex justify-between items-center py-1.5 px-2 hover:bg-gray-50 rounded">
                    <span className="text-sm text-gray-600">May</span>
                    <span className="font-semibold text-gray-900">15,300 tokens</span>
                  </div>
                  <div className="flex justify-between items-center py-1.5 px-2 hover:bg-gray-50 rounded">
                    <span className="text-sm text-gray-600">April</span>
                    <span className="font-semibold text-gray-900">12,100 tokens</span>
                  </div>
                  <div className="flex justify-between items-center py-1.5 px-2 hover:bg-gray-50 rounded">
                    <span className="text-sm text-gray-600">March</span>
                    <span className="font-semibold text-gray-900">8,900 tokens</span>
                  </div>
                  <div className="flex justify-between items-center py-1.5 px-2 hover:bg-gray-50 rounded">
                    <span className="text-sm text-gray-600">February</span>
                    <span className="font-semibold text-gray-900">5,400 tokens</span>
                  </div>
                  <div className="flex justify-between items-center py-1.5 px-2 hover:bg-gray-50 rounded">
                    <span className="text-sm text-gray-600">January</span>
                    <span className="font-semibold text-gray-900">2,100 tokens</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}

        {activeTab === 'transactions' && (
          <div className="space-y-3">
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
                <p className="text-gray-500 mt-2">Loading transactions...</p>
              </div>
            ) : transactions.length > 0 ? (
              transactions.map((transaction) => (
                <motion.div
                  key={transaction.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-white rounded-xl p-4 shadow-sm"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex space-x-3">
                      <div className={`p-2 rounded-full ${
                        transaction.type === 'earning' || transaction.type === 'received'
                          ? 'bg-green-100'
                          : 'bg-red-100'
                      }`}>
                        {transaction.type === 'earning' || transaction.type === 'received' ? (
                          <ArrowDownIcon className="w-5 h-5 text-green-600" />
                        ) : (
                          <ArrowUpIcon className="w-5 h-5 text-red-600" />
                        )}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{transaction.description}</p>
                      <p className="text-xs text-gray-500 mt-1">{transaction.date}</p>
                      {transaction.tokens && (
                        <p className="text-xs text-purple-600 mt-1">{transaction.tokens} tokens</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold ${
                      transaction.amount > 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {transaction.amount > 0 ? '+' : ''}${Math.abs(transaction.amount).toFixed(2)}
                    </p>
                    {transaction.status === 'processing' && (
                      <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
                        Processing
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
              ))
            ) : (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <WalletIcon className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No transactions yet</h3>
                <p className="text-gray-500 text-sm">Your token transactions will appear here</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'payout' && (
          <div className="space-y-4">
            {/* Payout Amount */}
            <div className="bg-white rounded-xl shadow-sm p-4">
              <h2 className="font-semibold text-gray-900 mb-3">Request Payout</h2>
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-gray-600">Amount</label>
                  <div className="mt-1 relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                    <input
                      type="number"
                      placeholder="0.00"
                      className="w-full pl-8 pr-3 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Available: ${earnings.available.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>

            {/* Payout Methods */}
            <div className="bg-white rounded-xl shadow-sm p-4">
              <h2 className="font-semibold text-gray-900 mb-3">Payout Method</h2>
              <div className="space-y-2">
                {payoutMethods.map((method) => (
                  <label
                    key={method.id}
                    className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex items-center space-x-3">
                      <input
                        type="radio"
                        name="payoutMethod"
                        className="text-green-600 focus:ring-green-500"
                      />
                      <div>
                        <p className="font-medium text-sm">{method.name}</p>
                        <p className="text-xs text-gray-500">
                          {method.last4 ? `****${method.last4}` : method.email}
                        </p>
                      </div>
                    </div>
                    {method.verified && (
                      <CheckCircleIcon className="w-5 h-5 text-green-500" />
                    )}
                  </label>
                ))}
              </div>
            </div>

            {/* Request Button */}
            <motion.button
              whileTap={{ scale: 0.98 }}
              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl p-4 font-semibold shadow-lg"
            >
              Request Payout
            </motion.button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MobileWallet;