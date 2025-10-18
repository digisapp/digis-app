/**
 * Creator Overview Cards Component
 *
 * Displays aggregated creator metrics in a dashboard grid layout.
 * Uses the /api/v1/creators/overview endpoint with React Query caching.
 *
 * Features:
 * - Real-time data with auto-refresh
 * - Loading skeletons
 * - Error states with retry
 * - Responsive grid layout
 * - Animated cards with Framer Motion
 * - Format helpers for currency and numbers
 *
 * @example
 * import CreatorOverviewCards from './components/CreatorOverviewCards';
 * <CreatorOverviewCards />
 *
 * @example
 * // With time range filter (last 30 days)
 * <CreatorOverviewCards days={30} />
 */

import React from 'react';
import { motion } from 'framer-motion';
import PropTypes from 'prop-types';
import {
  CurrencyDollarIcon,
  UserGroupIcon,
  HeartIcon,
  VideoCameraIcon,
  ChatBubbleLeftRightIcon,
  PhotoIcon,
  ChartBarIcon,
  BanknotesIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { useCreatorOverview, useCreatorOverviewLastDays, formatters } from '../hooks/useCreatorOverview';
import Card from './ui/Card';
import Button from './ui/Button';

/**
 * Metric card component
 */
const MetricCard = ({ title, value, subtitle, icon: Icon, color = 'blue', loading = false }) => {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    pink: 'bg-pink-50 text-pink-600',
    orange: 'bg-orange-50 text-orange-600',
    indigo: 'bg-indigo-50 text-indigo-600',
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div className="flex-1 space-y-3">
            <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
            <div className="h-8 w-32 animate-pulse rounded bg-gray-200" />
            {subtitle && <div className="h-3 w-20 animate-pulse rounded bg-gray-200" />}
          </div>
          <div className="h-12 w-12 animate-pulse rounded-xl bg-gray-200" />
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:shadow-md"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{value ?? '—'}</p>
          {subtitle && (
            <p className="mt-1 text-xs text-gray-500">{subtitle}</p>
          )}
        </div>
        {Icon && (
          <div className={`rounded-xl p-3 ${colorClasses[color] || colorClasses.blue}`}>
            <Icon className="h-6 w-6" />
          </div>
        )}
      </div>
    </motion.div>
  );
};

MetricCard.propTypes = {
  title: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  subtitle: PropTypes.string,
  icon: PropTypes.elementType,
  color: PropTypes.oneOf(['blue', 'green', 'purple', 'pink', 'orange', 'indigo']),
  loading: PropTypes.bool,
};

/**
 * Error state component
 */
const ErrorState = ({ error, unauthorized, notFound, onRetry }) => {
  if (unauthorized) {
    return (
      <Card className="p-8 text-center">
        <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-red-500" />
        <h3 className="mt-4 text-lg font-semibold text-gray-900">Authentication Required</h3>
        <p className="mt-2 text-sm text-gray-600">
          Please sign in to view your creator dashboard.
        </p>
        <Button
          onClick={() => window.location.href = '/login'}
          className="mt-4"
          variant="primary"
        >
          Sign In
        </Button>
      </Card>
    );
  }

  if (notFound) {
    return (
      <Card className="p-8 text-center">
        <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-amber-500" />
        <h3 className="mt-4 text-lg font-semibold text-gray-900">Profile Not Found</h3>
        <p className="mt-2 text-sm text-gray-600">
          We couldn't find your creator profile. Try signing in again to sync your account.
        </p>
        <Button
          onClick={onRetry}
          className="mt-4"
          variant="secondary"
        >
          Retry
        </Button>
      </Card>
    );
  }

  return (
    <Card className="p-8 text-center">
      <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-gray-400" />
      <h3 className="mt-4 text-lg font-semibold text-gray-900">Failed to Load Dashboard</h3>
      <p className="mt-2 text-sm text-gray-600">
        {error?.message || 'An error occurred while loading your dashboard data.'}
      </p>
      <Button
        onClick={onRetry}
        className="mt-4"
        variant="secondary"
      >
        <ArrowPathIcon className="mr-2 h-4 w-4" />
        Try Again
      </Button>
    </Card>
  );
};

ErrorState.propTypes = {
  error: PropTypes.object,
  unauthorized: PropTypes.bool,
  notFound: PropTypes.bool,
  onRetry: PropTypes.func.isRequired,
};

/**
 * Main component
 */
const CreatorOverviewCards = ({ days = null, showRefreshButton = true, className = '' }) => {
  // Use the appropriate hook based on whether days filter is provided
  const hook = days
    ? useCreatorOverviewLastDays(days)
    : useCreatorOverview();

  const { data, isLoading, isError, error, unauthorized, notFound, refetch, isFetching } = hook;

  // Show error state
  if (isError) {
    return (
      <ErrorState
        error={error}
        unauthorized={unauthorized}
        notFound={notFound}
        onRetry={refetch}
      />
    );
  }

  // Loading skeleton
  if (isLoading) {
    return (
      <div className={`space-y-6 ${className}`}>
        {showRefreshButton && (
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">Creator Overview</h2>
            <div className="h-10 w-24 animate-pulse rounded-lg bg-gray-200" />
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <MetricCard key={i} loading />
          ))}
        </div>
      </div>
    );
  }

  const overview = data || {};
  const { number, usd, usdCompact, duration } = formatters;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header with refresh button */}
      {showRefreshButton && (
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Creator Overview</h2>
            {days && (
              <p className="mt-1 text-sm text-gray-500">Last {days} days</p>
            )}
          </div>
          <Button
            onClick={() => refetch()}
            disabled={isFetching}
            variant="secondary"
            size="sm"
            className="flex items-center gap-2"
          >
            <ArrowPathIcon className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Row 1: Key Financial Metrics */}
        <MetricCard
          title="Creator Tokens"
          value={number(overview.balances?.creator_tokens)}
          icon={CurrencyDollarIcon}
          color="green"
        />
        <MetricCard
          title="Total Earnings"
          value={usd(overview.earnings?.total_cents)}
          subtitle={`${number(overview.earnings?.count)} transactions`}
          icon={BanknotesIcon}
          color="blue"
        />
        <MetricCard
          title="Total Payouts"
          value={usd(overview.payouts?.total_cents)}
          subtitle={`${number(overview.payouts?.completed_count)} completed`}
          icon={BanknotesIcon}
          color="purple"
        />
        <MetricCard
          title="Tips Received"
          value={usd(overview.tips?.total_cents)}
          subtitle={`${number(overview.tips?.count)} tips`}
          icon={HeartIcon}
          color="pink"
        />

        {/* Row 2: Audience Metrics */}
        <MetricCard
          title="Followers"
          value={number(overview.relationships?.followers)}
          icon={UserGroupIcon}
          color="indigo"
        />
        <MetricCard
          title="Subscribers"
          value={number(overview.relationships?.active_subscribers)}
          subtitle={`${number(overview.relationships?.subscribers)} total`}
          icon={UserGroupIcon}
          color="purple"
        />
        <MetricCard
          title="Content Uploads"
          value={number(overview.content?.uploads)}
          subtitle={`${number(overview.content?.sales_count)} sales • ${usdCompact(overview.content?.sales_cents)}`}
          icon={PhotoIcon}
          color="orange"
        />
        <MetricCard
          title="Profile Views"
          value={number(overview.analytics?.views)}
          subtitle={`${number(overview.analytics?.impressions)} impressions`}
          icon={ChartBarIcon}
          color="blue"
        />

        {/* Row 3: Streaming & Sessions */}
        <MetricCard
          title="Live Streams"
          value={number(overview.streams?.live_count)}
          subtitle={`${number(overview.streams?.upcoming_count)} upcoming`}
          icon={VideoCameraIcon}
          color="pink"
        />
        <MetricCard
          title="Stream Revenue"
          value={usd(overview.streams?.revenue_cents)}
          subtitle={`${number(overview.streams?.total_viewers)} total viewers`}
          icon={CurrencyDollarIcon}
          color="green"
        />
        <MetricCard
          title="Video/Voice Calls"
          value={number(overview.sessions?.total)}
          subtitle={duration(overview.sessions?.total_seconds)}
          icon={VideoCameraIcon}
          color="blue"
        />
        <MetricCard
          title="Call Earnings"
          value={usd(overview.sessions?.earnings_cents)}
          icon={BanknotesIcon}
          color="green"
        />

        {/* Row 4: Messaging */}
        <MetricCard
          title="Direct Messages"
          value={number(overview.messaging?.direct_messages)}
          icon={ChatBubbleLeftRightIcon}
          color="indigo"
        />
        <MetricCard
          title="Stream Chat"
          value={number(overview.messaging?.chat_messages)}
          icon={ChatBubbleLeftRightIcon}
          color="purple"
        />
        <MetricCard
          title="PPV Messages"
          value={number(overview.messaging?.ppv_messages?.count)}
          subtitle={usd(overview.messaging?.ppv_messages?.total_cents)}
          icon={ChatBubbleLeftRightIcon}
          color="orange"
        />
        <MetricCard
          title="Total Payments"
          value={usd(overview.payments?.total_cents)}
          subtitle={`${number(overview.payments?.count)} transactions`}
          icon={CurrencyDollarIcon}
          color="green"
        />
      </div>

      {/* Metadata */}
      {overview.meta?.generatedAt && (
        <p className="text-center text-xs text-gray-400">
          Last updated: {new Date(overview.meta.generatedAt).toLocaleString()}
        </p>
      )}
    </div>
  );
};

CreatorOverviewCards.propTypes = {
  days: PropTypes.number,
  showRefreshButton: PropTypes.bool,
  className: PropTypes.string,
};

export default CreatorOverviewCards;
