import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../utils/supabase-auth.js';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
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
  ChevronRightIcon,
  TicketIcon,
  SparklesIcon,
  GlobeAltIcon,
  SunIcon,
  StarIcon,
  CheckCircleIcon,
  LockClosedIcon,
  XMarkIcon,
  WalletIcon,
  MagnifyingGlassIcon,
  FolderIcon,
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

const Wallet = ({ user, tokenBalance, onTokenUpdate, onViewProfile, onTokenPurchase, isCreator, isAdmin, setCurrentView }) => {
  const [walletData, setWalletData] = useState({
    tokens: 0,
    total_balance: 0
  });
  // Removed activeTab state - no longer needed without tabs
  const [actionLoading, setActionLoading] = useState(false);
  const [bankAccount, setBankAccount] = useState(null);
  const [showBankSetup, setShowBankSetup] = useState(false);
  const [bankFormData, setBankFormData] = useState({
    accountName: '',
    accountNumber: '',
    routingNumber: '',
    accountType: 'checking',
    bankName: ''
  });
  const [withdrawalHistory, setWithdrawalHistory] = useState([]);
  const [availableBalance, setAvailableBalance] = useState(0);
  const [autoWithdrawEnabled, setAutoWithdrawEnabled] = useState(false); // Default to false for safety
  
  // Withdrawal protection settings
  const [reservedBalance, setReservedBalance] = useState(0);
  const [withdrawableBalance, setWithdrawableBalance] = useState(0);
  const [showWithdrawalSettings, setShowWithdrawalSettings] = useState(false);
  const [tempReservedBalance, setTempReservedBalance] = useState('');
  const [hasBankAccount, setHasBankAccount] = useState(false);
  
  // Earnings state
  const [dateRange, setDateRange] = useState('month');
  const [earningsData, setEarningsData] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  
  // Revenue stream modal states
  const [showStreamModal, setShowStreamModal] = useState(false);
  const [selectedStream, setSelectedStream] = useState(null);
  const [showMonthModal, setShowMonthModal] = useState(false);
  
  // Monthly earnings data will be fetched from API
  const [monthlyEarningsData, setMonthlyEarningsData] = useState([]);


  const fetchBankAccount = useCallback(async () => {
    if (!isCreator) return;
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token;
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/payments/bank-account`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });

      if (response.ok) {
        const data = await response.json();
        setBankAccount(data.bankAccount);
        setHasBankAccount(!!data.bankAccount);
      }
    } catch (error) {
      console.error('Error fetching bank account:', error);
    }
  }, [isCreator]);
  
  const fetchWithdrawalSettings = useCallback(async () => {
    if (!isCreator) return;
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token;
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/payments/withdrawal-settings`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });

      if (response.ok) {
        const data = await response.json();
        setAutoWithdrawEnabled(data.settings.autoWithdrawEnabled);
        setReservedBalance(data.settings.reservedBalance);
        setWithdrawableBalance(data.settings.withdrawableBalance);
        setHasBankAccount(data.settings.hasBankAccount);
        setTempReservedBalance(data.settings.reservedBalance.toString());
      }
    } catch (error) {
      console.error('Error fetching withdrawal settings:', error);
    }
  }, [isCreator]);

  const fetchWithdrawalHistory = useCallback(async () => {
    if (!isCreator) return;
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token;
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/payments/withdrawals`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });

      if (response.ok) {
        const data = await response.json();
        setWithdrawalHistory(data.withdrawals || []);
      }
    } catch (error) {
      console.error('Error fetching withdrawals:', error);
    }
  }, [isCreator]);

  const fetchEarnings = useCallback(async () => {
    if (!isCreator) return;
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token;
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/payments/earnings`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });

      if (response.ok) {
        const data = await response.json();
        // Calculate available balance
        const totalEarnings = data.summary.totalEarnings || 0;
        const withdrawnAmount = withdrawalHistory
          .filter(w => w.status === 'completed' || w.status === 'processing')
          .reduce((sum, w) => sum + parseFloat(w.amount), 0);
        setAvailableBalance(totalEarnings - withdrawnAmount);
      }
    } catch (error) {
      console.error('Error fetching earnings:', error);
    }
  }, [isCreator, withdrawalHistory]);

  const fetchEarningsData = useCallback(async () => {
    if (!isCreator) return;
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token;
      
      // Fetch comprehensive earnings analytics
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/earnings/analytics?period=${dateRange}`,
        {
          headers: { 'Authorization': `Bearer ${authToken}` }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        
        // Transform API data to match component structure
        const transformedData = {
          totalEarnings: data.summary.totalEarnings,
          monthlyEarnings: data.periodEarnings.month,
          todayEarnings: data.periodEarnings.today,
          yesterdayEarnings: data.periodEarnings.yesterday,
          weeklyEarnings: data.periodEarnings.week,
          dailyEarnings: data.dailyEarnings.map(item => ({
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
          },
          topEarningDays: data.topEarningDays || [],
          totalTransactions: data.summary.totalTransactions,
          averageEarning: data.summary.averageEarning,
          activeDays: data.summary.activeDays
        };
        
        setEarningsData(transformedData);
        
        // Fetch monthly comparison for chart
        const monthlyResponse = await fetch(
          `${import.meta.env.VITE_BACKEND_URL}/api/earnings/monthly-comparison?months=6`,
          {
            headers: { 'Authorization': `Bearer ${authToken}` }
          }
        );
        
        if (monthlyResponse.ok) {
          const monthlyData = await monthlyResponse.json();
          // Store monthly data for the chart
          setEarningsData(prev => ({
            ...prev,
            monthlyComparison: monthlyData.months
          }));
        }
      } else {
        // If API fails, show empty state
        setEarningsData({
          totalEarnings: 0,
          monthlyEarnings: 0,
          todayEarnings: 0,
          yesterdayEarnings: 0,
          weeklyEarnings: 0,
          dailyEarnings: [],
          breakdown: {
            tips: 0,
            subscriptions: 0,
            content: 0,
            messages: 0,
            liveStreams: 0,
            videoCalls: 0,
            voiceCalls: 0,
            gifts: 0
          },
          topEarningDays: [],
          totalTransactions: 0,
          averageEarning: 0,
          activeDays: 0
        });
      }
    } catch (error) {
      console.error('Error fetching earnings data:', error);
      // Show empty state on error
      setEarningsData({
        totalEarnings: 0,
        monthlyEarnings: 0,
        todayEarnings: 0,
        yesterdayEarnings: 0,
        weeklyEarnings: 0,
        dailyEarnings: [],
        breakdown: {
          tips: 0,
          subscriptions: 0,
          content: 0,
          messages: 0,
          liveStreams: 0,
          videoCalls: 0,
          voiceCalls: 0,
          gifts: 0
        },
        topEarningDays: [],
        totalTransactions: 0,
        averageEarning: 0,
        activeDays: 0
      });
    }
  }, [isCreator, dateRange]);


  const fetchWalletData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token;
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/wallet`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });

      if (response.ok) {
        const data = await response.json();
        setWalletData(data);
      } else {
        // Use provided token balance as fallback
        setWalletData({
          tokens: tokenBalance || 0,
          total_balance: tokenBalance || 0
        });
      }
    } catch (error) {
      console.error('Error fetching wallet data:', error);
      // Silently handle error - no toast notification
    } finally {
    }
  }, [tokenBalance]);

  useEffect(() => {
    fetchWalletData();
    if (isCreator) {
      fetchBankAccount();
      fetchWithdrawalSettings();
      fetchWithdrawalHistory();
      fetchEarnings();
      fetchEarningsData();
    }
  }, [fetchWalletData, fetchBankAccount, fetchWithdrawalSettings, fetchWithdrawalHistory, fetchEarnings, fetchEarningsData, isCreator]);

  useEffect(() => {
    if (isCreator) {
      fetchEarningsData();
    }
  }, [dateRange, selectedMonth, fetchEarningsData, isCreator]);


  const handleBankAccountSetup = async () => {
    const { accountName, accountNumber, routingNumber, bankName } = bankFormData;
    
    if (!accountName || !accountNumber || !routingNumber || !bankName) {
      toast.error('Please fill in all bank account fields');
      return;
    }
    
    try {
      setActionLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token;
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/payments/bank-account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(bankFormData)
      });

      if (response.ok) {
        const data = await response.json();
        setBankAccount(data.bankAccount);
        setShowBankSetup(false);
        setBankFormData({
          accountName: '',
          accountNumber: '',
          routingNumber: '',
          accountType: 'checking',
          bankName: ''
        });
        // toast.success('Bank account setup successfully! Auto-withdrawals enabled.');
        await fetchBankAccount();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to setup bank account');
      }
    } catch (error) {
      console.error('Bank setup error:', error);
      toast.error('Failed to setup bank account');
    } finally {
      setActionLoading(false);
    }
  };

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
      
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/payments/withdrawal-settings`, {
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
        toast.success(data.message);
        setShowWithdrawalSettings(false);
        await fetchWithdrawalSettings();
      } else {
        const error = await response.json();
        if (error.needsBankSetup) {
          toast.error('Please set up your bank account first');
          setShowBankSetup(true);
        } else {
          toast.error(error.error);
        }
      }
    } catch (error) {
      console.error('Update withdrawal settings error:', error);
      toast.error('Failed to update withdrawal settings');
    }
  };

  // Savings transfer function removed - all tokens now in single balance



  const calculatePercentageChange = (current, previous) => {
    if (previous === 0) return 100;
    return ((current - previous) / previous * 100).toFixed(1);
  };

  const formatTokens = (tokens) => {
    return tokens.toLocaleString();
  };

  const formatCurrency = (amount) => {
    return `$${(amount * 0.05).toFixed(2)}`;
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload[0]) {
      return (
        <div className="bg-gray-900 text-white p-3 rounded-lg shadow-xl border border-gray-700">
          <p className="text-xs font-medium text-gray-400 mb-1">{`Day ${label}`}</p>
          <p className="text-base font-semibold">{`${payload[0].value} tokens`}</p>
          <p className="text-xs text-gray-400 mt-1">{formatCurrency(payload[0].value)}</p>
        </div>
      );
    }
    return null;
  };



  const renderEarningsTab = () => {
    // For non-creators (fans), show only token balance and purchase option
    if (!isCreator) {
      return (
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="max-w-lg w-full">
            {/* Token Balance Card */}
            <div className="bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-2xl p-10 shadow-2xl text-center">
              <div className="mb-6">
                <WalletIcon className="w-16 h-16 mx-auto opacity-80" />
              </div>
              
              <h2 className="text-2xl font-bold mb-6">Your Token Balance</h2>
              
              <div className="mb-2">
                <div className="text-5xl font-bold mb-1">{walletData.tokens.toLocaleString()}</div>
                <span className="text-lg opacity-90">tokens</span>
              </div>
              
              <div className="text-sm opacity-75 mb-8">≈ ${(walletData.tokens * 0.05).toFixed(2)} USD</div>
              
              <button
                onClick={() => {
                  if (onTokenPurchase) {
                    onTokenPurchase();
                  }
                }}
                className="bg-white text-purple-600 hover:bg-gray-100 px-8 py-4 rounded-xl transition-all duration-200 font-bold shadow-lg hover:shadow-xl flex items-center gap-3 mx-auto"
              >
                <CurrencyDollarIcon className="w-6 h-6" />
                Purchase Tokens
              </button>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Tokens Purchased</p>
                    <p className="text-xs text-gray-500">2 hours ago</p>
                  </div>
                </div>
                <div className="text-green-600 font-semibold">+1,000</div>
              </div>
              
              <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Video Call with Sarah</p>
                    <p className="text-xs text-gray-500">Yesterday</p>
                  </div>
                </div>
                <div className="text-red-600 font-semibold">-240</div>
              </div>
              
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Gift Received</p>
                    <p className="text-xs text-gray-500">3 days ago</p>
                  </div>
                </div>
                <div className="text-purple-600 font-semibold">+50</div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (!earningsData) return null;

    const percentageChange = calculatePercentageChange(
      earningsData.monthlyEarnings,
      earningsData.previousMonthEarnings
    );
    const isPositive = percentageChange >= 0;

    // Prepare chart data
    const dailyChartData = earningsData?.dailyEarnings || [];
    
    const breakdownChartData = earningsData ? [
      { name: 'Tips', value: earningsData.breakdown.tips, fill: '#9333ea' },
      { name: 'Gifts', value: earningsData.breakdown.gifts, fill: '#f59e0b' },
      { name: 'Video Calls', value: earningsData.breakdown.videoCalls, fill: '#3b82f6' },
      { name: 'Voice Calls', value: earningsData.breakdown.voiceCalls, fill: '#06b6d4' },
      { name: 'VOD', value: earningsData.breakdown.vod || 0, fill: '#f97316' },
      { name: 'Content', value: earningsData.breakdown.content, fill: '#22c55e' },
      { name: 'Streams', value: earningsData.breakdown.liveStreams, fill: '#ec4899' }
    ] : [];

    return (
      <div className="space-y-6">
        {/* Balance Card */}
        <div className="mb-6">
          {/* Available Balance Card */}
          <div className="bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h3 className="text-sm font-medium opacity-90 mb-1">Available Balance</h3>
                <div className="text-2xl font-bold">{walletData.tokens.toLocaleString()}</div>
                <div className="text-xs opacity-75 mt-1">≈ ${(walletData.tokens * 0.05).toFixed(2)} USD</div>
                {isCreator && (
                  <div className="text-xs opacity-60 mt-2 italic">Bi-weekly auto-withdraws</div>
                )}
              </div>
              <div className="text-white/20">
                <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.31-8.86c-1.77-.45-2.34-.94-2.34-1.67 0-.84.79-1.43 2.1-1.43 1.38 0 1.9.66 1.94 1.64h1.71c-.04-1.34-.87-2.56-2.49-2.96V5h-2.18v1.7c-1.51.32-2.72 1.3-2.72 2.81 0 1.79 1.49 2.68 3.66 3.2 1.96.46 2.34 1.14 2.34 1.86 0 .53-.39 1.39-2.1 1.39-1.6 0-2.23-.72-2.32-1.64H8.04c.1 1.7 1.36 2.66 2.86 2.97V19h2.18v-1.67c1.52-.29 2.72-1.16 2.73-2.77-.01-2.19-1.88-2.93-3.5-3.42z"/>
                </svg>
              </div>
            </div>
            <button
              onClick={onTokenPurchase}
              className="bg-white/30 hover:bg-white/40 text-white px-4 py-2 rounded-lg transition-all duration-200 font-medium text-sm shadow-md hover:shadow-lg mt-4"
            >
              Buy Tokens
            </button>
          </div>
        </div>
        {/* Date Range Selector */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Earnings Overview</h3>
          <div className="flex items-center gap-3">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
            >
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="year">This Year</option>
              <option value="custom">Custom Range</option>
            </select>
            
            {dateRange === 'month' && (
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
              />
            )}
          </div>
        </div>

        {/* Earnings Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Today's Earnings */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Today's Earnings</h3>
              <CalendarIcon className="w-5 h-5 text-gray-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-gray-900 dark:text-white">
                {earningsData.todayEarnings}
              </span>
              <span className="text-sm text-gray-500 dark:text-gray-400">tokens</span>
            </div>
            <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              {formatCurrency(earningsData.todayEarnings)}
            </div>
          </div>

          {/* Monthly Earnings */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Monthly Earnings</h3>
              <ChartBarIcon className="w-5 h-5 text-gray-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-gray-900 dark:text-white">
                {earningsData.monthlyEarnings}
              </span>
              <span className="text-sm text-gray-500 dark:text-gray-400">tokens</span>
            </div>
            <div className="mt-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">{formatCurrency(earningsData.monthlyEarnings)}</span>
            </div>
          </div>

          {/* Weekly Earnings */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Weekly Earnings</h3>
              <CalendarIcon className="w-5 h-5 text-gray-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-gray-900 dark:text-white">
                {earningsData.weeklyEarnings}
              </span>
              <span className="text-sm text-gray-500 dark:text-gray-400">tokens</span>
            </div>
            <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              {formatCurrency(earningsData.weeklyEarnings)}
            </div>
          </div>

          {/* Total Earnings */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Earnings</h3>
              <CurrencyDollarIcon className="w-5 h-5 text-gray-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-gray-900 dark:text-white">
                {earningsData.totalEarnings}
              </span>
              <span className="text-sm text-gray-500 dark:text-gray-400">tokens</span>
            </div>
            <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              {formatCurrency(earningsData.totalEarnings)}
            </div>
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Daily Earnings Chart */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Daily Earnings Trend</h3>
              <p className="text-sm text-gray-600">
                {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </p>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyChartData}>
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
                    label={{ value: 'Day', position: 'insideBottom', offset: -5, style: { fill: '#6b7280' } }}
                  />
                  <YAxis 
                    stroke="#6b7280" 
                    label={{ value: '$', position: 'insideLeft', angle: 0, style: { fill: '#6b7280' } }}
                    tickFormatter={(value) => `$${value}`}
                  />
                  <Tooltip content={<CustomTooltip />} />
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
            </div>
          </div>

          {/* Earnings Breakdown */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Earnings Breakdown</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={breakdownChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" stroke="#6b7280" />
                  <YAxis stroke="#6b7280" />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]} fill="#9333ea" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Revenue Streams */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Revenue Streams</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {/* Tips */}
            <motion.div 
              whileHover={{ scale: 1.02 }}
              className="flex items-center gap-4 p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg transition-all border border-purple-200 dark:border-purple-800">
              <div className="p-3 bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-800 dark:to-pink-800 rounded-lg">
                <GiftIcon className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-600 dark:text-gray-400">Tips</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">{earningsData.breakdown.tips} tokens</p>
              </div>
            </motion.div>

            {/* Subscriptions */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="flex items-center gap-4 p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg transition-all border border-purple-200 dark:border-purple-800">
              <div className="p-3 bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-800 dark:to-pink-800 rounded-lg">
                <UsersIcon className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-600 dark:text-gray-400">Subscriptions</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">{earningsData.breakdown.subscriptions} tokens</p>
              </div>
            </motion.div>

            {/* Content */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="flex items-center gap-4 p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg transition-all border border-purple-200 dark:border-purple-800">
              <div className="p-3 bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-800 dark:to-pink-800 rounded-lg">
                <DocumentTextIcon className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-600 dark:text-gray-400">Content</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">{earningsData.breakdown.content} tokens</p>
              </div>
            </motion.div>

            {/* Messages */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="flex items-center gap-4 p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg transition-all border border-purple-200 dark:border-purple-800">
              <div className="p-3 bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-800 dark:to-pink-800 rounded-lg">
                <ChatBubbleLeftRightIcon className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-600 dark:text-gray-400">Messages</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">{earningsData.breakdown.messages} tokens</p>
              </div>
            </motion.div>

            {/* Live Streams */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="flex items-center gap-4 p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg transition-all border border-purple-200 dark:border-purple-800">
              <div className="p-3 bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-800 dark:to-pink-800 rounded-lg">
                <SignalIcon className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-600 dark:text-gray-400">Private Streams</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">{earningsData.breakdown.liveStreams} tokens</p>
              </div>
            </motion.div>

            {/* Video Calls */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="flex items-center gap-4 p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg transition-all border border-purple-200 dark:border-purple-800">
              <div className="p-3 bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-800 dark:to-pink-800 rounded-lg">
                <VideoCameraIcon className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-600 dark:text-gray-400">Video Calls</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">{earningsData.breakdown.videoCalls} tokens</p>
              </div>
            </motion.div>

            {/* Voice Calls */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="flex items-center gap-4 p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg transition-all border border-purple-200 dark:border-purple-800">
              <div className="p-3 bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-800 dark:to-pink-800 rounded-lg">
                <PhoneIcon className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-600 dark:text-gray-400">Voice Calls</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">{earningsData.breakdown.voiceCalls} tokens</p>
              </div>
            </motion.div>

            {/* VOD Earnings */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="flex items-center gap-4 p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg transition-all border border-purple-200 dark:border-purple-800"
            >
              <div className="p-3 bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-800 dark:to-pink-800 rounded-lg">
                <FilmIcon className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-600 dark:text-gray-400">VOD</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">{earningsData.breakdown.vod || 0} tokens</p>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Monthly Earnings Visualization - Show only if data available */}
        {monthlyEarningsData && monthlyEarningsData.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Monthly Earnings</h3>
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {monthlyEarningsData.map((month, index) => {
                return (
                  <div
                    key={month.month}
                    className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 hover:shadow-md transition-all cursor-pointer"
                    onClick={() => {
                      setSelectedMonth(month);
                      setShowMonthModal(true);
                    }}
                  >
                    <div className="text-center">
                      <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
                        {month.month}
                      </p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white mt-1">
                        {month.amount > 0 ? formatTokens(month.amount) : '-'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {month.amount > 0 ? formatCurrency(month.amount) : '$0'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };


  const renderWithdrawalsTab = () => (
    <div className="space-y-6">
      {/* Withdrawal Balance Card */}
      <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-medium opacity-90 mb-1">Available for Withdrawal</h3>
            <div className="text-3xl font-bold">${availableBalance.toFixed(2)}</div>
            <div className="text-xs opacity-75 mt-1">Auto-withdrawal on 1st & 15th of each month</div>
          </div>
          <div className="text-white/20">
            <svg className="w-16 h-16" fill="currentColor" viewBox="0 0 24 24">
              <path d="M3 6h18v12c0 1.1-.9 2-2 2H5c-1.1 0-2-.9-2-2V6zm2 2v2h14V8H5zm0 4v2h4v-2H5zm6 0v2h8v-2h-8zM5 16v2h4v-2H5zm6 0v2h8v-2h-8z"/>
            </svg>
          </div>
        </div>
      </div>

      {/* Bank Account Section */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Bank Account</h3>
          {bankAccount && (
            <button
              onClick={() => setShowBankSetup(true)}
              className="text-sm text-purple-600 hover:text-purple-700"
            >
              Update
            </button>
          )}
        </div>
        
        {bankAccount ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
              <span className="text-sm text-gray-600">Account Name</span>
              <span className="text-sm font-medium text-gray-900">{bankAccount.accountName}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
              <span className="text-sm text-gray-600">Account Number</span>
              <span className="text-sm font-medium text-gray-900">{bankAccount.accountNumber}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
              <span className="text-sm text-gray-600">Bank Name</span>
              <span className="text-sm font-medium text-gray-900">{bankAccount.bankName}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-gray-600">Auto-withdrawal</span>
              <button
                onClick={toggleAutoWithdraw}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-200 ${
                  autoWithdrawEnabled ? 'bg-green-500 shadow-md' : 'bg-gray-300'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-all duration-200 shadow-sm ${
                  autoWithdrawEnabled ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="text-4xl mb-3">🏦</div>
            <p className="text-gray-600 mb-4">Set up your bank account to receive automatic withdrawals</p>
            <button
              onClick={() => setShowBankSetup(true)}
              className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700"
            >
              Setup Bank Account
            </button>
          </div>
        )}
      </div>

      {/* Withdrawal History */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Withdrawal History</h3>
        {withdrawalHistory.length > 0 ? (
          <div className="space-y-3">
            {withdrawalHistory.map((withdrawal) => (
              <div key={withdrawal.id} className="flex items-center justify-between py-3 border-b border-gray-100">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    ${parseFloat(withdrawal.amount).toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(withdrawal.requested_at).toLocaleDateString()}
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  withdrawal.status === 'completed' ? 'bg-green-100 text-green-800' :
                  withdrawal.status === 'processing' ? 'bg-yellow-100 text-yellow-800' :
                  withdrawal.status === 'pending' ? 'bg-blue-100 text-blue-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {withdrawal.status}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-gray-500 py-4">No withdrawals yet</p>
        )}
      </div>
    </div>
  );


  return (
    <div className="space-y-6">
      {/* Render earnings content directly without tabs */}
      {renderEarningsTab()}


      {/* Bank Account Setup Modal */}
      {showBankSetup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold">Bank Account Setup</h3>
                <button
                  onClick={() => setShowBankSetup(false)}
                  className="text-gray-400 hover:text-gray-600 text-xl"
                >
                  ×
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Account Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={bankFormData.accountName}
                    onChange={(e) => setBankFormData(prev => ({ ...prev, accountName: e.target.value }))}
                    placeholder="John Doe"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Bank Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={bankFormData.bankName}
                    onChange={(e) => setBankFormData(prev => ({ ...prev, bankName: e.target.value }))}
                    placeholder="Chase Bank"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Account Type
                  </label>
                  <select
                    value={bankFormData.accountType}
                    onChange={(e) => setBankFormData(prev => ({ ...prev, accountType: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="checking">Checking</option>
                    <option value="savings">Savings</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Account Number
                  </label>
                  <input
                    type="text"
                    value={bankFormData.accountNumber}
                    onChange={(e) => setBankFormData(prev => ({ ...prev, accountNumber: e.target.value }))}
                    placeholder="********1234"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Routing Number
                  </label>
                  <input
                    type="text"
                    value={bankFormData.routingNumber}
                    onChange={(e) => setBankFormData(prev => ({ ...prev, routingNumber: e.target.value }))}
                    placeholder="123456789"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 p-4 rounded-lg">
                  <div className="flex items-start gap-3">
                    <div className="text-blue-600 mt-0.5">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-blue-900 mb-1">Automatic Withdrawals</h4>
                      <p className="text-sm text-blue-700">
                        Once your bank account is set up, withdrawals will automatically be processed on the 1st and 15th of each month.
                        Minimum withdrawal amount is $50.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    onClick={() => setShowBankSetup(false)}
                    className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleBankAccountSetup}
                    disabled={actionLoading}
                    className="flex-1 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300"
                  >
                    {actionLoading ? 'Setting up...' : 'Setup Account'}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}


      {/* Revenue Stream Modal */}
      <AnimatePresence>
        {showStreamModal && selectedStream && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowStreamModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white capitalize">
                    {selectedStream} Details
                  </h2>
                  <button
                    onClick={() => setShowStreamModal(false)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <XMarkIcon className="w-6 h-6 text-gray-500 dark:text-gray-400" />
                  </button>
                </div>
                
                <div className="space-y-4">
                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-4 rounded-lg">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Earnings</p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">
                      {earningsData?.breakdown?.[selectedStream] || 0} tokens
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {formatCurrency(earningsData?.breakdown?.[selectedStream] || 0)}
                    </p>
                  </div>
                  
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <p className="text-lg mb-2">Detailed analytics coming soon!</p>
                    <p className="text-sm">You'll be able to see top contributors, trends, and more.</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Monthly Details Modal */}
      <AnimatePresence>
        {showMonthModal && selectedMonth && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowMonthModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {selectedMonth.month} Earnings
                  </h2>
                  <button
                    onClick={() => setShowMonthModal(false)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <XMarkIcon className="w-6 h-6 text-gray-500 dark:text-gray-400" />
                  </button>
                </div>
                
                <div className="space-y-4">
                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-4 rounded-lg">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total for {selectedMonth.month}</p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">
                      {selectedMonth.amount} tokens
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {formatCurrency(selectedMonth.amount)}
                    </p>
                    {selectedMonth.growth !== 0 && (
                      <p className={`text-sm mt-2 font-medium ${
                        selectedMonth.growth > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                      }`}>
                        {selectedMonth.growth > 0 ? '↑' : '↓'} {Math.abs(selectedMonth.growth)}% from previous month
                      </p>
                    )}
                  </div>
                  
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <p className="text-lg mb-2">Daily breakdown coming soon!</p>
                    <p className="text-sm">View daily earnings, best performing days, and trends.</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Withdrawal Settings Modal */}
      {showWithdrawalSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full"
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">Withdrawal Settings</h3>
                <button
                  onClick={() => setShowWithdrawalSettings(false)}
                  className="text-gray-400 hover:text-gray-600 text-xl"
                >
                  ×
                </button>
              </div>

              <div className="space-y-6">
                {/* Current Balance Info */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-600 font-medium mb-1">Current Balance</p>
                      <p className="text-lg font-bold text-gray-900">{walletData.tokens.toLocaleString()}</p>
                      <p className="text-xs text-gray-500">≈ ${(walletData.tokens * 0.05).toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 font-medium mb-1">Withdrawable</p>
                      <p className="text-lg font-bold text-green-600">{withdrawableBalance.toLocaleString()}</p>
                      <p className="text-xs text-gray-500">≈ ${(withdrawableBalance * 0.05).toFixed(2)}</p>
                    </div>
                  </div>
                </div>

                {/* Auto-Withdrawal Toggle */}
                <div className="border-b pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-gray-900">Auto-Withdrawal</h4>
                      <p className="text-sm text-gray-500 mt-1">
                        {hasBankAccount ? 
                          'Automatically withdraw tokens bi-weekly (1st & 15th)' : 
                          'Bank account required for auto-withdrawal'}
                      </p>
                    </div>
                    <button
                      onClick={() => updateWithdrawalSettings(!autoWithdrawEnabled, null)}
                      disabled={!hasBankAccount}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        autoWithdrawEnabled ? 'bg-green-600' : 'bg-gray-200'
                      } ${!hasBankAccount ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        autoWithdrawEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>
                  {!hasBankAccount && (
                    <button
                      onClick={() => {
                        setShowWithdrawalSettings(false);
                        setShowBankSetup(true);
                      }}
                      className="mt-3 text-sm text-purple-600 hover:text-purple-700 font-medium"
                    >
                      Set up bank account →
                    </button>
                  )}
                </div>

                {/* Reserved Balance Setting */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reserved Balance (Tokens)
                  </label>
                  <p className="text-xs text-gray-500 mb-3">
                    These tokens will be protected from auto-withdrawal
                  </p>
                  <div className="relative">
                    <input
                      type="number"
                      value={tempReservedBalance}
                      onChange={(e) => setTempReservedBalance(e.target.value)}
                      placeholder="0"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      min="0"
                      max={walletData.tokens}
                    />
                    <span className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-500">
                      tokens
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Max: {walletData.tokens.toLocaleString()} tokens
                  </p>
                </div>

                {/* Quick Reserve Buttons */}
                <div className="grid grid-cols-4 gap-2">
                  {[1000, 5000, 10000, 20000].map(amount => (
                    <button
                      key={amount}
                      onClick={() => setTempReservedBalance(amount.toString())}
                      disabled={amount > walletData.tokens}
                      className={`py-2 px-3 rounded-lg font-medium text-sm transition-all ${
                        amount <= walletData.tokens
                          ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                          : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      {amount.toLocaleString()}
                    </button>
                  ))}
                </div>

                {/* Info Message */}
                <div className="bg-blue-50 rounded-lg p-3">
                  <p className="text-sm text-blue-700">
                    💡 {autoWithdrawEnabled ? 
                      'Auto-withdrawal will process bi-weekly, keeping your reserved balance safe.' : 
                      'With auto-withdrawal disabled, your tokens will accumulate until you manually withdraw.'}
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex space-x-3 pt-2">
                  <button
                    onClick={() => {
                      setShowWithdrawalSettings(false);
                      setTempReservedBalance(reservedBalance.toString());
                    }}
                    className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      const newReserved = parseFloat(tempReservedBalance) || 0;
                      if (newReserved !== reservedBalance) {
                        updateWithdrawalSettings(null, newReserved);
                      } else {
                        setShowWithdrawalSettings(false);
                      }
                    }}
                    className="flex-1 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium transition-all"
                  >
                    Save Settings
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default Wallet;