import React, { useState, useEffect, useCallback, memo, useMemo, useRef } from 'react';
import { supabase } from '../utils/supabase-auth.js';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import MobileTokenPurchase from './mobile/MobileTokenPurchase';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { useOpenBuyTokens } from '../utils/openBuyTokens';
import { useAuth } from '../contexts/AuthContext';
import {
  TOKEN_PAYOUT_USD_PER_TOKEN,
  TOKEN_USD_FORMAT,
  TOKEN_PURCHASE_PACKS,
  validatePurchasePacks,
  estimatePayoutUsd,
  formatUsd
} from '../config/wallet-config';
import { 
  CalendarIcon,
  ChartBarIcon,
  CurrencyDollarIcon,
  VideoCameraIcon,
  PhoneIcon,
  ChatBubbleLeftRightIcon,
  GiftIcon,
  UsersIcon,
  DocumentTextIcon,
  SignalIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  WalletIcon,
  FilmIcon
} from '@heroicons/react/24/outline';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart
} from 'recharts';

// Memoized chart components for better performance
const MemoizedAreaChart = memo(({ data }) => (
  <ResponsiveContainer width="100%" height="100%">
    <AreaChart data={data}>
      <defs>
        <linearGradient id="colorEarnings" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor="#9333ea" stopOpacity={0.8}/>
          <stop offset="95%" stopColor="#9333ea" stopOpacity={0.1}/>
        </linearGradient>
      </defs>
      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
      <XAxis 
        dataKey="date" 
        stroke="#6b7280" 
        tick={{ fontSize: 12 }}
      />
      <YAxis 
        stroke="#6b7280" 
        tick={{ fontSize: 12 }}
        tickFormatter={(value) => `$${value}`}
      />
      <Tooltip />
      <Area 
        type="monotone" 
        dataKey="amount" 
        stroke="#9333ea" 
        strokeWidth={2}
        fillOpacity={1} 
        fill="url(#colorEarnings)" 
      />
    </AreaChart>
  </ResponsiveContainer>
));

const MemoizedBarChart = memo(({ data }) => (
  <ResponsiveContainer width="100%" height="100%">
    <BarChart data={data}>
      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
      <XAxis dataKey="name" stroke="#6b7280" tick={{ fontSize: 11 }} />
      <YAxis stroke="#6b7280" tick={{ fontSize: 11 }} />
      <Tooltip />
      <Bar dataKey="value" radius={[8, 8, 0, 0]} fill="#9333ea" />
    </BarChart>
  </ResponsiveContainer>
));

// Lazy-in-view chart wrapper using Intersection Observer for performance
const ChartWhenVisible = ({ children, fallback = null }) => {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '100px' }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="h-full w-full">
      {isVisible ? children : fallback || (
        <div className="h-full flex items-center justify-center text-gray-500">
          <p>Loading chart...</p>
        </div>
      )}
    </div>
  );
};

// Collapsible card component for mobile
const CollapsibleCard = ({ title, icon: Icon, children, defaultOpen = true }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 md:px-6 md:py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {Icon && <Icon className="w-5 h-5 text-gray-600 dark:text-gray-400" />}
          <h3 className="text-base md:text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
        </div>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDownIcon className="w-5 h-5 text-gray-400" />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="px-4 py-3 md:px-6 md:py-4 border-t border-gray-100 dark:border-gray-700">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Skeleton loader component
const EarningsCardSkeleton = () => (
  <div className="animate-pulse">
    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-2"></div>
    <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-1"></div>
    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
  </div>
);

// Main component
const WalletOptimized = ({ user, tokenBalance, onTokenUpdate, onViewProfile, onTokenPurchase, isCreator, isAdmin, setCurrentView }) => {
  // Auth state - gate data fetches behind auth resolution to prevent API hammering during bootstrap
  const { authLoading, roleResolved } = useAuth();
  const authReady = !authLoading && roleResolved;

  const isMobile = useMediaQuery('(max-width: 768px)');
  const openBuyTokens = useOpenBuyTokens();
  const [showMobileTokenPurchase, setShowMobileTokenPurchase] = useState(false);
  const [walletData, setWalletData] = useState({ tokens: 0, total_balance: 0 });
  const [earningsData, setEarningsData] = useState(null);
  const [dateRange, setDateRange] = useState('month');
  const [loading, setLoading] = useState(true);
  const [chartsLoaded, setChartsLoaded] = useState(false);

  // Creator payout intent (Release Funds) state
  const [releaseIntent, setReleaseIntent] = useState(null);
  const [intentLoading, setIntentLoading] = useState(false);

  // Purchase flow state (prevent double-tap)
  const [startingPurchase, setStartingPurchase] = useState(false);

  // Cache for API responses
  const [cache, setCache] = useState({});

  // Common backend + auth helpers
  const BACKEND = import.meta.env.VITE_BACKEND_URL;

  const getAuthToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || '';
  };

  // Fetch functions with caching
  const fetchWithCache = useCallback(async (key, fetchFn) => {
    if (cache[key] && Date.now() - cache[key].timestamp < 60000) { // 1 minute cache
      return cache[key].data;
    }

    const data = await fetchFn();
    setCache(prev => ({
      ...prev,
      [key]: { data, timestamp: Date.now() }
    }));
    return data;
  }, [cache]);

  const fetchWalletData = useCallback(async () => {
    try {
      const data = await fetchWithCache('wallet', async () => {
        const { data: { session } } = await supabase.auth.getSession();
        const authToken = session?.access_token;
        const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/wallet`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (response.ok) {
          return await response.json();
        }
        return { tokens: tokenBalance || 0, total_balance: tokenBalance || 0 };
      });
      setWalletData(data);
    } catch (error) {
      console.error('Error fetching wallet data:', error);
      setWalletData({ tokens: tokenBalance || 0, total_balance: tokenBalance || 0 });
    } finally {
      setLoading(false);
    }
  }, [tokenBalance, fetchWithCache]);

  const fetchEarningsData = useCallback(async () => {
    if (!isCreator) return;
    
    try {
      const data = await fetchWithCache(`earnings-${dateRange}`, async () => {
        const { data: { session } } = await supabase.auth.getSession();
        const authToken = session?.access_token;
        const response = await fetch(
          `${import.meta.env.VITE_BACKEND_URL}/api/earnings/analytics?period=${dateRange}`,
          { headers: { 'Authorization': `Bearer ${authToken}` } }
        );
        
        if (response.ok) {
          const data = await response.json();
          return {
            totalEarnings: data.summary.totalEarnings || 0,
            monthlyEarnings: data.periodEarnings.month || 0,
            todayEarnings: data.periodEarnings.today || 0,
            yesterdayEarnings: data.periodEarnings.yesterday || 0,
            weeklyEarnings: data.periodEarnings.week || 0,
            dailyEarnings: (data.dailyEarnings || []).map(item => ({
              date: new Date(item.date).getDate(),
              amount: item.amount
            })),
            breakdown: {
              tips: data.breakdown.tips || 0,
              subscriptions: data.breakdown.subscriptions || 0,
              content: data.breakdown.content || 0,
              messages: data.breakdown.messages || 0,
              liveStreams: data.breakdown.recordings || 0,
              videoCalls: data.breakdown.videoCalls || 0,
              voiceCalls: data.breakdown.voiceCalls || 0,
              gifts: data.breakdown.gifts || 0,
              vod: data.breakdown.vod || 0
            }
          };
        }
        return null;
      });
      setEarningsData(data);
    } catch (error) {
      console.error('Error fetching earnings data:', error);
    }
  }, [isCreator, dateRange, fetchWithCache]);

  // GATED behind auth resolution - prevent API hammering during bootstrap
  useEffect(() => {
    if (!authReady) {
      console.log('⏳ WalletOptimized: Waiting for auth to resolve before fetching wallet data');
      return;
    }

    console.log('✅ WalletOptimized: Auth ready, fetching wallet data');
    fetchWalletData();

    // Log telemetry: wallet viewed
    console.log('[wallet_telemetry] wallet_viewed', {
      role: isCreator ? 'creator' : 'fan',
      device: isMobile ? 'mobile' : 'desktop'
    });
  }, [fetchWalletData, isCreator, isMobile, authReady]); // Only fetch when auth is ready

  useEffect(() => {
    if (!authReady) {
      return;
    }
    if (isCreator) {
      fetchEarningsData();
    }
  }, [isCreator, fetchEarningsData, authReady]); // Only fetch when auth is ready

  // Fetch current release intent for the next cycle (if creator)
  const fetchReleaseIntent = useCallback(async () => {
    if (!isCreator) return;
    try {
      const token = await getAuthToken();
      const r = await fetch(`${BACKEND}/api/creator-payouts/intent`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const j = await r.json();
      if (j.ok) setReleaseIntent(j.intent ?? null);
    } catch (e) {
      console.warn('fetchReleaseIntent failed', e);
    }
  }, [isCreator, BACKEND]);

  useEffect(() => {
    if (!authReady) {
      return;
    }
    fetchReleaseIntent();
  }, [fetchReleaseIntent, authReady]); // Only fetch when auth is ready

  // Lazy load charts after initial render
  useEffect(() => {
    const timer = setTimeout(() => setChartsLoaded(true), 500);
    return () => clearTimeout(timer);
  }, []);

  // Unified purchase success handler (optimistic + server refresh)
  const onTokensPurchased = useCallback((tokensAdded) => {
    if (!tokensAdded || Number.isNaN(tokensAdded)) return;
    // Optimistic update
    setWalletData((prev) => ({ ...prev, tokens: (prev?.tokens || 0) + tokensAdded }));
    // Then refresh from server
    fetchWalletData().catch(() => {
      // Keep optimistic value on error; user still sees update
    });
  }, [fetchWalletData]);

  // Unified purchase handler with double-tap protection
  const handlePurchaseClick = useCallback(async (packInfo = null) => {
    if (startingPurchase) return; // Prevent double-tap

    try {
      setStartingPurchase(true);

      // Log telemetry
      if (packInfo) {
        console.log('[wallet_telemetry] token_pack_selected', {
          pack: packInfo.tokens,
          price: packInfo.priceUsd,
          perToken: (packInfo.priceUsd / packInfo.tokens).toFixed(3),
          role: isCreator ? 'creator' : 'fan'
        });
      }
      console.log('[wallet_telemetry] token_purchase_started', {
        type: packInfo ? 'pack' : 'custom',
        role: isCreator ? 'creator' : 'fan'
      });

      openBuyTokens({
        onSuccess: (tokensAdded) => {
          setStartingPurchase(false);
          onTokensPurchased(tokensAdded);
          if (onTokenUpdate) {
            onTokenUpdate(tokensAdded);
          }

          // Standardized success toast
          const newBalance = (walletData?.tokens || 0) + tokensAdded;
          toast.success(`+${tokensAdded.toLocaleString()} tokens added! New balance: ${newBalance.toLocaleString()}`);

          // Log success telemetry
          console.log('[wallet_telemetry] token_purchase_succeeded', {
            tokensAdded,
            balanceAfter: newBalance,
            role: isCreator ? 'creator' : 'fan'
          });
        },
        onError: (error) => {
          setStartingPurchase(false);
          // Standardized error toast
          toast.error('Unable to complete purchase. Please check your payment method and try again.');

          // Log failure telemetry
          console.error('[wallet_telemetry] token_purchase_failed', {
            error: error?.message || 'unknown',
            error_code: error?.code || 'unknown',
            role: isCreator ? 'creator' : 'fan'
          });
        },
        onClose: () => {
          setStartingPurchase(false);
        }
      });
    } catch (error) {
      setStartingPurchase(false);
      toast.error('Could not start purchase. Please refresh the page and try again.');
      console.error('[wallet_telemetry] token_purchase_failed', {
        error: error?.message || 'unknown',
        error_code: 'start_failed',
        role: isCreator ? 'creator' : 'fan'
      });
    }
  }, [startingPurchase, isCreator, openBuyTokens, onTokensPurchased, onTokenUpdate, walletData]);

  const formatTokensAsUsd = useCallback((tokens) => {
    return TOKEN_USD_FORMAT.format(tokens * TOKEN_PAYOUT_USD_PER_TOKEN);
  }, []);

  const formatTokens = useCallback((tokens) => {
    return tokens.toLocaleString();
  }, []);

  // Click handlers for payout actions
  const handleReleaseFunds = async () => {
    try {
      setIntentLoading(true);
      const token = await getAuthToken();
      const r = await fetch(`${BACKEND}/api/creator-payouts/intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
      });
      const j = await r.json();
      if (j.ok) {
        setReleaseIntent(j.intent);
        toast.success('You\'re queued for the next payout.');
      } else {
        toast.error(j.error || 'Unable to set release intent.');
      }
    } catch (e) {
      toast.error('Unable to set release intent.');
    } finally {
      setIntentLoading(false);
    }
  };

  const handleCancelRelease = async () => {
    try {
      setIntentLoading(true);
      const token = await getAuthToken();
      const r = await fetch(`${BACKEND}/api/creator-payouts/intent`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const j = await r.json();
      if (j.ok) {
        setReleaseIntent(j.intent || null);
        toast('Release canceled for upcoming cycle');
      } else {
        toast.error(j.error || 'Unable to cancel release.');
      }
    } catch (e) {
      toast.error('Unable to cancel release.');
    } finally {
      setIntentLoading(false);
    }
  };

  // Stripe account link → manage banking
  const openStripeAccountLink = async () => {
    try {
      const token = await getAuthToken();
      const r = await fetch(`${BACKEND}/api/stripe/account-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          refresh_url: window.location.href,
          return_url: window.location.href
        })
      });
      const j = await r.json();
      if (j.url) {
        window.location.assign(j.url);
      } else {
        throw new Error(j.error || 'No account link returned');
      }
    } catch (e) {
      console.error('openStripeAccountLink error', e);
      toast.error('Unable to open banking settings. Please try again.');
    }
  };

  // Memoize chart data
  const chartData = useMemo(() => {
    if (!earningsData) return { daily: [], breakdown: [] };
    
    return {
      daily: earningsData.dailyEarnings || [],
      breakdown: [
        { name: 'Tips', value: earningsData.breakdown.tips },
        { name: 'Gifts', value: earningsData.breakdown.gifts },
        { name: 'Video', value: earningsData.breakdown.videoCalls },
        { name: 'Voice', value: earningsData.breakdown.voiceCalls },
        { name: 'VOD', value: earningsData.breakdown.vod || 0 },
        { name: 'Content', value: earningsData.breakdown.content },
        { name: 'Streams', value: earningsData.breakdown.liveStreams }
      ].filter(item => item.value > 0)
    };
  }, [earningsData]);

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Balance skeleton */}
        <div className="bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl p-6 animate-pulse">
          <div className="h-4 bg-white/20 rounded w-32 mb-2"></div>
          <div className="h-8 bg-white/20 rounded w-40 mb-1"></div>
          <div className="h-3 bg-white/20 rounded w-24"></div>
        </div>
        
        {/* Cards skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-6 animate-pulse">
              <EarningsCardSkeleton />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Fan view - Show token balance and purchase options
  if (!isCreator) {
    return (
      <div className="space-y-6">
        {/* Token Balance Card */}
        <div className="bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-2xl p-6 md:p-8 shadow-2xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl md:text-2xl font-bold mb-3 md:mb-4">Your Token Balance</h2>
              <div className="flex items-baseline gap-3">
                <span className="text-4xl md:text-5xl font-bold">{walletData.tokens.toLocaleString()}</span>
                <span className="text-lg md:text-xl opacity-90">tokens</span>
              </div>
              <p className="text-base md:text-lg opacity-75 mt-2">≈ {formatTokensAsUsd(walletData.tokens)}</p>
            </div>
            <WalletIcon className="w-16 h-16 md:w-20 md:h-20 opacity-20" />
          </div>

          {/* Primary CTA - Prominent above the fold */}
          <button
            onClick={() => handlePurchaseClick()}
            disabled={startingPurchase}
            aria-label="Buy tokens - primary action"
            className={`w-full bg-white text-purple-600 hover:bg-gray-50 active:bg-gray-100 px-6 py-4 rounded-xl font-bold text-lg transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center gap-3 ${
              startingPurchase ? 'opacity-60 cursor-not-allowed' : ''
            }`}
          >
            <CurrencyDollarIcon className="w-6 h-6" />
            {startingPurchase ? 'Opening Purchase...' : 'Buy Tokens'}
          </button>
        </div>

        {/* Quick Purchase Packs - Secondary Options */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
          <h3 className="text-base md:text-lg font-semibold mb-4 text-gray-900 dark:text-white">Quick Buy Packs</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {(() => {
              const validPacks = validatePurchasePacks(TOKEN_PURCHASE_PACKS) ? TOKEN_PURCHASE_PACKS : [];
              if (!validPacks.length) {
                console.error('Invalid TOKEN_PURCHASE_PACKS config');
                return (
                  <div className="col-span-full text-center py-6 text-gray-500 dark:text-gray-400">
                    Unable to load purchase options. Please contact support.
                  </div>
                );
              }
              return validPacks.map((pack) => {
                const costPerToken = pack.priceUsd / pack.tokens;
                return (
                  <button
                    key={pack.tokens}
                    onClick={() => handlePurchaseClick(pack)}
                    disabled={startingPurchase}
                    aria-label={`Buy ${pack.tokens.toLocaleString()} tokens for $${pack.priceUsd}`}
                    className={`p-4 border-2 border-gray-200 dark:border-gray-700 rounded-xl hover:border-purple-500 dark:hover:border-purple-400 transition-all group hover:shadow-lg ${
                      startingPurchase ? 'opacity-60 cursor-not-allowed' : ''
                    }`}
                  >
                    <div className="text-2xl font-bold text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400">
                      {pack.tokens.toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">tokens</div>
                    <div className="text-lg font-semibold text-purple-600 dark:text-purple-400 mt-2">
                      ${pack.priceUsd}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      ~${costPerToken.toFixed(2)}/token
                    </div>
                  </button>
                );
              });
            })()}
          </div>
          <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-4">
            Or use the "Buy Tokens" button above for custom amounts
          </p>
        </div>

        {/* Recent Transactions - With Empty State */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Recent Activity</h3>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/20 rounded-full flex items-center justify-center mb-4">
              <CurrencyDollarIcon className="w-8 h-8 text-purple-600 dark:text-purple-400" />
            </div>
            <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
              No transactions yet
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs">
              Your token purchases and spending will appear here. Buy tokens to start connecting with creators!
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Creator view
  return (
    <div className="space-y-6">
      {/* Balance Card with Buy Tokens Button */}
      <div className="bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl p-5 md:p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h3 className="text-sm md:text-base font-medium opacity-90 mb-1">Available Balance</h3>
            <div className="text-3xl md:text-4xl font-bold">{formatTokens(walletData.tokens)}</div>
            <div className="text-xs md:text-sm opacity-75 mt-1">{formatTokensAsUsd(walletData.tokens)} USD</div>
            <button
              onClick={() => handlePurchaseClick()}
              disabled={startingPurchase}
              aria-label="Buy tokens"
              className={`mt-3 bg-white/20 hover:bg-white/30 backdrop-blur px-4 py-2 rounded-lg transition-all duration-200 flex items-center gap-2 text-sm font-medium ${
                startingPurchase ? 'opacity-60 cursor-not-allowed' : ''
              }`}
            >
              <CurrencyDollarIcon className="w-4 h-4" />
              {startingPurchase ? 'Opening...' : 'Buy Tokens'}
            </button>
          </div>
          <WalletIcon className="w-10 h-10 md:w-12 md:h-12 text-white/20" />
        </div>
      </div>

      {/* Creator: Payouts & Banking */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Payouts & Banking</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Control your twice-monthly payouts and update your banking details via Stripe.
            </p>
            <div className="mt-2 text-xs text-purple-600 dark:text-purple-400 font-medium">
              Payout rate: {formatUsd(TOKEN_PAYOUT_USD_PER_TOKEN)} per token
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {/* Manage Banking (Stripe) */}
            <button
              onClick={openStripeAccountLink}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              aria-label="Manage banking and payouts"
            >
              Manage Banking &amp; Payouts
            </button>

            {/* Release Funds intent */}
            {releaseIntent?.status === 'pending' ? (
              <button
                onClick={handleCancelRelease}
                disabled={intentLoading}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-amber-500 hover:bg-amber-600 text-white transition disabled:opacity-60"
                aria-label="Cancel release funds"
              >
                {intentLoading ? 'Processing...' : 'Cancel Release (Queued)'}
              </button>
            ) : (
              <button
                onClick={handleReleaseFunds}
                disabled={intentLoading}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-purple-600 hover:bg-purple-700 text-white transition disabled:opacity-60"
                aria-label="Release funds for next payout"
              >
                {intentLoading ? 'Processing...' : 'Release Funds for Next Payout'}
              </button>
            )}
          </div>
        </div>

        {/* Optional small status */}
        <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
          If you don't click "Release Funds", your earnings remain in your account and won't be paid out this cycle.
        </div>
      </div>

      {/* Date Range Selector with visual separator */}
      <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h3 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white">Earnings Overview</h3>
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 text-sm font-medium touch-manipulation"
            style={{ minHeight: '44px' }}
          >
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="year">This Year</option>
          </select>
        </div>
      </div>

      {/* Earnings Cards with larger fonts */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {[
          { label: "Today's Earnings", value: earningsData?.todayEarnings || 0, icon: CalendarIcon },
          { label: "Monthly Earnings", value: earningsData?.monthlyEarnings || 0, icon: ChartBarIcon },
          { label: "Weekly Earnings", value: earningsData?.weeklyEarnings || 0, icon: CalendarIcon },
          { label: "Total Earnings", value: earningsData?.totalEarnings || 0, icon: CurrencyDollarIcon }
        ].map((item, index) => (
          <div key={index} className="bg-white dark:bg-gray-800 rounded-xl p-4 md:p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs md:text-sm font-medium text-gray-600 dark:text-gray-400">{item.label}</h3>
              <item.icon className="w-4 h-4 md:w-5 md:h-5 text-gray-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl md:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">
                {formatTokens(item.value)}
              </span>
            </div>
            <div className="mt-2 text-xs md:text-sm text-gray-600 dark:text-gray-400">
              {formatTokensAsUsd(item.value)}
            </div>
          </div>
        ))}
      </div>

      {/* Visual Separator */}
      <div className="border-t border-gray-200 dark:border-gray-700"></div>

      {/* Charts Section - Collapsible on Mobile */}
      <div className="space-y-6">
        <CollapsibleCard title="Earnings Trend" icon={ChartBarIcon} defaultOpen={true}>
          <div className="h-64 md:h-72">
            <ChartWhenVisible>
              {chartData.daily.length > 0 ? (
                <MemoizedAreaChart data={chartData.daily} />
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-6">
                  <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/20 rounded-full flex items-center justify-center mb-4">
                    <ArrowTrendingUpIcon className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                  </div>
                  <p className="font-medium text-gray-900 dark:text-white mb-1">No earnings yet</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs">
                    Share your profile link and start creating content to see your earnings grow here!
                  </p>
                </div>
              )}
            </ChartWhenVisible>
          </div>
        </CollapsibleCard>

        <CollapsibleCard title="Revenue Breakdown" icon={ChartBarIcon} defaultOpen={false}>
          <div className="h-64 md:h-72">
            <ChartWhenVisible>
              {chartData.breakdown.length > 0 ? (
                <MemoizedBarChart data={chartData.breakdown} />
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-6">
                  <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/20 rounded-full flex items-center justify-center mb-4">
                    <ChartBarIcon className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                  </div>
                  <p className="font-medium text-gray-900 dark:text-white mb-1">No revenue streams yet</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs">
                    Enable video calls, tips, and subscriptions to start earning from multiple sources.
                  </p>
                </div>
              )}
            </ChartWhenVisible>
          </div>
        </CollapsibleCard>
      </div>

      {/* Revenue Streams - Grid with better mobile layout */}
      <CollapsibleCard title="Revenue Streams" icon={CurrencyDollarIcon} defaultOpen={false}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {[
            { icon: GiftIcon, label: 'Tips', value: earningsData?.breakdown.tips || 0 },
            { icon: UsersIcon, label: 'Subscriptions', value: earningsData?.breakdown.subscriptions || 0 },
            { icon: VideoCameraIcon, label: 'Video Calls', value: earningsData?.breakdown.videoCalls || 0 },
            { icon: PhoneIcon, label: 'Voice Calls', value: earningsData?.breakdown.voiceCalls || 0 },
            { icon: ChatBubbleLeftRightIcon, label: 'Messages', value: earningsData?.breakdown.messages || 0 },
            { icon: SignalIcon, label: 'Live Streams', value: earningsData?.breakdown.liveStreams || 0 },
            { icon: DocumentTextIcon, label: 'Content', value: earningsData?.breakdown.content || 0 },
            { icon: FilmIcon, label: 'VOD', value: earningsData?.breakdown.vod || 0 }
          ].map((item, index) => (
            <motion.div 
              key={index}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center gap-3 p-3 md:p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg border border-purple-200 dark:border-purple-800 cursor-pointer touch-manipulation"
            >
              <div className="p-2 md:p-3 bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-800 dark:to-pink-800 rounded-lg">
                <item.icon className="w-5 h-5 md:w-6 md:h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400 truncate">{item.label}</p>
                <p className="text-base md:text-lg font-semibold text-gray-900 dark:text-white">{formatTokens(item.value)}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </CollapsibleCard>

    </div>
  );
};

export default memo(WalletOptimized);