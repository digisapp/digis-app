import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '../hooks/useTheme';
import {
  CheckIcon,
  CreditCardIcon,
  CurrencyDollarIcon,
  SparklesIcon,
  ShieldCheckIcon,
  ChatBubbleLeftRightIcon,
  VideoCameraIcon,
  BoltIcon
} from '@heroicons/react/24/outline';
import Button from './ui/Button';
import Card from './ui/Card';
import Modal from './ui/Modal';
import Badge from './ui/Badge';

const CreatorSubscriptions = ({
  user,
  creator,
  isOpen = true, // Default to true for standalone page
  onClose,
  onSubscribe,
  isCreator = false,
  tokenBalance = 0,
  onTokenUpdate,
  className = ''
}) => {
  const { animations } = useTheme();
  const [subscriptionTiers, setSubscriptionTiers] = useState([]);
  const [userSubscription, setUserSubscription] = useState(null);
  const [selectedTier, setSelectedTier] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('tokens');
  const [loading, setLoading] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [userBalance, setUserBalance] = useState(tokenBalance || 0);
  const [subscribers, setSubscribers] = useState([]);
  const [activeTab, setActiveTab] = useState(isCreator ? 'manage' : 'browse');

  const fetchSubscriptionTiers = useCallback(async () => {
    try {
      const response = await fetch('/api/subscriptions/tiers', {
        headers: {
          'Authorization': `Bearer ${user.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSubscriptionTiers(data.tiers);
      }
    } catch (error) {
      console.error('Error fetching subscription tiers:', error);
    }
  }, [user.accessToken]);

  const fetchUserSubscription = useCallback(async () => {
    if (!creator?.id) return;

    try {
      const response = await fetch(`/api/subscriptions/status/${creator.id}`, {
        headers: {
          'Authorization': `Bearer ${user.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setUserSubscription(data.subscribed ? data : null);
      }
    } catch (error) {
      console.error('Error fetching user subscription:', error);
    }
  }, [creator?.id, user.accessToken]);

  const fetchUserBalance = useCallback(async () => {
    try {
      const response = await fetch('/api/users/profile', {
        headers: {
          'Authorization': `Bearer ${user.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setUserBalance(data.user.token_balance || 0);
      }
    } catch (error) {
      console.error('Error fetching user balance:', error);
    }
  }, [user.accessToken]);

  useEffect(() => {
    if (isOpen) {
      fetchSubscriptionTiers();
      fetchUserSubscription();
      fetchUserBalance();
    }
  }, [isOpen, creator, fetchSubscriptionTiers, fetchUserSubscription, fetchUserBalance]);

  const handleSubscribe = async () => {
    if (!selectedTier) return;

    setLoading(true);
    try {
      const response = await fetch('/api/subscriptions/subscribe', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          creatorId: creator.id,
          tier: selectedTier.id,
          paymentMethod
        })
      });

      if (response.ok) {
        const data = await response.json();
        setUserSubscription({
          subscribed: true,
          tier: selectedTier.id,
          tier_config: selectedTier,
          expires_at: data.subscription.expires_at,
          subscription_id: data.subscription.id
        });
        
        // Update user balance if paid with tokens
        if (paymentMethod === 'tokens') {
          setUserBalance(prev => prev - selectedTier.token_cost);
        }

        onSubscribe?.(data.subscription);
        setShowConfirmation(false);
        setSelectedTier(null);
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to subscribe');
      }
    } catch (error) {
      console.error('Error subscribing:', error);
      alert('Failed to subscribe');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!userSubscription?.subscription_id) return;

    setLoading(true);
    try {
      const response = await fetch('/api/subscriptions/cancel', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          subscriptionId: userSubscription.subscription_id
        })
      });

      if (response.ok) {
        setUserSubscription(null);
        alert('Subscription cancelled successfully');
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to cancel subscription');
      }
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      alert('Failed to cancel subscription');
    } finally {
      setLoading(false);
    }
  };


  const getBenefitIcon = (benefit) => {
    if (benefit.includes('badge')) return <ShieldCheckIcon className="w-4 h-4" />;
    if (benefit.includes('chat')) return <ChatBubbleLeftRightIcon className="w-4 h-4" />;
    if (benefit.includes('stream') || benefit.includes('session')) return <VideoCameraIcon className="w-4 h-4" />;
    if (benefit.includes('early') || benefit.includes('priority')) return <BoltIcon className="w-4 h-4" />;
    return <CheckIcon className="w-4 h-4" />;
  };

  const SubscriptionTierCard = ({ tier }) => {
    const isCurrentTier = userSubscription?.tier === tier.id;
    const isSelected = selectedTier?.id === tier.id;
    const canAfford = paymentMethod === 'tokens' ? userBalance >= tier.token_cost : true;

    return (
      <motion.div
        initial={animations ? { opacity: 0, y: 20 } : {}}
        animate={animations ? { opacity: 1, y: 0 } : {}}
        whileHover={animations ? { y: -5 } : {}}
        className={`relative ${isCurrentTier ? 'ring-2 ring-primary-500' : ''}`}
      >
        <Card className={`p-6 h-full ${isSelected ? 'ring-2 ring-primary-500' : 'hover:shadow-lg'} transition-all duration-300`}>
          {isCurrentTier && (
            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
              <Badge variant="success" className="px-3 py-1">
                Current Plan
              </Badge>
            </div>
          )}

          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4" 
                 style={{ backgroundColor: `${tier.badge_color}20`, color: tier.badge_color }}>
              <span className="text-2xl">{tier.badge_emoji}</span>
            </div>
            
            <h3 className="text-xl font-bold mb-2">{tier.name}</h3>
            <p className="text-neutral-600 dark:text-neutral-400 text-sm mb-4">
              {tier.description}
            </p>

            <div className="flex items-center justify-center gap-4 mb-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                  {tier.token_cost}
                </div>
                <div className="text-xs text-neutral-500">tokens/month</div>
              </div>
              <div className="text-neutral-400">or</div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  ${tier.usd_cost}
                </div>
                <div className="text-xs text-neutral-500">USD/month</div>
              </div>
            </div>
          </div>

          <div className="space-y-3 mb-6">
            {tier.benefits.map((benefit, index) => (
              <div key={index} className="flex items-start gap-3">
                <div className="text-green-500 mt-0.5">
                  {getBenefitIcon(benefit)}
                </div>
                <span className="text-sm">{benefit}</span>
              </div>
            ))}
          </div>

          <div className="mt-auto">
            {isCurrentTier ? (
              <div className="space-y-2">
                <div className="text-center text-sm text-neutral-600 dark:text-neutral-400">
                  Expires: {new Date(userSubscription.expires_at).toLocaleDateString()}
                </div>
                <Button
                  variant="outline"
                  fullWidth
                  onClick={handleCancelSubscription}
                  loading={loading}
                >
                  Cancel Subscription
                </Button>
              </div>
            ) : (
              <Button
                fullWidth
                variant={isSelected ? 'primary' : 'outline'}
                onClick={() => {
                  setSelectedTier(tier);
                  setShowConfirmation(true);
                }}
                disabled={userSubscription?.subscribed}
                className={!canAfford && paymentMethod === 'tokens' ? 'opacity-50' : ''}
              >
                {userSubscription?.subscribed ? 'Already Subscribed' : 'Select Plan'}
              </Button>
            )}
          </div>
        </Card>
      </motion.div>
    );
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-r from-primary-400 to-secondary-400 flex items-center justify-center text-white font-semibold">
              {creator?.name?.[0]?.toUpperCase() || 'C'}
            </div>
            <div>
              <h2 className="text-xl font-bold">Subscribe to {creator?.name}</h2>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                Get exclusive access and support your favorite creator
              </p>
            </div>
          </div>
        }
        className={`max-w-6xl ${className}`}
      >
        <div className="space-y-6">
          {/* Payment Method Selection */}
          <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <CreditCardIcon className="w-5 h-5" />
              Payment Method
            </h3>
            <div className="flex gap-3">
              <Button
                size="sm"
                variant={paymentMethod === 'tokens' ? 'primary' : 'outline'}
                onClick={() => setPaymentMethod('tokens')}
                icon={<SparklesIcon className="w-4 h-4" />}
              >
                Tokens ({userBalance} available)
              </Button>
              <Button
                size="sm"
                variant={paymentMethod === 'usd' ? 'primary' : 'outline'}
                onClick={() => setPaymentMethod('usd')}
                icon={<CurrencyDollarIcon className="w-4 h-4" />}
              >
                Credit Card
              </Button>
            </div>
          </div>

          {/* Subscription Tiers */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Object.values(subscriptionTiers).map((tier) => (
              <SubscriptionTierCard key={tier.id} tier={tier} />
            ))}
          </div>

          {/* Subscription Benefits */}
          <div className="bg-gradient-to-r from-primary-50 to-secondary-50 dark:from-primary-900/20 dark:to-secondary-900/20 rounded-lg p-6">
            <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
              <SparklesIcon className="w-5 h-5 text-primary-500" />
              Why Subscribe?
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="flex items-start gap-3">
                <ShieldCheckIcon className="w-5 h-5 text-primary-500 mt-0.5" />
                <div>
                  <div className="font-medium">Exclusive Content</div>
                  <div className="text-neutral-600 dark:text-neutral-400">
                    Access subscriber-only streams and content
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <ChatBubbleLeftRightIcon className="w-5 h-5 text-primary-500 mt-0.5" />
                <div>
                  <div className="font-medium">Special Chat Privileges</div>
                  <div className="text-neutral-600 dark:text-neutral-400">
                    Stand out with badges and priority messages
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <VideoCameraIcon className="w-5 h-5 text-primary-500 mt-0.5" />
                <div>
                  <div className="font-medium">Direct Access</div>
                  <div className="text-neutral-600 dark:text-neutral-400">
                    Private sessions and direct messaging
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <BoltIcon className="w-5 h-5 text-primary-500 mt-0.5" />
                <div>
                  <div className="font-medium">Early Access</div>
                  <div className="text-neutral-600 dark:text-neutral-400">
                    Be first to try new features and content
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* Confirmation Modal */}
      <Modal
        isOpen={showConfirmation}
        onClose={() => setShowConfirmation(false)}
        title="Confirm Subscription"
        className="max-w-md"
      >
        {selectedTier && (
          <div className="space-y-4">
            <div className="text-center p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
              <div className="text-3xl mb-2">{selectedTier.badge_emoji}</div>
              <h3 className="font-semibold text-lg">{selectedTier.name}</h3>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">
                {selectedTier.description}
              </p>
              <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                {paymentMethod === 'tokens' 
                  ? `${selectedTier.token_cost} tokens` 
                  : `$${selectedTier.usd_cost} USD`
                }
              </div>
              <div className="text-sm text-neutral-500">per month</div>
            </div>

            {paymentMethod === 'tokens' && userBalance < selectedTier.token_cost && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400">
                  Insufficient token balance. You need {selectedTier.token_cost - userBalance} more tokens.
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                variant="outline"
                fullWidth
                onClick={() => setShowConfirmation(false)}
              >
                Cancel
              </Button>
              <Button
                fullWidth
                onClick={handleSubscribe}
                loading={loading}
                disabled={paymentMethod === 'tokens' && userBalance < selectedTier.token_cost}
              >
                Subscribe Now
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
};

export default CreatorSubscriptions;