import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../hooks/useTheme';
import {
  ChartBarIcon,
  UserGroupIcon,
  CurrencyDollarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  EyeIcon,
  ChatBubbleLeftRightIcon,
  GiftIcon,
  HeartIcon,
  StarIcon,
  TrophyIcon,
  CalendarIcon,
  ArrowPathIcon,
  DocumentChartBarIcon,
  UsersIcon,
  BanknotesIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';
import Button from './ui/Button';
import Card from './ui/Card';
import Badge from './ui/Badge';
import Select from './ui/Select';
import { getAuthToken } from '../utils/auth-helpers';

const CreatorAnalytics = ({ 
  user, 
  className = '' 
}) => {
  const { animations } = useTheme();
  const [analytics, setAnalytics] = useState({});
  const [subscriptionAnalytics, setSubscriptionAnalytics] = useState({});
  const [streamingAnalytics, setStreamingAnalytics] = useState({});
  const [selectedPeriod, setSelectedPeriod] = useState('30d');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  const periods = [
    { value: '24h', label: 'Last 24 Hours' },
    { value: '7d', label: 'Last 7 Days' },
    { value: '30d', label: 'Last 30 Days' },
    { value: '90d', label: 'Last 90 Days' }
  ];

  const tabs = [
    { id: 'overview', label: 'Overview', icon: ChartBarIcon },
    { id: 'subscriptions', label: 'Subscriptions', icon: TrophyIcon },
    { id: 'revenue', label: 'Revenue', icon: CurrencyDollarIcon },
    { id: 'engagement', label: 'Engagement', icon: HeartIcon },
    { id: 'streaming', label: 'Streaming', icon: EyeIcon }
  ];

  useEffect(() => {
    fetchAnalytics();
  }, [selectedPeriod]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const authToken = await getAuthToken();
      
      const [
        subscriptionResponse,
        giftStatsResponse,
        tipStatsResponse,
        pollStatsResponse
      ] = await Promise.all([
        fetch(`/subscriptions/analytics?period=${selectedPeriod}`, {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }),
        fetch(`/gifts/stats?period=${selectedPeriod}`, {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }),
        fetch(`/tips/stats?period=${selectedPeriod}`, {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }),
        fetch(`/polls/user/stats?period=${selectedPeriod}`, {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        })
      ]);

      const [subscriptionData, giftData, tipData, pollData] = await Promise.all([
        subscriptionResponse.ok ? subscriptionResponse.json() : { analytics: {} },
        giftStatsResponse.ok ? giftStatsResponse.json() : { stats: {} },
        tipStatsResponse.ok ? tipStatsResponse.json() : { stats: {} },
        pollStatsResponse.ok ? pollStatsResponse.json() : { stats: {} }
      ]);

      setSubscriptionAnalytics(subscriptionData.analytics || {});
      
      // Combine all analytics
      setAnalytics({
        gifts: giftData.stats || {},
        tips: tipData.stats || {},
        polls: pollData.stats || {},
        period: selectedPeriod
      });

      // Mock streaming analytics (would come from actual streaming service)
      setStreamingAnalytics({
        total_stream_time: 45.5, // hours
        average_viewers: 127,
        peak_viewers: 342,
        total_streams: 12,
        average_stream_duration: 3.8, // hours
        chat_messages: 2843,
        new_followers: 89,
        watch_time: 5742, // total hours watched
        retention_rate: 68.5 // percentage
      });

    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshAnalytics = async () => {
    setRefreshing(true);
    await fetchAnalytics();
    setRefreshing(false);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  const formatNumber = (num) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num?.toString() || '0';
  };

  const formatPercentage = (num) => {
    return `${(num || 0).toFixed(1)}%`;
  };

  const getGrowthIcon = (current, previous) => {
    if (current > previous) {
      return <ArrowTrendingUpIcon className="w-4 h-4 text-green-500" />;
    } else if (current < previous) {
      return <ArrowTrendingDownIcon className="w-4 h-4 text-red-500" />;
    }
    return null;
  };

  const MetricCard = ({ title, value, change, icon, color = 'primary', format = 'number' }) => {
    const formattedValue = format === 'currency' ? formatCurrency(value) :
                          format === 'percentage' ? formatPercentage(value) :
                          formatNumber(value);
    
    return (
      <Card className="p-6 hover:shadow-lg transition-shadow duration-300" role="region" aria-label={title}>
        <div className="flex items-center justify-between mb-4">
          <div className={`p-2 rounded-lg bg-${color}-100 dark:bg-${color}-900/30`} aria-hidden="true">
            {React.cloneElement(icon, { 
              className: `w-6 h-6 text-${color}-600 dark:text-${color}-400` 
            })}
          </div>
          {change && (
            <div 
              className={`flex items-center gap-1 text-sm ${
                change >= 0 ? 'text-green-600' : 'text-red-600'
              }`}
              aria-label={`${change >= 0 ? 'Increased' : 'Decreased'} by ${Math.abs(change)}%`}
            >
              {change >= 0 ? (
                <ArrowTrendingUpIcon className="w-4 h-4" aria-hidden="true" />
              ) : (
                <ArrowTrendingDownIcon className="w-4 h-4" aria-hidden="true" />
              )}
              {Math.abs(change)}%
            </div>
          )}
        </div>
        <div>
          <h3 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100" aria-label={`${title}: ${formattedValue}`}>
            {formattedValue}
          </h3>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
            {title}
          </p>
        </div>
      </Card>
    );
  };

  const SubscriptionBreakdown = () => {
    const { active_subscribers } = subscriptionAnalytics;
    if (!active_subscribers) return null;

    const total = active_subscribers.total || 0;
    const basic = active_subscribers.basic || 0;
    const premium = active_subscribers.premium || 0;
    const vip = active_subscribers.vip || 0;

    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <TrophyIcon className="w-5 h-5 text-primary-500" />
          Subscription Breakdown
        </h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="custom" className="bg-blue-100 text-blue-600">💎</Badge>
              <span className="font-medium">Basic</span>
            </div>
            <div className="text-right">
              <div className="font-semibold">{basic}</div>
              <div className="text-sm text-neutral-500">
                {total > 0 ? ((basic / total) * 100).toFixed(1) : 0}%
              </div>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="custom" className="bg-purple-100 text-purple-600">⭐</Badge>
              <span className="font-medium">Premium</span>
            </div>
            <div className="text-right">
              <div className="font-semibold">{premium}</div>
              <div className="text-sm text-neutral-500">
                {total > 0 ? ((premium / total) * 100).toFixed(1) : 0}%
              </div>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="custom" className="bg-yellow-100 text-yellow-600">👑</Badge>
              <span className="font-medium">VIP</span>
            </div>
            <div className="text-right">
              <div className="font-semibold">{vip}</div>
              <div className="text-sm text-neutral-500">
                {total > 0 ? ((vip / total) * 100).toFixed(1) : 0}%
              </div>
            </div>
          </div>
        </div>
      </Card>
    );
  };

  const RevenueChart = () => {
    const { revenue } = subscriptionAnalytics;
    const { received: tipRevenue } = analytics.tips || {};
    
    if (!revenue && !tipRevenue) return null;

    const subscriptionRevenue = revenue?.period_revenue || 0;
    const tipAmount = tipRevenue?.total_amount || 0;
    const totalRevenue = subscriptionRevenue + tipAmount;

    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <CurrencyDollarIcon className="w-5 h-5 text-green-500" />
          Revenue Sources
        </h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Subscriptions</span>
            <div className="text-right">
              <div className="font-semibold">{formatCurrency(subscriptionRevenue)}</div>
              <div className="text-xs text-neutral-500">
                {totalRevenue > 0 ? ((subscriptionRevenue / totalRevenue) * 100).toFixed(1) : 0}%
              </div>
            </div>
          </div>
          
          <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-2">
            <div 
              className="bg-primary-500 h-2 rounded-full"
              style={{ width: totalRevenue > 0 ? `${(subscriptionRevenue / totalRevenue) * 100}%` : '0%' }}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Tips</span>
            <div className="text-right">
              <div className="font-semibold">{formatCurrency(tipAmount)}</div>
              <div className="text-xs text-neutral-500">
                {totalRevenue > 0 ? ((tipAmount / totalRevenue) * 100).toFixed(1) : 0}%
              </div>
            </div>
          </div>
          
          <div 
            className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-2"
            role="progressbar"
            aria-valuenow={totalRevenue > 0 ? Math.round((tipAmount / totalRevenue) * 100) : 0}
            aria-valuemin="0"
            aria-valuemax="100"
            aria-label={`Tips revenue: ${totalRevenue > 0 ? Math.round((tipAmount / totalRevenue) * 100) : 0}%`}
          >
            <div 
              className="bg-green-500 h-2 rounded-full"
              style={{ width: totalRevenue > 0 ? `${(tipAmount / totalRevenue) * 100}%` : '0%' }}
            />
          </div>
          
          <div className="pt-4 border-t border-neutral-200 dark:border-neutral-700">
            <div className="flex items-center justify-between">
              <span className="font-semibold">Total Revenue</span>
              <span className="text-lg font-bold text-green-600" aria-label={`Total revenue: ${formatCurrency(totalRevenue)}`}>
                {formatCurrency(totalRevenue)}
              </span>
            </div>
          </div>
          <div id="revenue-chart-desc" className="sr-only">
            Revenue breakdown showing {formatCurrency(subscriptionRevenue)} from subscriptions ({totalRevenue > 0 ? Math.round((subscriptionRevenue / totalRevenue) * 100) : 0}%) 
            and {formatCurrency(tipAmount)} from tips ({totalRevenue > 0 ? Math.round((tipAmount / totalRevenue) * 100) : 0}%).
            Total revenue is {formatCurrency(totalRevenue)}.
          </div>
        </div>
      </Card>
    );
  };

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Subscribers"
          value={subscriptionAnalytics.active_subscribers?.total || 0}
          icon={<UserGroupIcon />}
          color="primary"
        />
        
        <MetricCard
          title="Monthly Revenue"
          value={subscriptionAnalytics.revenue?.monthly_recurring || 0}
          icon={<CurrencyDollarIcon />}
          color="green"
          format="currency"
        />
        
        <MetricCard
          title="Stream Views"
          value={streamingAnalytics.peak_viewers || 0}
          icon={<EyeIcon />}
          color="blue"
        />
        
        <MetricCard
          title="Engagement Rate"
          value={streamingAnalytics.retention_rate || 0}
          icon={<HeartIcon />}
          color="red"
          format="percentage"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SubscriptionBreakdown />
        <RevenueChart />
      </div>

      {/* Additional Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard
          title="Gifts Received"
          value={analytics.gifts?.received?.count || 0}
          icon={<GiftIcon />}
          color="purple"
        />
        
        <MetricCard
          title="Tips Received"
          value={analytics.tips?.received?.count || 0}
          icon={<BanknotesIcon />}
          color="yellow"
        />
        
        <MetricCard
          title="Polls Created"
          value={analytics.polls?.created?.count || 0}
          icon={<DocumentChartBarIcon />}
          color="indigo"
        />
      </div>
    </div>
  );

  const renderSubscriptions = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard
          title="Active Subscribers"
          value={subscriptionAnalytics.active_subscribers?.total || 0}
          icon={<UsersIcon />}
          color="primary"
        />
        
        <MetricCard
          title="New Subscribers"
          value={subscriptionAnalytics.growth?.new_subscribers || 0}
          icon={<ArrowTrendingUpIcon />}
          color="green"
        />
        
        <MetricCard
          title="Renewal Rate"
          value={subscriptionAnalytics.growth?.renewal_rate || 0}
          icon={<ArrowPathIcon />}
          color="blue"
          format="percentage"
        />
      </div>

      <SubscriptionBreakdown />

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Subscription Growth</h3>
        <div className="space-y-4">
          <div className="text-center p-8 text-neutral-500 dark:text-neutral-400">
            <ChartBarIcon className="w-12 h-12 mx-auto mb-2" />
            <p>Detailed subscription growth charts would be displayed here</p>
          </div>
        </div>
      </Card>
    </div>
  );

  const renderRevenue = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <MetricCard
          title="Total Revenue"
          value={(subscriptionAnalytics.revenue?.lifetime_revenue || 0) + (analytics.tips?.received?.total_amount || 0)}
          icon={<CurrencyDollarIcon />}
          color="green"
          format="currency"
        />
        
        <MetricCard
          title="Subscription Revenue"
          value={subscriptionAnalytics.revenue?.period_revenue || 0}
          icon={<TrophyIcon />}
          color="primary"
          format="currency"
        />
        
        <MetricCard
          title="Tips Revenue"
          value={analytics.tips?.received?.total_amount || 0}
          icon={<HeartIcon />}
          color="red"
          format="currency"
        />
        
        <MetricCard
          title="Gift Revenue"
          value={(analytics.gifts?.received?.total_value || 0) * 0.05}
          icon={<GiftIcon />}
          color="purple"
          format="currency"
        />
      </div>

      <RevenueChart />

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Revenue Trends</h3>
        <div className="text-center p-8 text-neutral-500 dark:text-neutral-400">
          <ArrowTrendingUpIcon className="w-12 h-12 mx-auto mb-2" />
          <p>Revenue trend charts would be displayed here</p>
        </div>
      </Card>
    </div>
  );

  const renderEngagement = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <MetricCard
          title="Chat Messages"
          value={streamingAnalytics.chat_messages || 0}
          icon={<ChatBubbleLeftRightIcon />}
          color="blue"
        />
        
        <MetricCard
          title="Gifts Sent"
          value={analytics.gifts?.received?.count || 0}
          icon={<GiftIcon />}
          color="purple"
        />
        
        <MetricCard
          title="Poll Votes"
          value={analytics.polls?.created?.total_votes_received || 0}
          icon={<DocumentChartBarIcon />}
          color="indigo"
        />
        
        <MetricCard
          title="New Followers"
          value={streamingAnalytics.new_followers || 0}
          icon={<UserGroupIcon />}
          color="green"
        />
      </div>

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Engagement Metrics</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Average Chat Messages per Stream</span>
            <span className="font-semibold">
              {streamingAnalytics.total_streams > 0 
                ? Math.round((streamingAnalytics.chat_messages || 0) / streamingAnalytics.total_streams)
                : 0}
            </span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Gifts per Stream</span>
            <span className="font-semibold">
              {streamingAnalytics.total_streams > 0 
                ? Math.round((analytics.gifts?.received?.count || 0) / streamingAnalytics.total_streams)
                : 0}
            </span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Tips per Stream</span>
            <span className="font-semibold">
              {streamingAnalytics.total_streams > 0 
                ? Math.round((analytics.tips?.received?.count || 0) / streamingAnalytics.total_streams)
                : 0}
            </span>
          </div>
        </div>
      </Card>
    </div>
  );

  const renderStreaming = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <MetricCard
          title="Total Stream Time"
          value={streamingAnalytics.total_stream_time || 0}
          icon={<CalendarIcon />}
          color="blue"
        />
        
        <MetricCard
          title="Average Viewers"
          value={streamingAnalytics.average_viewers || 0}
          icon={<EyeIcon />}
          color="green"
        />
        
        <MetricCard
          title="Peak Viewers"
          value={streamingAnalytics.peak_viewers || 0}
          icon={<ArrowTrendingUpIcon />}
          color="red"
        />
        
        <MetricCard
          title="Total Streams"
          value={streamingAnalytics.total_streams || 0}
          icon={<SparklesIcon />}
          color="purple"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Stream Performance</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Average Stream Duration</span>
              <span className="font-semibold">
                {streamingAnalytics.average_stream_duration || 0}h
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Total Watch Time</span>
              <span className="font-semibold">
                {formatNumber(streamingAnalytics.watch_time || 0)}h
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Viewer Retention</span>
              <span className="font-semibold">
                {formatPercentage(streamingAnalytics.retention_rate || 0)}
              </span>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Stream Quality</h3>
          <div className="text-center p-8 text-neutral-500 dark:text-neutral-400">
            <ChartBarIcon className="w-12 h-12 mx-auto mb-2" />
            <p>Stream quality metrics would be displayed here</p>
          </div>
        </Card>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-64 ${className}`} role="status" aria-live="polite" aria-busy="true">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500" aria-hidden="true"></div>
        <span className="sr-only">Loading analytics data...</span>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
            Creator Analytics
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400">
            Track your performance and growth
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            options={periods}
            className="min-w-[150px]"
          />
          
          <Button
            onClick={refreshAnalytics}
            loading={refreshing}
            icon={<ArrowPathIcon className="w-4 h-4" />}
            variant="outline"
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-neutral-200 dark:border-neutral-700">
        <div className="flex space-x-8 overflow-x-auto" role="tablist" aria-label="Analytics sections">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`tabpanel-${tab.id}`}
              id={`tab-${tab.id}`}
              tabIndex={activeTab === tab.id ? 0 : -1}
              className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
              }`}
            >
              <tab.icon className="w-4 h-4" aria-hidden="true" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          role="tabpanel"
          id={`tabpanel-${activeTab}`}
          aria-labelledby={`tab-${activeTab}`}
          tabIndex={0}
          initial={animations ? { opacity: 0, y: 20 } : {}}
          animate={animations ? { opacity: 1, y: 0 } : {}}
          exit={animations ? { opacity: 0, y: -20 } : {}}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'subscriptions' && renderSubscriptions()}
          {activeTab === 'revenue' && renderRevenue()}
          {activeTab === 'engagement' && renderEngagement()}
          {activeTab === 'streaming' && renderStreaming()}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default CreatorAnalytics;