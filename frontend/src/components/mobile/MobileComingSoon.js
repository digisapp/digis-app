import React, { memo, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  BellIcon,
  CheckCircleIcon,
  SparklesIcon,
  CalendarIcon,
  RocketLaunchIcon
} from '@heroicons/react/24/outline';
import '../../../styles/mobile-theme.css';

const MobileComingSoon = memo(({ 
  title,
  description,
  features = [],
  icon: Icon = RocketLaunchIcon,
  releaseDate,
  onNavigateBack,
  primaryAction,
  primaryActionLabel = 'Explore App'
}) => {
  const [notifyEnabled, setNotifyEnabled] = useState(false);
  const [email, setEmail] = useState('');
  
  const handleNotifyToggle = () => {
    setNotifyEnabled(!notifyEnabled);
    // Store preference in localStorage
    if (!notifyEnabled) {
      localStorage.setItem(`notify_${title.toLowerCase().replace(/\s+/g, '_')}`, 'true');
    } else {
      localStorage.removeItem(`notify_${title.toLowerCase().replace(/\s+/g, '_')}`);
    }
  };

  const handleEmailSubmit = (e) => {
    e.preventDefault();
    if (email) {
      // Store email for notifications
      localStorage.setItem('notify_email', email);
      setNotifyEnabled(true);
    }
  };

  return (
    <div className="mobile-coming-soon">
      <motion.div 
        className="coming-soon-content"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Icon */}
        <motion.div 
          className="coming-soon-icon"
          animate={{ 
            rotate: [0, 10, -10, 10, 0],
            scale: [1, 1.1, 1]
          }}
          transition={{ 
            duration: 2,
            repeat: Infinity,
            repeatDelay: 3
          }}
        >
          <Icon className="w-24 h-24" />
        </motion.div>

        {/* Title & Description */}
        <h1 className="coming-soon-title">{title}</h1>
        <p className="coming-soon-description">{description}</p>

        {/* Release Date */}
        {releaseDate && (
          <div className="coming-soon-release">
            <CalendarIcon className="w-5 h-5" />
            <span>Expected: {releaseDate}</span>
          </div>
        )}

        {/* Features Preview */}
        {features.length > 0 && (
          <div className="coming-soon-features">
            <h3 className="features-title">What you'll be able to do:</h3>
            <ul className="features-list">
              {features.map((feature, index) => (
                <motion.li 
                  key={index}
                  className="feature-item"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <SparklesIcon className="w-4 h-4 feature-icon" />
                  <span>{feature}</span>
                </motion.li>
              ))}
            </ul>
          </div>
        )}

        {/* Notification Option */}
        <div className="notification-section">
          <button
            onClick={handleNotifyToggle}
            className={`notify-button ${notifyEnabled ? 'active' : ''}`}
            type="button"
            aria-pressed={notifyEnabled}
          >
            {notifyEnabled ? (
              <>
                <CheckCircleIcon className="w-5 h-5" />
                <span>You'll be notified</span>
              </>
            ) : (
              <>
                <BellIcon className="w-5 h-5" />
                <span>Get notified when ready</span>
              </>
            )}
          </button>

          {/* Email subscription form */}
          {!notifyEnabled && (
            <form onSubmit={handleEmailSubmit} className="email-form">
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="email-input"
                aria-label="Email for notifications"
              />
              <button type="submit" className="email-submit">
                Subscribe
              </button>
            </form>
          )}
        </div>

        {/* Actions */}
        <div className="coming-soon-actions">
          <button 
            onClick={primaryAction || onNavigateBack}
            className="action-button primary"
            type="button"
          >
            {primaryActionLabel}
          </button>
          
          {onNavigateBack && primaryAction && (
            <button 
              onClick={onNavigateBack}
              className="action-button secondary"
              type="button"
            >
              Go Back
            </button>
          )}
        </div>

        {/* Beta Access Badge */}
        <div className="beta-badge">
          <span className="badge-text">🚀 Early Access Coming Soon</span>
        </div>
      </motion.div>

      <style jsx>{`
        .mobile-coming-soon {
          min-height: 100vh;
          background: var(--bg-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: var(--spacing-xl);
        }

        .coming-soon-content {
          max-width: 400px;
          width: 100%;
          text-align: center;
        }

        .coming-soon-icon {
          margin: 0 auto var(--spacing-3xl);
          width: 120px;
          height: 120px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--brand-gradient);
          border-radius: var(--radius-full);
          color: white;
        }

        .coming-soon-title {
          font-size: var(--font-size-3xl);
          font-weight: var(--font-weight-bold);
          color: var(--fg-primary);
          margin-bottom: var(--spacing-md);
        }

        .coming-soon-description {
          font-size: var(--font-size-lg);
          color: var(--fg-secondary);
          margin-bottom: var(--spacing-2xl);
          line-height: 1.6;
        }

        .coming-soon-release {
          display: inline-flex;
          align-items: center;
          gap: var(--spacing-sm);
          padding: var(--spacing-sm) var(--spacing-lg);
          background: var(--bg-tertiary);
          border-radius: var(--radius-full);
          color: var(--fg-secondary);
          font-size: var(--font-size-sm);
          margin-bottom: var(--spacing-3xl);
        }

        .coming-soon-features {
          background: var(--bg-secondary);
          border-radius: var(--radius-xl);
          padding: var(--spacing-2xl);
          margin-bottom: var(--spacing-3xl);
          text-align: left;
        }

        .features-title {
          font-size: var(--font-size-base);
          font-weight: var(--font-weight-semibold);
          color: var(--fg-primary);
          margin-bottom: var(--spacing-lg);
        }

        .features-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .feature-item {
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
          padding: var(--spacing-sm) 0;
          color: var(--fg-secondary);
          font-size: var(--font-size-sm);
        }

        .feature-icon {
          color: var(--brand-primary);
          flex-shrink: 0;
        }

        .notification-section {
          margin-bottom: var(--spacing-3xl);
        }

        .notify-button {
          display: inline-flex;
          align-items: center;
          gap: var(--spacing-sm);
          padding: var(--spacing-md) var(--spacing-2xl);
          background: var(--bg-secondary);
          border: 2px solid var(--bg-tertiary);
          border-radius: var(--radius-full);
          font-size: var(--font-size-base);
          font-weight: var(--font-weight-semibold);
          color: var(--fg-secondary);
          cursor: pointer;
          transition: all var(--transition-base);
          margin-bottom: var(--spacing-lg);
        }

        .notify-button.active {
          background: var(--success);
          border-color: var(--success);
          color: white;
        }

        .notify-button:hover {
          transform: translateY(-2px);
          box-shadow: var(--shadow-md);
        }

        .email-form {
          display: flex;
          gap: var(--spacing-sm);
          max-width: 300px;
          margin: 0 auto;
        }

        .email-input {
          flex: 1;
          padding: var(--spacing-md);
          background: var(--bg-secondary);
          border: 1px solid var(--bg-tertiary);
          border-radius: var(--radius-lg);
          font-size: var(--font-size-sm);
          color: var(--fg-primary);
        }

        .email-input:focus {
          outline: none;
          border-color: var(--brand-primary);
        }

        .email-submit {
          padding: var(--spacing-md) var(--spacing-lg);
          background: var(--brand-gradient);
          color: white;
          border: none;
          border-radius: var(--radius-lg);
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-semibold);
          cursor: pointer;
        }

        .coming-soon-actions {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-md);
          margin-bottom: var(--spacing-3xl);
        }

        .action-button {
          padding: var(--spacing-lg) var(--spacing-3xl);
          border-radius: var(--radius-lg);
          font-size: var(--font-size-base);
          font-weight: var(--font-weight-semibold);
          border: none;
          cursor: pointer;
          transition: all var(--transition-base);
        }

        .action-button.primary {
          background: var(--brand-gradient);
          color: white;
        }

        .action-button.secondary {
          background: var(--bg-tertiary);
          color: var(--fg-primary);
        }

        .action-button:hover {
          transform: translateY(-2px);
          box-shadow: var(--shadow-md);
        }

        .action-button:active {
          transform: translateY(0);
        }

        .beta-badge {
          display: inline-block;
          padding: var(--spacing-sm) var(--spacing-lg);
          background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
          border-radius: var(--radius-full);
          margin-top: var(--spacing-xl);
        }

        .badge-text {
          font-size: var(--font-size-xs);
          font-weight: var(--font-weight-semibold);
          color: white;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        @media (prefers-reduced-motion: reduce) {
          .coming-soon-icon {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
});

MobileComingSoon.displayName = 'MobileComingSoon';

export default MobileComingSoon;