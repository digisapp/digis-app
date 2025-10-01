import React, { useState, useEffect, memo } from 'react';
import { motion } from 'framer-motion';
import {
  BanknotesIcon,
  CreditCardIcon,
  ArrowDownTrayIcon,
  ChartBarIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  InformationCircleIcon,
  CalendarIcon,
  CurrencyDollarIcon,
  ArrowRightIcon,
  ExclamationCircleIcon
} from '@heroicons/react/24/outline';
import { api } from '../services/api';
import Button from './ui/Button';
import LoadingSpinner from './ui/LoadingSpinner';
import toast from 'react-hot-toast';
import PropTypes from 'prop-types';

const CreatorPayoutDashboard = memo(({ user }) => {
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState(null);
  const [recentPayouts, setRecentPayouts] = useState([]);
  const [recentEarnings, setRecentEarnings] = useState([]);
  const [stripeAccount, setStripeAccount] = useState(null);
  const [settings, setSettings] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);

  useEffect(() => {
    fetchDashboardData();
    fetchStripeAccount();
    fetchSettings();
  }, []);

  const fetchDashboardData = async (retryCount = 0) => {
    try {
      const response = await api.creatorPayouts.getDashboard();
      setDashboard(response.data.dashboard);
      setRecentPayouts(response.data.recentPayouts);
      setRecentEarnings(response.data.recentEarnings);
    } catch (error) {
      if (retryCount < 3) {
        console.warn(`Retrying fetchDashboardData (${retryCount + 1}/3)...`);
        setTimeout(() => fetchDashboardData(retryCount + 1), 1000 * (retryCount + 1));
      } else {
        toast.error('Failed to load payout dashboard');
        console.error('Dashboard error:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchStripeAccount = async () => {
    try {
      const response = await api.creatorPayouts.getStripeAccount();
      setStripeAccount(response.data);
      
      if (!response.data.hasAccount || !response.data.account?.payouts_enabled) {
        setShowOnboardingModal(true);
      }
    } catch (error) {
      console.error('Stripe account error:', error);
    }
  };

  const fetchSettings = async () => {
    try {
      const response = await api.creatorPayouts.getSettings();
      setSettings(response.data);
    } catch (error) {
      console.error('Settings error:', error);
    }
  };

  const handleStartOnboarding = async () => {
    try {
      const response = await api.creatorPayouts.createStripeAccount();
      if (response.data.onboardingUrl) {
        window.location.href = response.data.onboardingUrl;
      }
    } catch (error) {
      toast.error('Failed to start onboarding process');
    }
  };

  const handleRequestPayout = async () => {
    if (!dashboard?.can_receive_payouts) {
      toast.error('Please complete your banking setup first');
      return;
    }

    try {
      const response = await api.creatorPayouts.requestPayout();
      if (response.data.success) {
        // toast.success('Payout requested successfully!');
        fetchDashboardData();
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to request payout');
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { color: 'bg-yellow-100 text-yellow-800', icon: ClockIcon },
      processing: { color: 'bg-blue-100 text-blue-800', icon: ClockIcon },
      paid: { color: 'bg-green-100 text-green-800', icon: CheckCircleIcon },
      failed: { color: 'bg-red-100 text-red-800', icon: XCircleIcon }
    };

    const config = statusConfig[status] || statusConfig.pending;
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        <Icon className="w-3 h-3" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Skeleton Loading */}
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-48 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-96 mb-8"></div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white rounded-xl p-6 shadow-sm">
                <div className="h-4 bg-gray-200 rounded w-20 mb-4"></div>
                <div className="h-8 bg-gray-200 rounded w-32 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-24"></div>
              </div>
            ))}
          </div>
          
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="h-6 bg-gray-200 rounded w-40 mb-4"></div>
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Creator Payouts
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Manage your earnings and banking information
        </p>
      </div>

      {/* Removed Banking Status Alert - handled in Banking page */}
      {/* Removed Payout Rate Info - not needed */}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <BanknotesIcon className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <span className="text-sm text-gray-500 dark:text-gray-400">Pending</span>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(dashboard?.pending_usd)}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {dashboard?.pending_tokens || 0} tokens × $0.05
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <CurrencyDollarIcon className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <span className="text-sm text-gray-500 dark:text-gray-400">Lifetime</span>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(dashboard?.lifetime_earnings_usd)}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {dashboard?.total_payouts || 0} payouts
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <CalendarIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <span className="text-sm text-gray-500 dark:text-gray-400">Next Payout</span>
          </div>
          <div className="text-lg font-semibold text-gray-900 dark:text-white">
            {new Date(dashboard?.nextPayoutDate || Date.now()).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            })}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Bi-weekly schedule
          </div>
        </motion.div>
      </div>

      {/* Request Payout Button */}
      {dashboard?.pending_usd >= (settings?.minimum_payout_amount || 50) && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-8 p-6 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl text-white"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold mb-1">
                Request Manual Payout
              </h3>
              <p className="text-purple-100 text-sm">
                You have {formatCurrency(dashboard.pending_usd)} available for payout
              </p>
            </div>
            <Button
              variant="secondary"
              size="lg"
              onClick={handleRequestPayout}
              disabled={!dashboard.can_receive_payouts}
              className="bg-white text-purple-600 hover:bg-gray-100"
              icon={<ArrowDownTrayIcon className="w-5 h-5" />}
              aria-label={`Request payout of ${formatCurrency(dashboard.pending_usd)}`}
              onKeyDown={(e) => e.key === 'Enter' && dashboard.can_receive_payouts && handleRequestPayout()}
            >
              Request Payout
            </Button>
          </div>
        </motion.div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="-mb-px flex space-x-8" role="tablist" aria-label="Payout dashboard tabs">
          {['overview', 'history', 'earnings'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              role="tab"
              aria-selected={activeTab === tab}
              aria-controls={`${tab}-panel`}
              aria-label={`View ${tab} tab`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setActiveTab(tab);
                }
              }}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6" role="tabpanel" id="overview-panel" aria-labelledby="overview-tab">
          {/* Recent Payouts */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <BanknotesIcon className="w-5 h-5" />
                Recent Payouts
              </h2>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {recentPayouts.length > 0 ? (
                recentPayouts.map((payout) => (
                  <motion.div 
                    key={payout.id} 
                    className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors cursor-pointer"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-3">
                          <div className="hidden sm:block p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                            <CurrencyDollarIcon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-white">
                              {formatCurrency(payout.net_payout_amount)}
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {new Date(payout.payout_period_start).toLocaleDateString('en-US', { 
                                month: 'short', 
                                day: 'numeric' 
                              })} - {new Date(payout.payout_period_end).toLocaleDateString('en-US', { 
                                month: 'short', 
                                day: 'numeric',
                                year: 'numeric'
                              })}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right hidden sm:block">
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {payout.tokens_earned.toLocaleString()} tokens
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-500">
                            Fee: {formatCurrency(payout.platform_fee_amount)}
                          </p>
                        </div>
                        {getStatusBadge(payout.status)}
                      </div>
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="px-6 py-16 text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full mb-4">
                    <BanknotesIcon className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                  </div>
                  <p className="text-gray-500 dark:text-gray-400 font-medium">
                    No payouts yet
                  </p>
                  <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                    Your earnings will appear here
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div role="tabpanel" id="history-panel" aria-labelledby="history-tab">
          <PayoutHistory />
        </div>
      )}

      {activeTab === 'earnings' && (
        <div role="tabpanel" id="earnings-panel" aria-labelledby="earnings-tab">
          <RecentEarnings earnings={recentEarnings} />
        </div>
      )}

      {/* Onboarding Modal */}
      {showOnboardingModal && !stripeAccount?.hasAccount && (
        <OnboardingModal 
          onClose={() => setShowOnboardingModal(false)}
          onStart={handleStartOnboarding}
        />
      )}
    </div>
  );
});

CreatorPayoutDashboard.propTypes = {
  user: PropTypes.shape({
    id: PropTypes.string,
    uid: PropTypes.string
  })
};

// Payout History Component
const PayoutHistory = memo(() => {
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchPayoutHistory();
  }, [page]);

  const fetchPayoutHistory = async (retryCount = 0) => {
    try {
      const response = await api.creatorPayouts.getHistory({ page });
      setPayouts(response.data.payouts);
      setTotalPages(response.data.totalPages);
    } catch (error) {
      if (retryCount < 3) {
        console.warn(`Retrying fetchPayoutHistory (${retryCount + 1}/3)...`);
        setTimeout(() => fetchPayoutHistory(retryCount + 1), 1000 * (retryCount + 1));
      } else {
        toast.error('Failed to load payout history');
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
      {/* Mobile View */}
      <div className="block lg:hidden">
        {payouts.map((payout) => (
          <div key={payout.id} className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-start mb-2">
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">
                  {new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD'
                  }).format(payout.net_payout_amount)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {new Date(payout.payout_period_start).toLocaleDateString()} - 
                  {new Date(payout.payout_period_end).toLocaleDateString()}
                </p>
              </div>
              <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                payout.status === 'paid' 
                  ? 'bg-green-100 text-green-800' 
                  : payout.status === 'failed'
                  ? 'bg-red-100 text-red-800'
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                {payout.status}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-500 dark:text-gray-400">Tokens:</span>
                <span className="ml-1 font-medium">{payout.tokens_earned.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Fee:</span>
                <span className="ml-1 font-medium">
                  {new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD'
                  }).format(payout.platform_fee_amount)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Desktop View */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700/50">
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Period
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Tokens
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Gross Amount
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Your Earnings
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Net Amount
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Date
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {payouts.map((payout) => (
              <tr key={payout.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {new Date(payout.payout_period_start).toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric' 
                  })} - 
                  {new Date(payout.payout_period_end).toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  {payout.tokens_earned.toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD'
                  }).format(payout.usd_amount)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD'
                  }).format(payout.platform_fee_amount)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-white">
                  {new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD'
                  }).format(payout.net_payout_amount)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${
                    payout.status === 'paid' 
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' 
                      : payout.status === 'failed'
                      ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                      : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                  }`}>
                    {payout.status.charAt(0).toUpperCase() + payout.status.slice(1)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(payout.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            aria-label="Go to previous page"
            onKeyDown={(e) => e.key === 'Enter' && page > 1 && setPage(p => p - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            aria-label="Go to next page"
            onKeyDown={(e) => e.key === 'Enter' && page < totalPages && setPage(p => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
});

// Recent Earnings Component
const RecentEarnings = memo(({ earnings }) => {
  const getEarningTypeIcon = (type) => {
    const icons = {
      session: '📹',
      tip: '💰',
      content_purchase: '🛍️',
      membership: '⭐'
    };
    return icons[type] || '💵';
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Recent Earnings
        </h2>
      </div>
      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {earnings.map((earning) => (
          <div key={earning.id} className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-2xl">
                  {getEarningTypeIcon(earning.earning_type)}
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {earning.description || earning.earning_type.replace('_', ' ')}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {earning.fan_name && `From ${earning.fan_name} • `}
                    {new Date(earning.earned_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-medium text-gray-900 dark:text-white">
                  +{earning.tokens_earned} tokens
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  ${earning.usd_value}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

RecentEarnings.propTypes = {
  earnings: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    earning_type: PropTypes.string,
    description: PropTypes.string,
    fan_name: PropTypes.string,
    earned_at: PropTypes.string,
    tokens_earned: PropTypes.number,
    usd_value: PropTypes.number
  }))
};

RecentEarnings.defaultProps = {
  earnings: []
};

// Onboarding Modal Component
const OnboardingModal = memo(({ onClose, onStart }) => {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-gray-800 rounded-xl max-w-lg w-full p-6"
      >
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <CreditCardIcon className="w-8 h-8 text-purple-600 dark:text-purple-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Set Up Your Banking
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Complete your Stripe account setup to start receiving payouts
          </p>
        </div>

        <div className="space-y-4 mb-6">
          <div className="flex items-start gap-3">
            <CheckCircleIcon className="w-5 h-5 text-green-500 mt-0.5" />
            <div>
              <p className="font-medium text-gray-900 dark:text-white">
                Secure & Compliant
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Stripe handles all banking compliance and security
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircleIcon className="w-5 h-5 text-green-500 mt-0.5" />
            <div>
              <p className="font-medium text-gray-900 dark:text-white">
                Automatic Payouts
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Receive payouts on the 1st and 15th of each month
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircleIcon className="w-5 h-5 text-green-500 mt-0.5" />
            <div>
              <p className="font-medium text-gray-900 dark:text-white">
                Direct Deposit
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Funds deposited directly to your bank account
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            variant="secondary"
            onClick={onClose}
            className="flex-1"
            aria-label="Close onboarding modal"
            onKeyDown={(e) => e.key === 'Enter' && onClose()}
          >
            Later
          </Button>
          <Button
            variant="primary"
            onClick={onStart}
            className="flex-1"
            icon={<ArrowRightIcon className="w-4 h-4" />}
            aria-label="Start banking setup"
            onKeyDown={(e) => e.key === 'Enter' && onStart()}
          >
            Start Setup
          </Button>
        </div>
      </motion.div>
    </div>
  );
});

OnboardingModal.propTypes = {
  onClose: PropTypes.func.isRequired,
  onStart: PropTypes.func.isRequired
};

export default CreatorPayoutDashboard;