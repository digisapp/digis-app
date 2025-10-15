import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import { motion } from 'framer-motion';
import {
  WalletIcon,
  PlusIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  CurrencyDollarIcon,
  SparklesIcon,
  ExclamationCircleIcon
} from '@heroicons/react/24/outline';
import { useMobileUI } from '../MobileUIProvider';
import { useApi, api } from '../../../utils/mobileApi';
import { MobileSkeleton, MobileErrorState } from '../MobileUIStates';
import {
  TOKEN_PAYOUT_USD_PER_TOKEN,
  TOKEN_USD_FORMAT,
  estimatePayoutUsd
} from '../../../config/wallet-config';

const MobileWalletPage = memo(({ user, navigateTo }) => {
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const { triggerHaptic } = useMobileUI();
  const { request, loading, error, setError } = useApi();
  const abortControllerRef = useRef(null);

  // Respect reduced motion with SSR guard
  const prefersReducedMotion = typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

  const fetchWalletData = useCallback(async () => {
    // Cancel previous request if still pending
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new AbortController
    abortControllerRef.current = new AbortController();

    try {
      const data = await request(
        api.tokens.balance(),
        { signal: abortControllerRef.current.signal }
      );

      setBalance(data.balance || 0);
      setTransactions(data.transactions || []);
      setHasMore(data.hasMore || false);
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Error fetching wallet data:', err);
      }
    }
  }, [request]);

  const loadMoreTransactions = useCallback(async () => {
    if (!hasMore || loading) return;

    try {
      const nextPage = page + 1;
      const data = await request(
        api.tokens.transactions(nextPage),
        { signal: abortControllerRef.current?.signal }
      );

      setTransactions(prev => [...prev, ...(data.transactions || [])]);
      setPage(nextPage);
      setHasMore(data.hasMore || false);
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Error loading more transactions:', err);
      }
    }
  }, [hasMore, loading, page, request]);

  useEffect(() => {
    fetchWalletData();

    // Cleanup on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchWalletData]);

  const handlePurchaseTokens = () => {
    triggerHaptic('light');
    navigateTo('token-purchase');
  };

  const handleSend = () => {
    triggerHaptic('light');
    navigateTo('send-tokens');
  };

  const handleRequest = () => {
    triggerHaptic('light');
    navigateTo('request-tokens');
  };

  const handleWithdraw = () => {
    triggerHaptic('light');
    navigateTo('withdraw');
  };

  const handleTransactionDetails = (tx) => {
    triggerHaptic('light');
    navigateTo('transaction-details', { transactionId: tx.id });
  };

  // Token to USD formatter
  const formatTokenValue = useCallback((tokens) => {
    return TOKEN_USD_FORMAT.format(tokens * TOKEN_PAYOUT_USD_PER_TOKEN);
  }, []);

  // Format date with timezone awareness
  const formatDate = useCallback((timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    // Less than 24 hours - show time
    if (diff < 86400000) {
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    }

    // Less than 7 days - show day
    if (diff < 604800000) {
      const days = Math.floor(diff / 86400000);
      return `${days} day${days > 1 ? 's' : ''} ago`;
    }

    // Otherwise show date
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  }, []);

  // Loading state with skeleton
  if (loading && !balance && transactions.length === 0) {
    return (
      <div className="mobile-wallet-page">
        <div className="mobile-wallet-header">
          <h1 className="text-2xl font-bold text-gray-900">Wallet</h1>
        </div>

        {/* Balance skeleton */}
        <div className="mobile-balance-card skeleton">
          <MobileSkeleton type="text" width="100px" />
          <MobileSkeleton type="text" width="150px" height="36px" />
          <MobileSkeleton type="button" />
        </div>

        {/* Actions skeleton */}
        <div className="mobile-quick-actions">
          <MobileSkeleton type="button" width="80px" height="70px" />
          <MobileSkeleton type="button" width="80px" height="70px" />
          <MobileSkeleton type="button" width="80px" height="70px" />
        </div>

        {/* Transactions skeleton */}
        <div className="mobile-transactions">
          <MobileSkeleton type="text" width="150px" />
          <MobileSkeleton count={3} type="list" />
        </div>
      </div>
    );
  }

  // Error state
  if (error && !balance && transactions.length === 0) {
    return (
      <div className="mobile-wallet-page">
        <div className="mobile-wallet-header">
          <h1 className="text-2xl font-bold text-gray-900">Wallet</h1>
        </div>
        <MobileErrorState
          error={error}
          onRetry={fetchWalletData}
          message="Unable to load wallet data"
        />
      </div>
    );
  }

  const motionProps = prefersReducedMotion ? {} : {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 }
  };

  const itemMotionProps = (index) => prefersReducedMotion ? {} : {
    initial: { opacity: 0, x: -20 },
    animate: { opacity: 1, x: 0 },
    transition: { delay: Math.min(index * 0.03, 0.3) }
  };

  return (
    <div className="mobile-wallet-page">
      {/* Header */}
      <div className="mobile-wallet-header">
        <h1 className="text-2xl font-bold text-gray-900">Wallet</h1>
      </div>

      {/* Balance Card */}
      <motion.div
        className="mobile-balance-card"
        {...motionProps}
      >
        <div className="mobile-balance-label">Token Balance</div>
        <div className="mobile-balance-amount">
          <SparklesIcon className="w-8 h-8" aria-hidden="true" />
          <span>{balance.toLocaleString()}</span>
        </div>
        <div className="mobile-balance-usd">{formatTokenValue(balance)}</div>
        <motion.button
          onClick={handlePurchaseTokens}
          className="mobile-purchase-button"
          whileTap={!prefersReducedMotion ? { scale: 0.95 } : {}}
          aria-label="Purchase tokens"
        >
          <PlusIcon className="w-5 h-5" aria-hidden="true" />
          Buy Tokens
        </motion.button>
      </motion.div>

      {/* Quick Actions */}
      <div className="mobile-quick-actions">
        <motion.button
          className="mobile-action-button"
          onClick={handleSend}
          whileTap={!prefersReducedMotion ? { scale: 0.95 } : {}}
          aria-label="Send tokens"
        >
          <ArrowUpIcon className="w-5 h-5" aria-hidden="true" />
          <span>Send</span>
        </motion.button>
        <motion.button
          className="mobile-action-button"
          onClick={handleRequest}
          whileTap={!prefersReducedMotion ? { scale: 0.95 } : {}}
          aria-label="Request tokens"
        >
          <ArrowDownIcon className="w-5 h-5" aria-hidden="true" />
          <span>Request</span>
        </motion.button>
        <motion.button
          className="mobile-action-button"
          onClick={handleWithdraw}
          whileTap={!prefersReducedMotion ? { scale: 0.95 } : {}}
          aria-label="Withdraw funds"
        >
          <CurrencyDollarIcon className="w-5 h-5" aria-hidden="true" />
          <span>Withdraw</span>
        </motion.button>
      </div>

      {/* Transactions */}
      <div className="mobile-transactions">
        <h2 className="text-lg font-semibold text-gray-900">Recent Transactions</h2>
        {error && transactions.length === 0 ? (
          <div className="mobile-error-inline">
            <ExclamationCircleIcon className="w-12 h-12 text-red-400" />
            <p className="text-red-600 mt-2">Failed to load transactions</p>
            <button
              onClick={fetchWalletData}
              className="mobile-retry-button"
            >
              Retry
            </button>
          </div>
        ) : transactions.length === 0 ? (
          <div className="mobile-empty-transactions">
            <WalletIcon className="w-12 h-12 text-gray-300" />
            <p className="text-gray-500 mt-2">No transactions yet</p>
          </div>
        ) : (
          <>
            {transactions.map((tx, index) => (
              <motion.div
                key={tx.id}
                className="mobile-transaction-item"
                onClick={() => handleTransactionDetails(tx)}
                {...itemMotionProps(index)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleTransactionDetails(tx);
                  }
                }}
                aria-label={`Transaction: ${tx.description}, ${tx.type === 'credit' ? 'received' : 'sent'} ${tx.amount} tokens`}
              >
                <div className={`mobile-tx-icon ${tx.type === 'credit' ? 'credit' : 'debit'}`}>
                  {tx.type === 'credit' ?
                    <ArrowDownIcon aria-hidden="true" /> :
                    <ArrowUpIcon aria-hidden="true" />
                  }
                </div>
                <div className="mobile-tx-details">
                  <div className="mobile-tx-title">{tx.description}</div>
                  <div className="mobile-tx-date">{formatDate(tx.timestamp)}</div>
                </div>
                <div className="mobile-tx-amounts">
                  <div className={`mobile-tx-amount ${tx.type === 'credit' ? 'credit' : 'debit'}`}>
                    {tx.type === 'credit' ? '+' : '-'}{tx.amount} tokens
                  </div>
                  <div className="mobile-tx-usd">
                    {formatTokenValue(tx.amount)}
                  </div>
                </div>
              </motion.div>
            ))}

            {/* Load more button */}
            {hasMore && (
              <button
                onClick={loadMoreTransactions}
                className="mobile-load-more-button"
                disabled={loading}
                aria-label="Load more transactions"
              >
                {loading ? (
                  <div className="mobile-spinner" />
                ) : (
                  'Load More'
                )}
              </button>
            )}
          </>
        )}
      </div>

      <style jsx>{`
        .mobile-wallet-page {
          min-height: 100vh;
          background: #f9fafb;
          padding-bottom: 80px;
        }

        .mobile-wallet-header {
          padding: 20px;
          background: white;
          border-bottom: 1px solid #e5e7eb;
        }


        .mobile-balance-card {
          margin: 20px;
          padding: 30px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 20px;
          color: white;
          text-align: center;
          box-shadow: 0 10px 30px rgba(102, 126, 234, 0.3);
        }

        .mobile-balance-card.skeleton {
          background: #e5e7eb;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 15px;
        }

        .mobile-balance-label {
          font-size: 14px;
          opacity: 0.9;
          margin-bottom: 10px;
        }

        .mobile-balance-amount {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          font-size: 36px;
          font-weight: bold;
          margin-bottom: 5px;
        }

        .mobile-balance-usd {
          font-size: 14px;
          opacity: 0.8;
          margin-bottom: 20px;
        }

        .mobile-purchase-button {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 12px 24px;
          background: white;
          color: #667eea;
          border: none;
          border-radius: 12px;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          transition: transform 0.15s;
        }

        .mobile-purchase-button:focus-visible {
          outline: 2px solid white;
          outline-offset: 2px;
        }

        .mobile-quick-actions {
          display: flex;
          justify-content: space-around;
          padding: 20px;
          background: white;
          margin-bottom: 10px;
        }

        .mobile-action-button {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          padding: 15px;
          background: #f9fafb;
          border: none;
          border-radius: 12px;
          color: #4b5563;
          font-size: 12px;
          font-weight: 500;
          min-width: 80px;
          cursor: pointer;
          transition: background-color 0.15s, transform 0.15s;
        }

        .mobile-action-button:hover {
          background: #f3f4f6;
        }

        .mobile-action-button:focus-visible {
          outline: 2px solid #667eea;
          outline-offset: 2px;
        }

        .mobile-transactions {
          padding: 20px;
          background: white;
        }


        .mobile-empty-transactions,
        .mobile-error-inline {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 40px;
          color: #9ca3af;
        }

        .mobile-retry-button {
          margin-top: 10px;
          padding: 8px 16px;
          background: #667eea;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
        }

        .mobile-transaction-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 15px 0;
          border-bottom: 1px solid #f3f4f6;
          cursor: pointer;
          transition: background-color 0.15s;
        }

        .mobile-transaction-item:hover {
          background: #f9fafb;
          margin: 0 -20px;
          padding: 15px 20px;
        }

        .mobile-transaction-item:focus-visible {
          outline: 2px solid #667eea;
          outline-offset: -2px;
          border-radius: 8px;
        }

        .mobile-tx-icon {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .mobile-tx-icon.credit {
          background: #dcfce7;
          color: #16a34a;
        }

        .mobile-tx-icon.debit {
          background: #fee2e2;
          color: #dc2626;
        }

        .mobile-tx-icon svg {
          width: 20px;
          height: 20px;
        }

        .mobile-tx-details {
          flex: 1;
        }

        .mobile-tx-title {
          font-weight: 500;
          color: #1f2937;
          margin-bottom: 2px;
        }

        .mobile-tx-date {
          font-size: 12px;
          color: #6b7280;
        }

        .mobile-tx-amounts {
          text-align: right;
        }

        .mobile-tx-amount {
          font-weight: 600;
          font-size: 14px;
        }

        .mobile-tx-amount.credit {
          color: #16a34a;
        }

        .mobile-tx-amount.debit {
          color: #dc2626;
        }

        .mobile-tx-usd {
          font-size: 11px;
          color: #6b7280;
          margin-top: 2px;
        }

        .mobile-load-more-button {
          width: 100%;
          padding: 12px;
          margin-top: 15px;
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          color: #4b5563;
          font-weight: 500;
          cursor: pointer;
          transition: background-color 0.15s;
        }

        .mobile-load-more-button:hover:not(:disabled) {
          background: #f3f4f6;
        }

        .mobile-load-more-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .mobile-spinner {
          width: 20px;
          height: 20px;
          border: 2px solid #e5e7eb;
          border-top-color: #667eea;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
          margin: 0 auto;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @media (prefers-reduced-motion: reduce) {
          .mobile-spinner {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
});

MobileWalletPage.displayName = 'MobileWalletPage';

export default MobileWalletPage;