import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  CogIcon,
  BanknotesIcon,
  CalendarDaysIcon,
  DocumentTextIcon,
  ShieldCheckIcon,
  CheckIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';
import { api } from '../services/api';
import Button from './ui/Button';
import LoadingSpinner from './ui/LoadingSpinner';
import toast from 'react-hot-toast';

const PayoutSettings = () => {
  const [settings, setSettings] = useState({
    payout_enabled: true,
    minimum_payout_amount: 50,
    payout_schedule: 'biweekly',
    tax_form_submitted: false
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stripeAccount, setStripeAccount] = useState(null);

  useEffect(() => {
    fetchSettings();
    fetchStripeAccount();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await api.creatorPayouts.getSettings();
      setSettings(response.data);
    } catch (error) {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const fetchStripeAccount = async () => {
    try {
      const response = await api.creatorPayouts.getStripeAccount();
      setStripeAccount(response.data);
    } catch (error) {
      console.error('Failed to fetch Stripe account:', error);
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
      const response = await api.creatorPayouts.createStripeAccount();
      if (response.data.onboardingUrl) {
        window.location.href = response.data.onboardingUrl;
      }
    } catch (error) {
      toast.error('Failed to start Stripe setup');
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
            Banking Status
          </h2>
        </div>
        <div className="p-6">
          {stripeAccount?.hasAccount && stripeAccount?.account?.payouts_enabled ? (
            <div className="flex items-center gap-3 text-green-600 dark:text-green-400">
              <CheckIcon className="w-5 h-5" />
              <span className="font-medium">Banking setup complete</span>
            </div>
          ) : (
            <div>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Complete your Stripe account setup to receive payouts
              </p>
              <Button
                variant="primary"
                onClick={handleStripeSetup}
                icon={<BanknotesIcon className="w-5 h-5" />}
              >
                Complete Banking Setup
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Payout Configuration */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm mb-6">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <CalendarDaysIcon className="w-5 h-5" />
            Payout Configuration
          </h2>
        </div>
        <div className="p-6 space-y-6">
          {/* Enable/Disable Payouts */}
          <div>
            <label className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  Enable Automatic Payouts
                </span>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Receive automatic payouts on the 1st and 15th of each month
                </p>
              </div>
              <div className="relative inline-block w-12 h-6 transition duration-200 ease-in-out">
                <input
                  type="checkbox"
                  checked={settings.payout_enabled}
                  onChange={(e) => setSettings({...settings, payout_enabled: e.target.checked})}
                  className="opacity-0 w-0 h-0"
                  id="payout-toggle"
                />
                <label
                  htmlFor="payout-toggle"
                  className={`absolute cursor-pointer inset-0 rounded-full transition-all duration-200 ${
                    settings.payout_enabled ? 'bg-purple-600 shadow-md' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <span
                    className={`absolute left-0 w-6 h-6 bg-white rounded-full shadow-sm transform transition-all duration-200 ${
                      settings.payout_enabled ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </label>
              </div>
            </label>
          </div>

          {/* Minimum Payout Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
              Minimum Payout Amount
            </label>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              You'll only receive payouts when your balance exceeds this amount
            </p>
            <div className="grid grid-cols-3 gap-3">
              {[50, 100, 200].map((amount) => (
                <button
                  key={amount}
                  onClick={() => setSettings({...settings, minimum_payout_amount: amount})}
                  className={`p-3 rounded-lg border transition-all ${
                    settings.minimum_payout_amount === amount
                      ? 'border-purple-600 bg-purple-50 dark:bg-purple-900/30 text-purple-600'
                      : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                  }`}
                >
                  <span className="text-lg font-semibold">${amount}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Payout Schedule */}
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
              Payout Schedule
            </label>
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 flex items-start gap-3">
              <InformationCircleIcon className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div className="text-sm text-blue-800 dark:text-blue-200">
                <p className="font-medium mb-1">Bi-weekly Schedule</p>
                <p>Payouts are processed on the 1st and 15th of each month. Earnings from the 1st-15th are paid on the 1st of the following month, and earnings from the 16th-31st are paid on the 15th.</p>
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

      {/* Platform Fees */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm mb-6">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Platform Fees
          </h2>
        </div>
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-gray-600 dark:text-gray-400">Platform fee</span>
            <span className="text-lg font-semibold text-gray-900 dark:text-white">20%</span>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Digis charges a 20% platform fee on all creator earnings. This fee covers payment processing, platform maintenance, and support services.
          </p>
          
          <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              Example Calculation:
            </p>
            <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
              <div className="flex justify-between">
                <span>Tokens earned:</span>
                <span>1,000 tokens</span>
              </div>
              <div className="flex justify-between">
                <span>USD value ($0.05/token):</span>
                <span>$50.00</span>
              </div>
              <div className="flex justify-between">
                <span>Platform fee (20%):</span>
                <span>-$10.00</span>
              </div>
              <div className="flex justify-between font-medium text-gray-900 dark:text-white pt-1 border-t border-gray-200 dark:border-gray-600">
                <span>Your payout:</span>
                <span>$40.00</span>
              </div>
            </div>
          </div>
        </div>
      </div>

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
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </motion.div>
    </div>
  );
};

export default PayoutSettings;