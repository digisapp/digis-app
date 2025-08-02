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
  MapPinIcon,
  TicketIcon,
  SparklesIcon,
  GlobeAltIcon,
  SunIcon,
  StarIcon,
  CheckCircleIcon,
  LockClosedIcon
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

const Wallet = ({ user, tokenBalance, onTokenUpdate, onViewProfile, onTokenPurchase, isCreator, isAdmin }) => {
  const [walletData, setWalletData] = useState({
    tokens: 0
  });
  const [activeTab, setActiveTab] = useState('earnings');
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
  const [autoWithdrawEnabled, setAutoWithdrawEnabled] = useState(true);
  const [showRedeemModal, setShowRedeemModal] = useState(false);
  const [selectedExperience, setSelectedExperience] = useState(null);
  
  // Earnings state
  const [dateRange, setDateRange] = useState('month');
  const [earningsData, setEarningsData] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  // Experience tiers for redemption
  const experiences = [
    {
      id: 1,
      name: 'Local Meetup',
      location: 'Your City',
      tokensRequired: 5000,
      description: 'Join local creator meetups and networking events',
      image: '/api/placeholder/300/200',
      available: walletData.tokens >= 5000,
      category: 'local'
    },
    {
      id: 2,
      name: 'Miami Beach Retreat',
      location: 'Miami Beach, FL',
      tokensRequired: 10000,
      description: '3-day beach retreat with content creation workshops',
      image: '/api/placeholder/300/200',
      available: walletData.tokens >= 10000,
      category: 'domestic'
    },
    {
      id: 3,
      name: 'Greece Island Adventure',
      location: 'Santorini, Greece',
      tokensRequired: 25000,
      description: 'Week-long all-inclusive trip to the Greek islands',
      image: '/api/placeholder/300/200',
      available: walletData.tokens >= 25000,
      category: 'international'
    },
    {
      id: 4,
      name: 'Bali Creator Villa',
      location: 'Bali, Indonesia',
      tokensRequired: 50000,
      description: '2-week luxury villa experience with top creators',
      image: '/api/placeholder/300/200',
      available: walletData.tokens >= 50000,
      category: 'international'
    },
    {
      id: 5,
      name: 'World Tour Experience',
      location: 'Multiple Destinations',
      tokensRequired: 100000,
      description: '1-month world tour visiting 5 amazing destinations',
      image: '/api/placeholder/300/200',
      available: walletData.tokens >= 100000,
      category: 'premium'
    }
  ];

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
        setAutoWithdrawEnabled(data.autoWithdrawEnabled);
      }
    } catch (error) {
      console.error('Error fetching bank account:', error);
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
      // In production, this would fetch from your API
      // For now, we'll use mock data
      const mockData = generateMockEarningsData();
      setEarningsData(mockData);
    } catch (error) {
      console.error('Error fetching earnings data:', error);
      toast.error('Failed to load earnings data');
    }
  }, [isCreator]);

  const generateMockEarningsData = () => {
    const today = new Date();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    
    // Generate daily earnings for the chart
    const dailyEarnings = [];
    for (let i = 1; i <= daysInMonth; i++) {
      dailyEarnings.push({
        date: i,
        amount: Math.floor(Math.random() * 500) + 100
      });
    }

    return {
      totalEarnings: 12450,
      monthlyEarnings: 3850,
      previousMonthEarnings: 3200,
      todayEarnings: 245,
      yesterdayEarnings: 320,
      weeklyEarnings: 1680,
      dailyEarnings,
      breakdown: {
        tips: 4250,
        subscriptions: 3200,
        content: 1850,
        messages: 1200,
        liveStreams: 850,
        videoCalls: 750,
        voiceCalls: 350
      },
      topEarningDays: [
        { date: '2024-01-15', amount: 580, reason: 'Live stream event' },
        { date: '2024-01-22', amount: 520, reason: 'New content release' },
        { date: '2024-01-08', amount: 480, reason: 'Multiple video calls' }
      ]
    };
  };

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
        // Mock wallet data
        setWalletData({
          tokens: tokenBalance
        });
      }
    } catch (error) {
      console.error('Error fetching wallet data:', error);
      toast.error('Failed to load wallet data');
    } finally {
    }
  }, [tokenBalance]);

  useEffect(() => {
    fetchWalletData();
    if (isCreator) {
      fetchBankAccount();
      fetchWithdrawalHistory();
      fetchEarnings();
      fetchEarningsData();
    }
  }, [fetchWalletData, fetchBankAccount, fetchWithdrawalHistory, fetchEarnings, fetchEarningsData, isCreator]);

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

  const toggleAutoWithdraw = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token;
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/payments/auto-withdraw`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ enabled: !autoWithdrawEnabled })
      });

      if (response.ok) {
        const data = await response.json();
        setAutoWithdrawEnabled(data.autoWithdrawEnabled);
        // toast.success(data.message);
      } else {
        const error = await response.json();
        toast.error(error.error);
      }
    } catch (error) {
      console.error('Toggle auto-withdraw error:', error);
      toast.error('Failed to update auto-withdrawal settings');
    }
  };



  const calculatePercentageChange = (current, previous) => {
    if (previous === 0) return 100;
    return ((current - previous) / previous * 100).toFixed(1);
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
    // For non-creators, show a simplified view with just balance
    if (!isCreator) {
      return (
        <div className="space-y-6">
          {/* Available Balance Card */}
          <div className="bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium opacity-90 mb-1">Available Balance</h3>
                <div className="text-2xl font-bold">{walletData.tokens.toLocaleString()}</div>
                <div className="text-xs opacity-75 mt-1">≈ ${(walletData.tokens * 0.05).toFixed(2)} USD</div>
              </div>
              <div className="text-white/20">
                <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.31-8.86c-1.77-.45-2.34-.94-2.34-1.67 0-.84.79-1.43 2.1-1.43 1.38 0 1.9.66 1.94 1.64h1.71c-.04-1.34-.87-2.56-2.49-2.96V5h-2.18v1.7c-1.51.32-2.72 1.3-2.72 2.81 0 1.79 1.49 2.68 3.66 3.2 1.96.46 2.34 1.14 2.34 1.86 0 .53-.39 1.39-2.1 1.39-1.6 0-2.23-.72-2.32-1.64H8.04c.1 1.7 1.36 2.66 2.86 2.97V19h2.18v-1.67c1.52-.29 2.72-1.16 2.73-2.77-.01-2.19-1.88-2.93-3.5-3.42z"/>
                </svg>
              </div>
            </div>
            <button
              onClick={() => {
                if (onTokenPurchase) {
                  onTokenPurchase();
                }
              }}
              className="bg-white/30 hover:bg-white/40 text-white px-4 py-2 rounded-lg transition-all duration-200 font-medium text-sm shadow-md hover:shadow-lg mt-4"
            >
              Buy Tokens
            </button>
          </div>

          {/* Recent Activity */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
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
              
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
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
      { name: 'Subscriptions', value: earningsData.breakdown.subscriptions, fill: '#3b82f6' },
      { name: 'Content', value: earningsData.breakdown.content, fill: '#22c55e' },
      { name: 'Messages', value: earningsData.breakdown.messages, fill: '#fb923c' },
      { name: 'Live Streams', value: earningsData.breakdown.liveStreams, fill: '#ec4899' },
      { name: 'Video Calls', value: earningsData.breakdown.videoCalls, fill: '#a855f7' },
      { name: 'Voice Calls', value: earningsData.breakdown.voiceCalls, fill: '#14b8a6' }
    ] : [];

    return (
      <div className="space-y-6">
        {/* Available Balance Card - Moved from Tokens tab */}
        <div className={`grid grid-cols-1 ${isCreator ? 'md:grid-cols-2' : ''} gap-4 mb-6`}>
          <div className="bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium opacity-90 mb-1">Available Balance</h3>
                <div className="text-2xl font-bold">{walletData.tokens.toLocaleString()}</div>
                <div className="text-xs opacity-75 mt-1">≈ ${(walletData.tokens * 0.05).toFixed(2)} USD</div>
              </div>
              <div className="text-white/20">
                <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.31-8.86c-1.77-.45-2.34-.94-2.34-1.67 0-.84.79-1.43 2.1-1.43 1.38 0 1.9.66 1.94 1.64h1.71c-.04-1.34-.87-2.56-2.49-2.96V5h-2.18v1.7c-1.51.32-2.72 1.3-2.72 2.81 0 1.79 1.49 2.68 3.66 3.2 1.96.46 2.34 1.14 2.34 1.86 0 .53-.39 1.39-2.1 1.39-1.6 0-2.23-.72-2.32-1.64H8.04c.1 1.7 1.36 2.66 2.86 2.97V19h2.18v-1.67c1.52-.29 2.72-1.16 2.73-2.77-.01-2.19-1.88-2.93-3.5-3.42z"/>
                </svg>
              </div>
            </div>
            <button
              onClick={() => {
                console.log('Buy Tokens clicked, onTokenPurchase:', onTokenPurchase);
                if (onTokenPurchase) {
                  onTokenPurchase();
                } else {
                  alert('Token purchase function not available');
                }
              }}
              className="bg-white/30 hover:bg-white/40 text-white px-4 py-2 rounded-lg transition-all duration-200 font-medium text-sm shadow-md hover:shadow-lg"
            >
              Buy Tokens
            </button>
          </div>
          
          {isCreator && (
            <div className="bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl p-6 shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium opacity-90 mb-1">Total Earned</h3>
                  <div className="text-2xl font-bold">12,450</div>
                  <div className="text-xs opacity-75 mt-1">Lifetime earnings</div>
                </div>
                <div className="text-white/20">
                  <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z"/>
                  </svg>
                </div>
              </div>
            </div>
          )}
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
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-600">Today's Earnings</h3>
              <CalendarIcon className="w-5 h-5 text-gray-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-gray-900">
                {earningsData.todayEarnings}
              </span>
              <span className="text-sm text-gray-500">tokens</span>
            </div>
            <div className="mt-2 text-sm text-gray-600">
              {formatCurrency(earningsData.todayEarnings)}
            </div>
          </div>

          {/* Monthly Earnings */}
          <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl p-6 shadow-lg text-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium opacity-90">Monthly Earnings</h3>
              <ChartBarIcon className="w-5 h-5 opacity-70" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">
                {earningsData.monthlyEarnings}
              </span>
              <span className="text-sm opacity-90">tokens</span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-sm opacity-90">{formatCurrency(earningsData.monthlyEarnings)}</span>
              <span className={`text-sm flex items-center gap-1 ${isPositive ? 'text-green-300' : 'text-red-300'}`}>
                {isPositive ? <ArrowTrendingUpIcon className="w-4 h-4" /> : <ArrowTrendingDownIcon className="w-4 h-4" />}
                {Math.abs(percentageChange)}%
              </span>
            </div>
          </div>

          {/* Weekly Earnings */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-600">Weekly Earnings</h3>
              <CalendarIcon className="w-5 h-5 text-gray-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-gray-900">
                {earningsData.weeklyEarnings}
              </span>
              <span className="text-sm text-gray-500">tokens</span>
            </div>
            <div className="mt-2 text-sm text-gray-600">
              {formatCurrency(earningsData.weeklyEarnings)}
            </div>
          </div>

          {/* Total Earnings */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-600">Total Earnings</h3>
              <CurrencyDollarIcon className="w-5 h-5 text-gray-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-gray-900">
                {earningsData.totalEarnings}
              </span>
              <span className="text-sm text-gray-500">tokens</span>
            </div>
            <div className="mt-2 text-sm text-gray-600">
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
            <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg cursor-pointer hover:shadow-md transition-shadow"
                 onClick={() => toast.info('View fans who contributed: Coming soon!')}>
              <div className="p-3 bg-gradient-to-r from-purple-100 to-pink-100 rounded-lg">
                <GiftIcon className="w-6 h-6 text-purple-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-600">Tips</p>
                <p className="text-lg font-semibold text-gray-900">{earningsData.breakdown.tips}</p>
                <p className="text-xs text-gray-500">{formatCurrency(earningsData.breakdown.tips)}</p>
              </div>
              <ChevronRightIcon className="w-4 h-4 text-gray-400" />
            </div>

            {/* Subscriptions */}
            <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg cursor-pointer hover:shadow-md transition-shadow"
                 onClick={() => toast.info('View subscriber list: Coming soon!')}>
              <div className="p-3 bg-gradient-to-r from-purple-100 to-pink-100 rounded-lg">
                <UsersIcon className="w-6 h-6 text-purple-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-600">Subscriptions</p>
                <p className="text-lg font-semibold text-gray-900">{earningsData.breakdown.subscriptions}</p>
                <p className="text-xs text-gray-500">{formatCurrency(earningsData.breakdown.subscriptions)}</p>
              </div>
              <ChevronRightIcon className="w-4 h-4 text-gray-400" />
            </div>

            {/* Content */}
            <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg cursor-pointer hover:shadow-md transition-shadow"
                 onClick={() => toast.info('View content buyers: Coming soon!')}>
              <div className="p-3 bg-gradient-to-r from-purple-100 to-pink-100 rounded-lg">
                <DocumentTextIcon className="w-6 h-6 text-purple-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-600">Content</p>
                <p className="text-lg font-semibold text-gray-900">{earningsData.breakdown.content}</p>
                <p className="text-xs text-gray-500">{formatCurrency(earningsData.breakdown.content)}</p>
              </div>
              <ChevronRightIcon className="w-4 h-4 text-gray-400" />
            </div>

            {/* Messages */}
            <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg cursor-pointer hover:shadow-md transition-shadow"
                 onClick={() => toast.info('View message earnings: Coming soon!')}>
              <div className="p-3 bg-gradient-to-r from-purple-100 to-pink-100 rounded-lg">
                <ChatBubbleLeftRightIcon className="w-6 h-6 text-purple-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-600">Messages</p>
                <p className="text-lg font-semibold text-gray-900">{earningsData.breakdown.messages}</p>
                <p className="text-xs text-gray-500">{formatCurrency(earningsData.breakdown.messages)}</p>
              </div>
              <ChevronRightIcon className="w-4 h-4 text-gray-400" />
            </div>

            {/* Live Streams */}
            <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg cursor-pointer hover:shadow-md transition-shadow"
                 onClick={() => toast.info('View stream supporters: Coming soon!')}>
              <div className="p-3 bg-gradient-to-r from-purple-100 to-pink-100 rounded-lg">
                <SignalIcon className="w-6 h-6 text-purple-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-600">Private Streams</p>
                <p className="text-lg font-semibold text-gray-900">{earningsData.breakdown.liveStreams}</p>
                <p className="text-xs text-gray-500">{formatCurrency(earningsData.breakdown.liveStreams)}</p>
              </div>
              <ChevronRightIcon className="w-4 h-4 text-gray-400" />
            </div>

            {/* Video Calls */}
            <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg cursor-pointer hover:shadow-md transition-shadow"
                 onClick={() => toast.info('View video call fans: Coming soon!')}>
              <div className="p-3 bg-gradient-to-r from-purple-100 to-pink-100 rounded-lg">
                <VideoCameraIcon className="w-6 h-6 text-purple-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-600">Video Calls</p>
                <p className="text-lg font-semibold text-gray-900">{earningsData.breakdown.videoCalls}</p>
                <p className="text-xs text-gray-500">{formatCurrency(earningsData.breakdown.videoCalls)}</p>
              </div>
              <ChevronRightIcon className="w-4 h-4 text-gray-400" />
            </div>

            {/* Voice Calls */}
            <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg cursor-pointer hover:shadow-md transition-shadow"
                 onClick={() => toast.info('View voice call fans: Coming soon!')}>
              <div className="p-3 bg-gradient-to-r from-purple-100 to-pink-100 rounded-lg">
                <PhoneIcon className="w-6 h-6 text-purple-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-600">Voice Calls</p>
                <p className="text-lg font-semibold text-gray-900">{earningsData.breakdown.voiceCalls}</p>
                <p className="text-xs text-gray-500">{formatCurrency(earningsData.breakdown.voiceCalls)}</p>
              </div>
              <ChevronRightIcon className="w-4 h-4 text-gray-400" />
            </div>
          </div>
        </div>

        {/* Top Earning Days */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Earning Days</h3>
          <div className="space-y-3">
            {earningsData.topEarningDays.map((day, index) => (
              <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold
                    ${index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : 'bg-orange-600'}`}>
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {new Date(day.date).toLocaleDateString('en-US', { 
                        weekday: 'short', 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </p>
                    <p className="text-sm text-gray-600">{day.reason}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900">{day.amount} tokens</p>
                  <p className="text-sm text-gray-600">{formatCurrency(day.amount)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderRedeemTab = () => {
    const handleRedeem = (experience) => {
      setSelectedExperience(experience);
      setShowRedeemModal(true);
    };

    // Map experiences to match EnhancedRedeemTab format
    const mappedExperiences = experiences.map(exp => ({
      ...exp,
      title: exp.name,
      bio: exp.description,
      redeemTokenCost: exp.tokensRequired,
      pictureBanner: exp.image
    }));

    return (
      <EnhancedRedeemTab 
        walletData={walletData}
        experiences={mappedExperiences}
        onRedeem={handleRedeem}
        isAdmin={isAdmin}
      />
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
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">Account Name</span>
              <span className="text-sm font-medium text-gray-900">{bankAccount.accountName}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">Account Number</span>
              <span className="text-sm font-medium text-gray-900">{bankAccount.accountNumber}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
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


  const tabs = [
    { id: 'earnings', label: 'Earnings', icon: '📊', count: earningsData?.totalEarnings || 0 },
    ...(isCreator ? [
      { id: 'withdrawals', label: 'Withdrawals', icon: '💰', count: withdrawalHistory.length }
    ] : [])
  ];


  return (
    <div className="space-y-6">

      {/* Tab Navigation */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-1 mb-6">
        <div className="flex space-x-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-3.5 px-4 rounded-lg font-medium text-sm transition-all duration-200 ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md transform scale-[1.02]'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <span className="text-xl">{tab.icon}</span>
              <span className="font-semibold">{tab.label}</span>
              {tab.count > 0 && (
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  activeTab === tab.id 
                    ? 'bg-white/20 text-white' 
                    : 'bg-purple-100 text-purple-700'
                }`}>
                  {tab.id === 'earnings' ? tab.count.toLocaleString() : tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'earnings' && renderEarningsTab()}
      {activeTab === 'withdrawals' && renderWithdrawalsTab()}


      {/* Bank Account Setup Modal */}
      {showBankSetup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto"
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

      {/* Redeem Experience Modal */}
      {showRedeemModal && selectedExperience && (
        <AnimatePresence>
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-xl max-w-md w-full overflow-hidden"
            >
              <div className="relative h-48">
                <img src={selectedExperience.image} alt={selectedExperience.name} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <button
                  onClick={() => {
                    setShowRedeemModal(false);
                    setSelectedExperience(null);
                  }}
                  className="absolute top-4 right-4 p-2 bg-white/20 backdrop-blur-sm rounded-full text-white hover:bg-white/30"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <div className="absolute bottom-4 left-4 text-white">
                  <h3 className="text-2xl font-bold">{selectedExperience.name}</h3>
                  <p className="flex items-center gap-2 mt-1">
                    <MapPinIcon className="w-4 h-4" />
                    {selectedExperience.location}
                  </p>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div className="bg-purple-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">Token Cost</span>
                    <span className="text-2xl font-bold text-purple-600">{selectedExperience.tokensRequired.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Your Balance</span>
                    <span className="text-lg font-semibold text-gray-900">{walletData.tokens.toLocaleString()}</span>
                  </div>
                </div>

                <p className="text-gray-700">{selectedExperience.description}</p>

                <div className="border-t pt-4">
                  <p className="text-sm text-gray-600 mb-4">
                    By redeeming, you agree to the terms and conditions. This action cannot be undone.
                  </p>
                  <div className="flex space-x-3">
                    <button
                      onClick={() => {
                        setShowRedeemModal(false);
                        setSelectedExperience(null);
                      }}
                      className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        setActionLoading(true);
                        // Simulate API call
                        await new Promise(resolve => setTimeout(resolve, 2000));
                        // toast.success(`Successfully redeemed ${selectedExperience.name}! Check your email for details.`);
                        setShowRedeemModal(false);
                        setSelectedExperience(null);
                        setActionLoading(false);
                        // In real app, this would update token balance
                        setWalletData(prev => ({
                          ...prev,
                          tokens: prev.tokens - selectedExperience.tokensRequired
                        }));
                      }}
                      disabled={actionLoading}
                      className="flex-1 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:shadow-lg disabled:bg-gray-300"
                    >
                      {actionLoading ? 'Redeeming...' : 'Redeem Experience'}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </AnimatePresence>
      )}
    </div>
  );
};

export default Wallet;