import React, { useState, useEffect, memo, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  CogIcon,
  BanknotesIcon,
  CalendarDaysIcon,
  DocumentTextIcon,
  ShieldCheckIcon,
  CheckIcon,
  InformationCircleIcon,
  WalletIcon,
  ClockIcon
} from '@heroicons/react/24/outline';
import api from '../services/api';
import { supabase } from '../utils/supabase-auth.js';
import { getAuthToken } from '../utils/supabase-auth-enhanced';
import Button from './ui/Button';
import LoadingSpinner from './ui/LoadingSpinner';
import toast from 'react-hot-toast';
import PropTypes from 'prop-types';

const PayoutSettings = memo(({ user, tokenBalance = 0 }) => {
  const [settings, setSettings] = useState({
    payout_enabled: true,
    minimum_payout_amount: 50,
    payout_schedule: 'biweekly',
    tax_form_submitted: false
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stripeAccount, setStripeAccount] = useState(null);
  const [lastFetchTime, setLastFetchTime] = useState(null);

  // Payout activity states
  const [payouts, setPayouts] = useState([]);
  const [payoutsLoading, setPayoutsLoading] = useState(true);

  // Withdrawal settings states
  const [autoWithdrawEnabled, setAutoWithdrawEnabled] = useState(false);
  const [reservedBalance, setReservedBalance] = useState(0);
  const [withdrawableBalance, setWithdrawableBalance] = useState(0);
  const [tempReservedBalance, setTempReservedBalance] = useState('0');
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);
  const [walletData, setWalletData] = useState({ tokens: tokenBalance });

  // Payout intent states
  const [payoutIntent, setPayoutIntent] = useState(null);
  const [intentLoading, setIntentLoading] = useState(false);
  const [releasingFunds, setReleasingFunds] = useState(false);

  useEffect(() => {
    fetchSettings();
    fetchStripeAccount();
    fetchWithdrawalSettings();
    fetchWalletData();
    fetchPayouts();
    fetchPayoutIntent();
  }, []);
  
  const fetchWalletData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token;
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/wallet`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });

      if (response.ok) {
        const data = await response.json();
        setWalletData(data);
      } else {
        setWalletData({ tokens: tokenBalance });
      }
    } catch (error) {
      console.error('Error fetching wallet data:', error);
    }
  }, [tokenBalance]);
  
  const fetchWithdrawalSettings = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token;
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/payments/withdrawal-settings`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });

      if (response.ok) {
        const data = await response.json();
        setAutoWithdrawEnabled(data.settings.autoWithdrawEnabled);
        setReservedBalance(data.settings.reservedBalance);
        setWithdrawableBalance(data.settings.withdrawableBalance);
        setTempReservedBalance(data.settings.reservedBalance.toString());
      }
    } catch (error) {
      console.error('Error fetching withdrawal settings:', error);
    }
  }, []);
  
  const updateWithdrawalSettings = async (newAutoWithdraw = null, newReservedBalance = null) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token;
      
      const updates = {};
      if (newAutoWithdraw !== null) {
        updates.autoWithdrawEnabled = newAutoWithdraw;
      }
      if (newReservedBalance !== null) {
        updates.reservedBalance = newReservedBalance;
      }
      
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/payments/withdrawal-settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(updates)
      });

      if (response.ok) {
        const data = await response.json();
        setAutoWithdrawEnabled(data.settings.autoWithdrawEnabled);
        setReservedBalance(data.settings.reservedBalance);
        setWithdrawableBalance(data.settings.withdrawableBalance);
        toast.success(data.message || 'Settings updated successfully');
        setShowWithdrawalModal(false);
        await fetchWithdrawalSettings();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to update settings');
      }
    } catch (error) {
      console.error('Update withdrawal settings error:', error);
      toast.error('Failed to update withdrawal settings');
    }
  };

  const fetchSettings = async (retryCount = 0) => {
    try {
      const response = await api.creatorPayouts.getSettings();
      setSettings(response.data);
    } catch (error) {
      if (retryCount < 3) {
        console.warn(`Retrying fetchSettings (${retryCount + 1}/3)...`);
        setTimeout(() => fetchSettings(retryCount + 1), 1000 * (retryCount + 1));
      } else {
        toast.error('Failed to load settings');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchStripeAccount = async (retryCount = 0) => {
    try {
      const response = await api.creatorPayouts.getStripeAccount();
      setStripeAccount(response.data);
      setLastFetchTime(Date.now());
    } catch (error) {
      if (retryCount < 3) {
        console.warn(`Retrying fetchStripeAccount (${retryCount + 1}/3)...`);
        setTimeout(() => fetchStripeAccount(retryCount + 1), 1000 * (retryCount + 1));
      } else {
        console.error('Failed to fetch Stripe account:', error);
      }
    }
  };

  const fetchPayouts = async () => {
    try {
      setPayoutsLoading(true);
      const authToken = await getAuthToken();
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/stripe/payouts`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });

      if (response.ok) {
        const data = await response.json();
        setPayouts(data.payouts || []);
      }
    } catch (error) {
      console.error('Error fetching payouts:', error);
    } finally {
      setPayoutsLoading(false);
    }
  };

  const fetchPayoutIntent = async () => {
    try {
      setIntentLoading(true);
      const authToken = await getAuthToken();
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/creator-payouts/intent`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });

      if (response.ok) {
        const data = await response.json();
        setPayoutIntent(data);
      }
    } catch (error) {
      console.error('Error fetching payout intent:', error);
    } finally {
      setIntentLoading(false);
    }
  };

  const handleReleaseFunds = async () => {
    try {
      setReleasingFunds(true);
      const authToken = await getAuthToken();
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/creator-payouts/intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setPayoutIntent(data);
        toast.success(data.message || 'Payout request submitted successfully');
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to submit payout request');
      }
    } catch (error) {
      console.error('Error releasing funds:', error);
      toast.error('Failed to submit payout request');
    } finally {
      setReleasingFunds(false);
    }
  };

  const handleCancelIntent = async () => {
    try {
      setReleasingFunds(true);
      const authToken = await getAuthToken();
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/creator-payouts/intent`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });

      if (response.ok) {
        const data = await response.json();
        setPayoutIntent(null);
        toast.success(data.message || 'Payout request canceled');
        await fetchPayoutIntent(); // Refresh intent state
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to cancel payout request');
      }
    } catch (error) {
      console.error('Error canceling intent:', error);
      toast.error('Failed to cancel payout request');
    } finally {
      setReleasingFunds(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await api.creatorPayouts.updateSettings(settings);
      setSettings(response.data);
      // toast.success('Settings saved successfully');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleStripeSetup = async () => {
    try {
      const authToken = await getAuthToken();
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/stripe/account-link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          refresh_url: window.location.href,
          return_url: window.location.href
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create account link');
      }

      const data = await response.json();
      if (!data.url) {
        throw new Error('No account link returned');
      }

      // Redirect to Stripe
      window.location.assign(data.url);
    } catch (error) {
      console.error('Stripe setup error:', error);
      toast.error(error.message || 'Unable to open Stripe setup');
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-8 h-8 bg-gray-200 rounded"></div>
            <div className="h-8 bg-gray-200 rounded w-48"></div>
          </div>
          
          <div className="space-y-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white rounded-xl shadow-sm p-6">
                <div className="h-5 bg-gray-200 rounded w-32 mb-4"></div>
                <div className="space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-full"></div>
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-3">
          <CogIcon className="w-8 h-8" />
          Payout Settings
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Configure how and when you receive your creator earnings
        </p>
      </div>

      {/* Banking Status */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm mb-6">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <ShieldCheckIcon className="w-5 h-5" />
            Banking Information
          </h2>
        </div>
        <div className="p-6">
          {stripeAccount?.hasAccount && stripeAccount?.account?.payouts_enabled ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-green-600 dark:text-green-400 mb-4">
                <CheckIcon className="w-5 h-5" />
                <span className="font-medium">Banking setup complete</span>
              </div>

              {/* Account Details */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Account Status</span>
                  <span className="text-sm text-gray-900 dark:text-white font-semibold">Active</span>
                </div>

                {stripeAccount.account?.business_profile?.name && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Business Name</span>
                    <span className="text-sm text-gray-900 dark:text-white">{stripeAccount.account.business_profile.name}</span>
                  </div>
                )}

                {stripeAccount.account?.country && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Country</span>
                    <span className="text-sm text-gray-900 dark:text-white">{stripeAccount.account.country}</span>
                  </div>
                )}

                {stripeAccount.account?.email && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Email</span>
                    <span className="text-sm text-gray-900 dark:text-white">{stripeAccount.account.email}</span>
                  </div>
                )}

                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Payouts Enabled</span>
                  <span className="text-sm text-green-600 dark:text-green-400 font-semibold flex items-center gap-1">
                    <CheckIcon className="w-4 h-4" />
                    Yes
                  </span>
                </div>

                {stripeAccount.account?.charges_enabled && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Charges Enabled</span>
                    <span className="text-sm text-green-600 dark:text-green-400 font-semibold flex items-center gap-1">
                      <CheckIcon className="w-4 h-4" />
                      Yes
                    </span>
                  </div>
                )}
              </div>

              {/* Last Updated Timestamp */}
              {lastFetchTime && (
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <ClockIcon className="w-4 h-4" />
                  <span>Last updated {Math.floor((Date.now() - lastFetchTime) / 60000)} minutes ago</span>
                </div>
              )}

              {/* Update Banking Button */}
              <div className="space-y-2">
                <Button
                  variant="secondary"
                  onClick={handleStripeSetup}
                  icon={<CogIcon className="w-5 h-5" />}
                  aria-label="Update banking information"
                  onKeyDown={(e) => e.key === 'Enter' && handleStripeSetup()}
                >
                  Update Banking Information
                </Button>
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                  Add or change your bank account details
                </p>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Complete your Stripe account setup to receive payouts
              </p>
              <div className="space-y-2">
                <Button
                  variant="primary"
                  onClick={handleStripeSetup}
                  icon={<BanknotesIcon className="w-5 h-5" />}
                  aria-label="Set up payouts with Stripe"
                  onKeyDown={(e) => e.key === 'Enter' && handleStripeSetup()}
                >
                  Set up Payouts
                </Button>
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                  Connect your bank account to start receiving payments
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Payout Activity */}
      {stripeAccount?.hasAccount && stripeAccount?.account?.payouts_enabled && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm mb-6">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <BanknotesIcon className="w-5 h-5" />
              Payout Activity
            </h2>
          </div>
          <div className="p-6">
            {payoutsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                ))}
              </div>
            ) : payouts.length > 0 ? (
              <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                {payouts.map((payout) => (
                  <li key={payout.id} className="py-3 flex justify-between items-center text-sm">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 dark:text-white">
                        {new Date(payout.arrival_date * 1000).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {payout.description || 'Payout'}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-gray-900 dark:text-white">
                        ${(payout.amount / 100).toFixed(2)}
                      </span>
                      <span className={`px-2 py-1 text-xs font-medium uppercase rounded-full ${
                        payout.status === 'paid'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                          : payout.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                          : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                      }`}>
                        {payout.status}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
                No payouts yet. Your payout history will appear here once you start receiving payments.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Release Funds Section */}
      {stripeAccount?.hasAccount && stripeAccount?.account?.payouts_enabled && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm mb-6">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <WalletIcon className="w-5 h-5" />
              Release Funds
            </h2>
          </div>
          <div className="p-6">
            {intentLoading ? (
              <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
            ) : payoutIntent?.hasIntent && payoutIntent?.currentIntent?.status === 'pending' ? (
              <div className="space-y-4">
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <CheckIcon className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium text-green-800 dark:text-green-200 mb-1">
                        You're Queued for Payout
                      </p>
                      <p className="text-sm text-green-700 dark:text-green-300">
                        You're queued for the {payoutIntent?.nextCycleInfo?.description || 'next'} payout. Cancel if you change your mind.
                      </p>
                      {payoutIntent?.nextCycleInfo && (
                        <div className="mt-3 flex items-center gap-2 text-sm text-green-700 dark:text-green-300">
                          <ClockIcon className="w-4 h-4" />
                          <span>
                            Next payout in <strong>{payoutIntent.nextCycleInfo.daysUntil}</strong> {payoutIntent.nextCycleInfo.daysUntil === 1 ? 'day' : 'days'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  variant="secondary"
                  onClick={handleCancelIntent}
                  disabled={releasingFunds}
                  className="w-full"
                >
                  {releasingFunds ? 'Canceling...' : 'Cancel Payout Request'}
                </Button>
              </div>
            ) : payoutIntent?.hasIntent && payoutIntent?.currentIntent?.status === 'consumed' ? (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <InformationCircleIcon className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                  <div>
                    <p className="font-medium text-blue-800 dark:text-blue-200 mb-1">
                      Payout Processed
                    </p>
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      Your payout for this cycle has been processed. Check your payout activity below for details.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <InformationCircleIcon className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                    <div className="text-sm text-blue-800 dark:text-blue-200">
                      <p className="font-medium mb-2">Release Funds to Get Paid</p>
                      <p className="mb-2">
                        Click <strong>"Release Funds"</strong> to be paid on {payoutIntent?.nextCycleInfo?.description || 'the next cycle'}. If you don't click, your balance stays in your account.
                      </p>
                      {payoutIntent?.nextCycleInfo && (
                        <div className="mt-3 flex items-center gap-2">
                          <ClockIcon className="w-4 h-4" />
                          <span>
                            Next payout: <strong>{payoutIntent.nextCycleInfo.description}</strong> (in {payoutIntent.nextCycleInfo.daysUntil} {payoutIntent.nextCycleInfo.daysUntil === 1 ? 'day' : 'days'})
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  variant="primary"
                  onClick={handleReleaseFunds}
                  disabled={releasingFunds}
                  icon={<BanknotesIcon className="w-5 h-5" />}
                  className="w-full"
                >
                  {releasingFunds ? 'Processing...' : 'Release Funds'}
                </Button>
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                  Your balance stays in your account until you release it
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Automatic Payout Information */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm mb-6">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <CalendarDaysIcon className="w-5 h-5" />
            Automatic Payouts
          </h2>
        </div>
        <div className="p-6">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <InformationCircleIcon className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div className="text-sm text-blue-800 dark:text-blue-200">
                <p className="font-medium mb-2">Bi-weekly Automatic Payouts</p>
                <p className="mb-2">Your earnings are automatically paid out on the <strong>1st and 15th</strong> of each month.</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Earnings from the 1st-15th → Paid on the 1st of the following month</li>
                  <li>Earnings from the 16th-31st → Paid on the 15th of the following month</li>
                </ul>
                <div className="mt-3 p-2 bg-blue-100 dark:bg-blue-900/30 rounded">
                  <p className="text-xs font-medium">💰 Minimum payout threshold: <span className="text-blue-900 dark:text-blue-100">$50 USD in tokens</span></p>
                  <p className="text-xs mt-1">Payouts will only be processed when your balance exceeds $50.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tax Information */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm mb-6">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <DocumentTextIcon className="w-5 h-5" />
            Tax Information
          </h2>
        </div>
        <div className="p-6">
          {settings.tax_form_submitted ? (
            <div className="flex items-center gap-3 text-green-600 dark:text-green-400">
              <CheckIcon className="w-5 h-5" />
              <span className="font-medium">Tax forms submitted</span>
            </div>
          ) : (
            <div>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Tax forms will be collected through Stripe during the onboarding process
              </p>
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  <strong>Note:</strong> You'll receive a 1099 form if your earnings exceed $600 in a calendar year.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Removed Withdrawal Settings - handled in Payouts page */}

      {/* Save Button */}
      <motion.div
        className="flex justify-end"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Button
          variant="primary"
          size="lg"
          onClick={handleSave}
          disabled={saving}
          className="shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200"
          icon={saving ? <LoadingSpinner size="sm" /> : <CheckIcon className="w-5 h-5" />}
          aria-label="Save payout settings"
          onKeyDown={(e) => e.key === 'Enter' && !saving && handleSave()}
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </motion.div>
    </div>
  );
});

PayoutSettings.propTypes = {
  user: PropTypes.shape({
    id: PropTypes.string,
    uid: PropTypes.string
  }),
  tokenBalance: PropTypes.number
};

export default PayoutSettings;
