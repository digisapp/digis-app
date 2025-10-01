import React, { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ExclamationTriangleIcon,
  WifiIcon,
  ArrowPathIcon,
  InformationCircleIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';

/**
 * Consistent error state component
 */
export const MobileErrorState = memo(({ 
  error, 
  onRetry, 
  title = 'Something went wrong',
  compact = false 
}) => {
  const isOffline = !navigator.onLine || error?.status === 0;
  
  return (
    <motion.div 
      className={`mobile-error-state ${compact ? 'compact' : ''}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <div className="error-icon">
        {isOffline ? (
          <WifiIcon className="w-12 h-12 text-yellow-500" />
        ) : (
          <ExclamationTriangleIcon className="w-12 h-12 text-red-500" />
        )}
      </div>
      
      <h3 className="error-title">
        {isOffline ? "You're offline" : title}
      </h3>
      
      <p className="error-message">
        {isOffline 
          ? 'Check your connection and try again'
          : error?.message || 'An unexpected error occurred'}
      </p>
      
      {onRetry && (
        <button 
          onClick={onRetry}
          className="error-retry-button"
          aria-label="Retry loading"
        >
          <ArrowPathIcon className="w-5 h-5" />
          <span>Try Again</span>
        </button>
      )}

      <style jsx>{`
        .mobile-error-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
          text-align: center;
          min-height: 200px;
        }

        .mobile-error-state.compact {
          padding: 20px;
          min-height: auto;
        }

        .error-icon {
          margin-bottom: 16px;
        }

        .error-title {
          font-size: 18px;
          font-weight: 600;
          color: var(--fg-primary, #1f2937);
          margin-bottom: 8px;
        }

        .error-message {
          font-size: 14px;
          color: var(--fg-secondary, #6b7280);
          margin-bottom: 20px;
          max-width: 280px;
        }

        .error-retry-button {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          background: var(--brand-gradient);
          color: white;
          border: none;
          border-radius: var(--radius-lg);
          font-weight: 600;
          font-size: 14px;
          transition: transform 0.2s;
        }

        .error-retry-button:active {
          transform: scale(0.95);
        }
      `}</style>
    </motion.div>
  );
});

/**
 * Empty state component
 */
export const MobileEmptyState = memo(({ 
  icon: Icon,
  title,
  message,
  action,
  actionLabel,
  compact = false
}) => {
  return (
    <motion.div 
      className={`mobile-empty-state ${compact ? 'compact' : ''}`}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
    >
      {Icon && (
        <div className="empty-icon">
          <Icon className="w-16 h-16 text-gray-300" />
        </div>
      )}
      
      <h3 className="empty-title">{title}</h3>
      
      {message && (
        <p className="empty-message">{message}</p>
      )}
      
      {action && (
        <button 
          onClick={action}
          className="empty-action-button"
        >
          {actionLabel}
        </button>
      )}

      <style jsx>{`
        .mobile-empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 20px;
          text-align: center;
        }

        .mobile-empty-state.compact {
          padding: 30px 20px;
        }

        .empty-icon {
          margin-bottom: 20px;
        }

        .empty-title {
          font-size: 18px;
          font-weight: 600;
          color: var(--fg-primary, #1f2937);
          margin-bottom: 8px;
        }

        .empty-message {
          font-size: 14px;
          color: var(--fg-secondary, #6b7280);
          margin-bottom: 24px;
          max-width: 280px;
        }

        .empty-action-button {
          padding: 12px 24px;
          background: var(--brand-gradient);
          color: white;
          border: none;
          border-radius: var(--radius-lg);
          font-weight: 600;
          font-size: 14px;
        }
      `}</style>
    </motion.div>
  );
});

/**
 * Skeleton loading placeholder
 */
export const MobileSkeleton = memo(({ 
  count = 3, 
  type = 'list',
  height = 80
}) => {
  const items = Array.from({ length: count }, (_, i) => i);
  
  return (
    <div className="mobile-skeleton-container">
      {items.map(i => (
        <div 
          key={i}
          className={`skeleton-item skeleton-${type}`}
          style={{ height: `${height}px` }}
        >
          {type === 'list' && (
            <>
              <div className="skeleton-avatar" />
              <div className="skeleton-content">
                <div className="skeleton-line skeleton-title" />
                <div className="skeleton-line skeleton-subtitle" />
              </div>
            </>
          )}
          {type === 'card' && (
            <>
              <div className="skeleton-image" />
              <div className="skeleton-text">
                <div className="skeleton-line" style={{ width: '70%' }} />
                <div className="skeleton-line" style={{ width: '50%' }} />
              </div>
            </>
          )}
        </div>
      ))}

      <style jsx>{`
        .mobile-skeleton-container {
          padding: 20px;
        }

        .skeleton-item {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
          animation: skeleton-pulse 2s infinite;
        }

        .skeleton-list {
          padding: 16px 0;
          border-bottom: 1px solid #f3f4f6;
        }

        .skeleton-card {
          flex-direction: column;
          background: white;
          border-radius: var(--radius-lg);
          padding: 16px;
          margin-bottom: 16px;
        }

        .skeleton-avatar {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: linear-gradient(90deg, #f3f4f6 0%, #e5e7eb 50%, #f3f4f6 100%);
          background-size: 200% 100%;
          flex-shrink: 0;
        }

        .skeleton-image {
          width: 100%;
          height: 160px;
          border-radius: var(--radius-md);
          background: linear-gradient(90deg, #f3f4f6 0%, #e5e7eb 50%, #f3f4f6 100%);
          background-size: 200% 100%;
          margin-bottom: 12px;
        }

        .skeleton-content {
          flex: 1;
        }

        .skeleton-text {
          width: 100%;
        }

        .skeleton-line {
          height: 12px;
          background: linear-gradient(90deg, #f3f4f6 0%, #e5e7eb 50%, #f3f4f6 100%);
          background-size: 200% 100%;
          border-radius: 6px;
          margin-bottom: 8px;
        }

        .skeleton-title {
          width: 60%;
          height: 14px;
        }

        .skeleton-subtitle {
          width: 40%;
          height: 10px;
        }

        @keyframes skeleton-pulse {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
});

/**
 * Info banner for tips and notifications
 */
export const MobileInfoBanner = memo(({ 
  type = 'info',
  message,
  action,
  actionLabel,
  dismissible = true,
  onDismiss
}) => {
  const icons = {
    info: InformationCircleIcon,
    success: CheckCircleIcon,
    warning: ExclamationTriangleIcon,
    offline: WifiIcon
  };
  
  const Icon = icons[type];
  
  return (
    <AnimatePresence>
      <motion.div 
        className={`mobile-info-banner banner-${type}`}
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
      >
        <Icon className="banner-icon" />
        <span className="banner-message">{message}</span>
        
        {action && (
          <button 
            onClick={action}
            className="banner-action"
            aria-label={actionLabel}
          >
            {actionLabel}
          </button>
        )}
        
        {dismissible && onDismiss && (
          <button 
            onClick={onDismiss}
            className="banner-dismiss"
            aria-label="Dismiss"
          >
            ×
          </button>
        )}

        <style jsx>{`
          .mobile-info-banner {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px 16px;
            margin: 0 16px 16px;
            border-radius: var(--radius-md);
            font-size: 14px;
            overflow: hidden;
          }

          .banner-info {
            background: #dbeafe;
            color: #1e40af;
          }

          .banner-success {
            background: #d1fae5;
            color: #065f46;
          }

          .banner-warning {
            background: #fed7aa;
            color: #92400e;
          }

          .banner-offline {
            background: #fef3c7;
            color: #92400e;
          }

          .banner-icon {
            width: 20px;
            height: 20px;
            flex-shrink: 0;
          }

          .banner-message {
            flex: 1;
            font-weight: 500;
          }

          .banner-action {
            padding: 4px 12px;
            background: rgba(0, 0, 0, 0.1);
            border: none;
            border-radius: var(--radius-sm);
            font-weight: 600;
            font-size: 12px;
          }

          .banner-dismiss {
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: transparent;
            border: none;
            font-size: 20px;
            opacity: 0.6;
          }
        `}</style>
      </motion.div>
    </AnimatePresence>
  );
});

MobileErrorState.displayName = 'MobileErrorState';
MobileEmptyState.displayName = 'MobileEmptyState';
MobileSkeleton.displayName = 'MobileSkeleton';
MobileInfoBanner.displayName = 'MobileInfoBanner';

export default {
  MobileErrorState,
  MobileEmptyState,
  MobileSkeleton,
  MobileInfoBanner
};