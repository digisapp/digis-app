import React, { useState, useEffect } from 'react';
import {
  CurrencyDollarIcon,
  PencilIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { getAuthToken } from '../utils/auth-helpers';

const CreatorSubscriptionSimple = ({ user, isCreator }) => {
  const [subscriptionPrice, setSubscriptionPrice] = useState(500); // Default 500 tokens
  const [originalPrice, setOriginalPrice] = useState(500);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isCreator && user?.supabase_id) {
      loadSubscriptionData();
    }
  }, [user, isCreator]);

  const loadSubscriptionData = async () => {
    try {
      const token = await getAuthToken();

      // Load current subscription price
      const priceResponse = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/subscription-tiers/price`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (priceResponse.ok) {
        const priceData = await priceResponse.json();
        if (priceData.price) {
          setSubscriptionPrice(priceData.price);
          setOriginalPrice(priceData.price);
        }
      }
    } catch (error) {
      console.error('Error loading subscription data:', error);
    }
  };

  const handleSavePrice = async () => {
    if (subscriptionPrice < 1) {
      toast.error('Subscription price must be at least 1 token');
      return;
    }

    setIsSaving(true);
    try {
      const token = await getAuthToken();
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/subscription-tiers/price`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ price: subscriptionPrice })
        }
      );

      if (response.ok) {
        toast.success('Subscription price updated successfully!');
        setOriginalPrice(subscriptionPrice);
        setIsEditing(false);
      } else {
        throw new Error('Failed to update price');
      }
    } catch (error) {
      console.error('Error updating subscription price:', error);
      toast.error('Failed to update subscription price');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setSubscriptionPrice(originalPrice);
    setIsEditing(false);
  };

  return (
    <div className="space-y-6">
      {/* Subscription Pricing Card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <CurrencyDollarIcon className="w-5 h-5 text-green-500" />
            Subscription Settings
          </h3>
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <PencilIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
          )}
        </div>

        <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl p-6">
          <div className="text-center mb-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Monthly Subscription Price</p>
            {isEditing ? (
              <div className="flex items-center justify-center gap-2">
                <input
                  type="number"
                  value={subscriptionPrice}
                  onChange={(e) => setSubscriptionPrice(parseInt(e.target.value) || 0)}
                  className="w-32 px-3 py-2 text-3xl font-bold text-center bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-600"
                  min="1"
                />
                <span className="text-2xl font-semibold text-gray-700 dark:text-gray-300">tokens</span>
              </div>
            ) : (
              <p className="text-4xl font-bold text-purple-600 dark:text-purple-400">
                {subscriptionPrice.toLocaleString()} tokens
              </p>
            )}
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              ≈ ${(subscriptionPrice * 0.05).toFixed(2)} USD/month
            </p>
          </div>

          {isEditing && (
            <div className="flex justify-center gap-3 mt-4">
              <button
                onClick={handleSavePrice}
                disabled={isSaving}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white rounded-lg font-medium transition-colors"
              >
                {isSaving ? 'Saving...' : 'Save Price'}
              </button>
              <button
                onClick={handleCancelEdit}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default CreatorSubscriptionSimple;