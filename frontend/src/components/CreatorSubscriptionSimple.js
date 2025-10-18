import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CurrencyDollarIcon,
  UsersIcon,
  CheckIcon,
  ArrowRightIcon,
  LockClosedIcon,
  LockOpenIcon,
  PencilIcon
} from '@heroicons/react/24/outline';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { getAuthToken } from '../utils/auth-helpers';

const CreatorSubscriptionSimple = ({ user, isCreator }) => {
  const navigate = useNavigate();
  const [subscriptionPrice, setSubscriptionPrice] = useState(500); // Default 500 tokens
  const [originalPrice, setOriginalPrice] = useState(500);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [subscribers, setSubscribers] = useState([]);
  const [stats, setStats] = useState({
    totalSubscribers: 0,
    monthlyRevenue: 0
  });

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

      // Load subscribers
      const subscribersResponse = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/subscription-tiers/my-subscribers`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (subscribersResponse.ok) {
        const subscribersData = await subscribersResponse.json();
        setSubscribers(subscribersData.subscribers || []);

        // Calculate stats
        const totalSubs = subscribersData.subscribers?.length || 0;
        const monthlyRev = totalSubs * subscriptionPrice;

        setStats({
          totalSubscribers: totalSubs,
          monthlyRevenue: monthlyRev
        });
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

        // Recalculate monthly revenue
        setStats(prev => ({
          ...prev,
          monthlyRevenue: prev.totalSubscribers * subscriptionPrice
        }));
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

        {/* What Subscribers Get */}
        <div className="mt-6 space-y-3">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Subscribers get:</p>
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <CheckIcon className="w-5 h-5 text-green-500 mt-0.5" />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Access to all exclusive content on your profile
              </p>
            </div>
            <div className="flex items-start gap-2">
              <CheckIcon className="w-5 h-5 text-green-500 mt-0.5" />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Unlock all paid photos, videos, and posts
              </p>
            </div>
            <div className="flex items-start gap-2">
              <CheckIcon className="w-5 h-5 text-green-500 mt-0.5" />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Priority messaging and interactions
              </p>
            </div>
            <div className="flex items-start gap-2">
              <CheckIcon className="w-5 h-5 text-green-500 mt-0.5" />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Special subscriber badge on their profile
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Active Subscribers */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Active Subscribers</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                {stats.totalSubscribers}
              </p>
            </div>
            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
              <UsersIcon className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
        </div>

        {/* Monthly Revenue */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Monthly Revenue</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                {stats.monthlyRevenue.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                ≈ ${(stats.monthlyRevenue * 0.05).toFixed(2)} USD
              </p>
            </div>
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-xl">
              <CurrencyDollarIcon className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Subscriber Summary */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <UsersIcon className="w-5 h-5 text-purple-500" />
            Subscriber Overview
          </h3>
          <button
            onClick={() => navigate('/subscribers')}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <span>View All Subscribers</span>
            <ArrowRightIcon className="w-4 h-4" />
          </button>
        </div>

        {subscribers.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* Recent 6 subscribers preview */}
            {subscribers.slice(0, 6).map((subscriber) => (
              <div
                key={subscriber.id}
                className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
              >
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold">
                  {subscriber.username?.[0]?.toUpperCase() || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
                    {subscriber.username}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Since {new Date(subscriber.subscribedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <UsersIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 dark:text-gray-400">
              No subscribers yet. Share your profile to grow your fanbase!
            </p>
          </div>
        )}

        {subscribers.length > 6 && (
          <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-4">
            +{subscribers.length - 6} more subscribers
          </p>
        )}
      </div>
    </div>
  );
};

export default CreatorSubscriptionSimple;