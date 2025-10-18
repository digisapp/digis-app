/**
 * Hook for managing stream monetization
 * @module hooks/useStreamMonetization
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '../../../utils/supabase-auth';
import toast from 'react-hot-toast';

/**
 * Manages tips, gifts, and subscriptions for streams
 */
export const useStreamMonetization = (streamId, user) => {
  const [totalEarnings, setTotalEarnings] = useState({
    tips: 0,
    gifts: 0,
    subscriptions: 0,
    total: 0
  });
  
  const [recentTips, setRecentTips] = useState([]);
  const [recentGifts, setRecentGifts] = useState([]);
  const [topSupporters, setTopSupporters] = useState([]);
  const [subscriptionCount, setSubscriptionCount] = useState(0);
  
  const supportersMap = useRef(new Map());

  /**
   * Process a tip
   */
  const processTip = useCallback(async (amount, message, sender) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/streaming/tip`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          streamId,
          amount,
          message,
          senderId: sender.id,
          senderName: sender.name
        })
      });

      if (!response.ok) throw new Error('Failed to process tip');

      const tip = await response.json();
      
      // Update state
      setTotalEarnings(prev => ({
        ...prev,
        tips: prev.tips + amount,
        total: prev.total + amount
      }));
      
      // Add to recent tips
      setRecentTips(prev => [tip, ...prev].slice(0, 10));
      
      // Update top supporters
      updateTopSupporters(sender.id, sender.name, amount);
      
      return tip;
    } catch (error) {
      console.error('Error processing tip:', error);
      toast.error('Failed to send tip');
      throw error;
    }
  }, [streamId]);

  /**
   * Process a gift
   */
  const processGift = useCallback(async (gift, sender) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/streaming/gift`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          streamId,
          giftId: gift.id,
          giftName: gift.name,
          giftValue: gift.value,
          senderId: sender.id,
          senderName: sender.name
        })
      });

      if (!response.ok) throw new Error('Failed to process gift');

      const processedGift = await response.json();
      
      // Update state
      setTotalEarnings(prev => ({
        ...prev,
        gifts: prev.gifts + gift.value,
        total: prev.total + gift.value
      }));
      
      // Add to recent gifts
      setRecentGifts(prev => [processedGift, ...prev].slice(0, 10));
      
      // Update top supporters
      updateTopSupporters(sender.id, sender.name, gift.value);
      
      return processedGift;
    } catch (error) {
      console.error('Error processing gift:', error);
      toast.error('Failed to send gift');
      throw error;
    }
  }, [streamId]);

  /**
   * Process a subscription
   */
  const processSubscription = useCallback(async (tier, subscriber) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/streaming/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          streamId,
          creatorId: user.id,
          tier,
          subscriberId: subscriber.id,
          subscriberName: subscriber.name
        })
      });

      if (!response.ok) throw new Error('Failed to process subscription');

      const subscription = await response.json();
      
      // Update state
      const tierValue = tier === 'premium' ? 100 : tier === 'vip' ? 50 : 25;
      setTotalEarnings(prev => ({
        ...prev,
        subscriptions: prev.subscriptions + tierValue,
        total: prev.total + tierValue
      }));
      
      setSubscriptionCount(prev => prev + 1);
      
      // Update top supporters
      updateTopSupporters(subscriber.id, subscriber.name, tierValue);
      
      return subscription;
    } catch (error) {
      console.error('Error processing subscription:', error);
      toast.error('Failed to subscribe');
      throw error;
    }
  }, [streamId, user.id]);

  /**
   * Update top supporters list
   */
  const updateTopSupporters = useCallback((userId, userName, amount) => {
    const current = supportersMap.current.get(userId) || { 
      id: userId, 
      name: userName, 
      total: 0 
    };
    
    current.total += amount;
    supportersMap.current.set(userId, current);
    
    // Convert to array and sort
    const supporters = Array.from(supportersMap.current.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
    
    setTopSupporters(supporters);
  }, []);

  /**
   * Get formatted earnings display
   */
  const getFormattedEarnings = useCallback(() => {
    return {
      tips: `${totalEarnings.tips} tokens`,
      gifts: `${totalEarnings.gifts} tokens`,
      subscriptions: `${totalEarnings.subscriptions} tokens`,
      total: `${totalEarnings.total} tokens`,
      usd: `$${(totalEarnings.total * 0.05).toFixed(2)}`
    };
  }, [totalEarnings]);

  /**
   * Load existing earnings for the stream
   */
  useEffect(() => {
    if (!streamId) return;

    const loadEarnings = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const response = await fetch(
          `${import.meta.env.VITE_BACKEND_URL}/streaming/earnings/${streamId}`,
          {
            headers: {
              'Authorization': `Bearer ${session?.access_token}`
            }
          }
        );

        if (response.ok) {
          const data = await response.json();
          setTotalEarnings(data.earnings);
          setTopSupporters(data.topSupporters || []);
          setSubscriptionCount(data.subscriptionCount || 0);
        }
      } catch (error) {
        console.error('Error loading earnings:', error);
      }
    };

    loadEarnings();
  }, [streamId]);

  /**
   * Clear monetization data
   */
  const clearMonetization = useCallback(() => {
    setTotalEarnings({ tips: 0, gifts: 0, subscriptions: 0, total: 0 });
    setRecentTips([]);
    setRecentGifts([]);
    setTopSupporters([]);
    setSubscriptionCount(0);
    supportersMap.current.clear();
  }, []);

  return {
    // State
    totalEarnings,
    formattedEarnings: getFormattedEarnings(),
    recentTips,
    recentGifts,
    topSupporters,
    subscriptionCount,
    
    // Methods
    processTip,
    processGift,
    processSubscription,
    clearMonetization
  };
};

export default useStreamMonetization;