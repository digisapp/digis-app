import React, { useState, useEffect } from 'react';
import {
  CurrencyDollarIcon,
  UsersIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  ChartBarIcon,
  SparklesIcon,
  CheckIcon,
  XMarkIcon,
  InformationCircleIcon,
  ArrowTrendingUpIcon,
  CalendarDaysIcon,
  StarIcon
} from '@heroicons/react/24/outline';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../utils/supabase-auth';

const CreatorSubscriptionManagement = ({ user, isCreator }) => {
  const [activeTab, setActiveTab] = useState('plans');
  const [subscriptionPlans, setSubscriptionPlans] = useState([]);
  const [subscribers, setSubscribers] = useState([]);
  const [stats, setStats] = useState({
    totalSubscribers: 0,
    monthlyRecurringRevenue: 0,
    activeSubscribers: 0,
    cancelingSubscribers: 0
  });
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state for creating/editing plans
  const [planForm, setPlanForm] = useState({
    name: '',
    description: '',
    price: '',
    priceInTokens: '',
    billingInterval: 'month',
    features: [''],
    perks: ['']
  });

  // Token conversion rate (1 token = $0.05)
  const TOKEN_RATE = 0.05;

  useEffect(() => {
    loadSubscriptionData();
  }, [user]);

  const loadSubscriptionData = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      if (!token) {
        console.error('No auth token available');
        return;
      }
      
      // Load subscription plans
      const plansResponse = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/subscriptions/creator/${user.id || user.uid}/plans`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (plansResponse.ok) {
        const plansData = await plansResponse.json();
        setSubscriptionPlans(plansData.plans || []);
      }

      // Load subscribers
      const subscribersResponse = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/subscriptions/my-subscribers`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (subscribersResponse.ok) {
        const subscribersData = await subscribersResponse.json();
        setSubscribers(subscribersData.subscribers || []);
        setStats(subscribersData.stats || {
          totalSubscribers: 0,
          monthlyRecurringRevenue: 0,
          activeSubscribers: 0,
          cancelingSubscribers: 0
        });
      }
    } catch (error) {
      console.error('Error loading subscription data:', error);
      setError('Failed to load subscription data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePlan = async () => {
    setError('');
    setSuccess('');

    // Validate form
    if (!planForm.name || !planForm.description || !planForm.priceInTokens) {
      setError('Please fill in all required fields');
      return;
    }

    if (parseFloat(planForm.priceInTokens) <= 0) {
      setError('Token amount must be greater than 0');
      return;
    }

    const validFeatures = planForm.features.filter(f => f.trim() !== '');
    const validPerks = planForm.perks.filter(p => p.trim() !== '');

    if (validFeatures.length === 0) {
      setError('Please add at least one feature');
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/subscriptions/plans`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            ...planForm,
            price: parseFloat(planForm.price),
            features: validFeatures,
            perks: validPerks
          })
        }
      );

      if (response.ok) {
        const data = await response.json();
        setSuccess('Subscription plan created successfully!');
        setShowCreateModal(false);
        resetForm();
        await loadSubscriptionData();
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to create subscription plan');
      }
    } catch (error) {
      console.error('Error creating plan:', error);
      setError('Failed to create subscription plan');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePlan = async () => {
    if (!selectedPlan) return;

    setError('');
    setSuccess('');

    const validFeatures = planForm.features.filter(f => f.trim() !== '');
    const validPerks = planForm.perks.filter(p => p.trim() !== '');

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/subscriptions/plans/${selectedPlan.id}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: planForm.name,
            description: planForm.description,
            features: validFeatures,
            perks: validPerks,
            isActive: selectedPlan.isActive
          })
        }
      );

      if (response.ok) {
        setSuccess('Subscription plan updated successfully!');
        setShowEditModal(false);
        setSelectedPlan(null);
        resetForm();
        await loadSubscriptionData();
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to update subscription plan');
      }
    } catch (error) {
      console.error('Error updating plan:', error);
      setError('Failed to update subscription plan');
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePlanStatus = async (plan) => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/subscriptions/plans/${plan.id}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            ...plan,
            isActive: !plan.isActive
          })
        }
      );

      if (response.ok) {
        setSuccess(`Plan ${plan.isActive ? 'deactivated' : 'activated'} successfully!`);
        await loadSubscriptionData();
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to update plan status');
      }
    } catch (error) {
      console.error('Error toggling plan status:', error);
      setError('Failed to update plan status');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setPlanForm({
      name: '',
      description: '',
      price: '',
      priceInTokens: '',
      billingInterval: 'month',
      features: [''],
      perks: ['']
    });
  };

  const addFeature = () => {
    setPlanForm(prev => ({
      ...prev,
      features: [...prev.features, '']
    }));
  };

  const removeFeature = (index) => {
    setPlanForm(prev => ({
      ...prev,
      features: prev.features.filter((_, i) => i !== index)
    }));
  };

  const updateFeature = (index, value) => {
    setPlanForm(prev => ({
      ...prev,
      features: prev.features.map((f, i) => i === index ? value : f)
    }));
  };

  const addPerk = () => {
    setPlanForm(prev => ({
      ...prev,
      perks: [...prev.perks, '']
    }));
  };

  const removePerk = (index) => {
    setPlanForm(prev => ({
      ...prev,
      perks: prev.perks.filter((_, i) => i !== index)
    }));
  };

  const updatePerk = (index, value) => {
    setPlanForm(prev => ({
      ...prev,
      perks: prev.perks.map((p, i) => i === index ? value : p)
    }));
  };

  const openEditModal = (plan) => {
    setSelectedPlan(plan);
    const tokensAmount = Math.round(plan.price / TOKEN_RATE);
    setPlanForm({
      name: plan.name,
      description: plan.description,
      price: plan.price.toString(),
      priceInTokens: tokensAmount.toString(),
      billingInterval: plan.billingInterval,
      features: plan.features || [''],
      perks: plan.perks || ['']
    });
    setShowEditModal(true);
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Show creator-only message if not a creator
  if (!isCreator) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <SparklesIcon className="w-16 h-16 text-purple-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Creator Subscriptions</h2>
          <p className="text-gray-600 dark:text-gray-400">
            This feature is only available for creators.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
            Become a creator to manage subscription plans and build your community.
          </p>
        </div>
      </div>
    );
  }

  if (loading && subscriptionPlans.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
          <SparklesIcon className="w-8 h-8 text-purple-600" />
          Subscription Management
        </h2>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-600 dark:text-purple-400 font-medium">Total Subscribers</p>
                <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">{stats.totalSubscribers}</p>
              </div>
              <UsersIcon className="w-8 h-8 text-purple-500 opacity-50" />
            </div>
          </div>

          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600 dark:text-green-400 font-medium">Monthly Revenue</p>
                <p className="text-2xl font-bold text-green-900 dark:text-green-100">${stats.monthlyRecurringRevenue}</p>
              </div>
              <CurrencyDollarIcon className="w-8 h-8 text-green-500 opacity-50" />
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">Active</p>
                <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{stats.activeSubscribers}</p>
              </div>
              <ArrowTrendingUpIcon className="w-8 h-8 text-blue-500 opacity-50" />
            </div>
          </div>

          <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-orange-600 dark:text-orange-400 font-medium">Canceling</p>
                <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">{stats.cancelingSubscribers}</p>
              </div>
              <ChartBarIcon className="w-8 h-8 text-orange-500 opacity-50" />
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('plans')}
              className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'plans'
                  ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              Subscription Plans
            </button>
            <button
              onClick={() => setActiveTab('subscribers')}
              className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'subscribers'
                  ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              Subscribers ({stats.totalSubscribers})
            </button>
          </nav>
        </div>
      </div>

      {/* Status Messages */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-3"
          >
            <XMarkIcon className="w-5 h-5 text-red-500 flex-shrink-0" />
            <span className="text-red-700 dark:text-red-300">{error}</span>
          </motion.div>
        )}

        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-3"
          >
            <CheckIcon className="w-5 h-5 text-green-500 flex-shrink-0" />
            <span className="text-green-700 dark:text-green-300">{success}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      {activeTab === 'plans' && (
        <div className="space-y-6">
          {/* Create New Plan Button */}
          {subscriptionPlans.length < 3 && subscriptionPlans.length > 0 && (
            <div className="flex justify-end">
              <button
                onClick={() => {
                  resetForm();
                  setShowCreateModal(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                <PlusIcon className="w-5 h-5" />
                Create New Plan
              </button>
            </div>
          )}

          {/* Subscription Plans */}
          {subscriptionPlans.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
              <SparklesIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                No Subscription Plans Yet
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Create your first subscription plan to start building your community of supporters.
              </p>
              <button
                onClick={() => {
                  if (subscriptionPlans.length >= 3) {
                    setError('You can only create up to 3 subscription plans');
                    return;
                  }
                  resetForm();
                  setShowCreateModal(true);
                }}
                disabled={subscriptionPlans.length >= 3}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  subscriptionPlans.length >= 3 
                    ? 'bg-gray-400 text-gray-600 cursor-not-allowed' 
                    : 'bg-purple-600 text-white hover:bg-purple-700'
                }`}
              >
                <PlusIcon className="w-5 h-5" />
                Create Subscription Plan
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {subscriptionPlans.map((plan) => (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{plan.name}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{plan.description}</p>
                    </div>
                    <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                      plan.isActive 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' 
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
                    }`}>
                      {plan.isActive ? 'Active' : 'Inactive'}
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                      {Math.round(plan.price / TOKEN_RATE)} tokens
                      <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
                        /{plan.billingInterval}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      ≈ ${plan.price} USD
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {plan.subscriberCount} subscriber{plan.subscriberCount !== 1 ? 's' : ''}
                    </div>
                  </div>

                  {plan.features && plan.features.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Features:</h4>
                      <ul className="space-y-1">
                        {plan.features.slice(0, 3).map((feature, index) => (
                          <li key={index} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                            <CheckIcon className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                            <span>{feature}</span>
                          </li>
                        ))}
                        {plan.features.length > 3 && (
                          <li className="text-sm text-gray-500 dark:text-gray-400 italic">
                            +{plan.features.length - 3} more...
                          </li>
                        )}
                      </ul>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={() => openEditModal(plan)}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    >
                      <PencilIcon className="w-4 h-4" />
                      Edit
                    </button>
                    <button
                      onClick={() => handleTogglePlanStatus(plan)}
                      disabled={loading}
                      className={`flex-1 px-3 py-2 rounded-lg transition-colors ${
                        plan.isActive
                          ? 'bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:hover:bg-orange-900/50'
                          : 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50'
                      }`}
                    >
                      {plan.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Info Box */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 flex items-start gap-3">
            <InformationCircleIcon className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800 dark:text-blue-200">
              <p className="font-medium mb-1">Subscription Plan Tips:</p>
              <ul className="list-disc list-inside space-y-1 text-blue-700 dark:text-blue-300">
                <li>Offer multiple plans to cater to different budget levels</li>
                <li>Clearly define the benefits and perks for each plan</li>
                <li>Consider offering annual plans with a discount</li>
                <li>Regularly engage with your subscribers to reduce churn</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'subscribers' && (
        <div className="space-y-6">
          {subscribers.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
              <UsersIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                No Subscribers Yet
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Share your subscription plans to start building your community.
              </p>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-900/50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Subscriber
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Plan
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Subscribed
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Next Billing
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {subscribers.map((subscriber) => (
                      <tr key={subscriber.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="h-10 w-10 flex-shrink-0">
                              {subscriber.subscriberProfilePic ? (
                                <img
                                  className="h-10 w-10 rounded-full object-cover"
                                  src={subscriber.subscriberProfilePic}
                                  alt={subscriber.subscriberUsername}
                                />
                              ) : (
                                <div className="h-10 w-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                                  <span className="text-purple-600 dark:text-purple-400 font-medium">
                                    {subscriber.subscriberUsername?.[0]?.toUpperCase() || '?'}
                                  </span>
                                </div>
                              )}
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                {subscriber.subscriberUsername}
                              </div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">
                                {subscriber.subscriberEmail}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 dark:text-gray-100">{subscriber.planName}</div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {Math.round(subscriber.price / TOKEN_RATE)} tokens/{subscriber.billingInterval}
                          </div>
                          <div className="text-xs text-gray-400 dark:text-gray-500">
                            ≈ ${subscriber.price} USD
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            subscriber.status === 'active'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400'
                          }`}>
                            {subscriber.status === 'active' ? 'Active' : 'Canceling'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {formatDate(subscriber.createdAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {formatDate(subscriber.currentPeriodEnd)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Subscriber Engagement Tips */}
          <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4 flex items-start gap-3">
            <StarIcon className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-purple-800 dark:text-purple-200">
              <p className="font-medium mb-1">Keep Your Subscribers Engaged:</p>
              <ul className="list-disc list-inside space-y-1 text-purple-700 dark:text-purple-300">
                <li>Post exclusive content regularly for your subscribers</li>
                <li>Host subscriber-only live streams and Q&A sessions</li>
                <li>Send personalized thank you messages to new subscribers</li>
                <li>Create a community feeling with subscriber-only chats</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Plan Modal */}
      <AnimatePresence>
        {(showCreateModal || showEditModal) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            onClick={() => {
              setShowCreateModal(false);
              setShowEditModal(false);
              setSelectedPlan(null);
              resetForm();
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <h2 className="text-2xl font-bold mb-6">
                  {showEditModal ? 'Edit Subscription Plan' : 'Create Subscription Plan'}
                </h2>

                <div className="space-y-6">
                  {/* Plan Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Plan Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={planForm.name}
                      onChange={(e) => setPlanForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g., Bronze Plan, Silver Plan, Gold Plan"
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Description <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={planForm.description}
                      onChange={(e) => setPlanForm(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Describe what subscribers get with this plan..."
                      rows={3}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                  </div>

                  {/* Price and Billing */}
                  <div className="space-y-4">
                    {/* Token pricing info */}
                    <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-lg p-3">
                      <p className="text-sm text-purple-800 dark:text-purple-200">
                        <span className="font-medium">💎 Token Pricing:</span> Subscribers purchase tokens to access content. 1 token = $0.05 USD
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Price in Tokens <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            value={planForm.priceInTokens}
                            onChange={(e) => {
                              const tokens = e.target.value;
                              const usdPrice = (parseFloat(tokens) * TOKEN_RATE).toFixed(2);
                              setPlanForm(prev => ({ 
                                ...prev, 
                                priceInTokens: tokens,
                                price: isNaN(usdPrice) ? '' : usdPrice
                              }));
                            }}
                            placeholder="200"
                            min="1"
                            step="1"
                            disabled={showEditModal}
                            className="w-full pr-20 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed"
                          />
                          <span className="absolute right-3 top-3 text-purple-600 dark:text-purple-400 font-medium">tokens</span>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          ≈ ${planForm.price || '0.00'} USD
                        </p>
                        {showEditModal && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Price cannot be changed after creation
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Billing Interval <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={planForm.billingInterval}
                          onChange={(e) => setPlanForm(prev => ({ ...prev, billingInterval: e.target.value }))}
                          disabled={showEditModal}
                          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed"
                        >
                          <option value="month">Monthly</option>
                          <option value="year">Yearly</option>
                        </select>
                        {showEditModal && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Billing interval cannot be changed
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Features */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Features <span className="text-red-500">*</span>
                    </label>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                      List the features and benefits subscribers will receive
                    </p>
                    <div className="space-y-2">
                      {planForm.features.map((feature, index) => (
                        <div key={index} className="flex gap-2">
                          <input
                            type="text"
                            value={feature}
                            onChange={(e) => updateFeature(index, e.target.value)}
                            placeholder="e.g., Access to exclusive content"
                            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          />
                          {planForm.features.length > 1 && (
                            <button
                              onClick={() => removeFeature(index)}
                              className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            >
                              <TrashIcon className="w-5 h-5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={addFeature}
                      className="mt-2 text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-medium"
                    >
                      + Add Feature
                    </button>
                  </div>

                  {/* Perks (Optional) */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Special Perks (Optional)
                    </label>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                      Additional perks like discounts, early access, etc.
                    </p>
                    <div className="space-y-2">
                      {planForm.perks.map((perk, index) => (
                        <div key={index} className="flex gap-2">
                          <input
                            type="text"
                            value={perk}
                            onChange={(e) => updatePerk(index, e.target.value)}
                            placeholder="e.g., 10% discount on merchandise"
                            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          />
                          <button
                            onClick={() => removePerk(index)}
                            className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          >
                            <TrashIcon className="w-5 h-5" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={addPerk}
                      className="mt-2 text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-medium"
                    >
                      + Add Perk
                    </button>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 mt-8">
                  <button
                    onClick={() => {
                      setShowCreateModal(false);
                      setShowEditModal(false);
                      setSelectedPlan(null);
                      resetForm();
                    }}
                    className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={showEditModal ? handleUpdatePlan : handleCreatePlan}
                    disabled={loading || !planForm.name || !planForm.description || (!showEditModal && !planForm.priceInTokens)}
                    className="flex-1 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        {showEditModal ? 'Updating...' : 'Creating...'}
                      </div>
                    ) : (
                      showEditModal ? 'Update Plan' : 'Create Plan'
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CreatorSubscriptionManagement;