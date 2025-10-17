import React, { Component } from 'react';
import { motion } from 'framer-motion';
import { ExclamationTriangleIcon, ArrowPathIcon, HomeIcon } from '@heroicons/react/24/outline';

class MobileErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // ✅ ENHANCED: Log with detailed React #310 detection
    const isHookError = error.message?.includes('310') || error.message?.includes('hook');

    console.error('🚨 [MobileErrorBoundary] React Error Caught:', {
      error: error.toString(),
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo?.componentStack,
      timestamp: new Date().toISOString(),
      isHookError,
      errorNumber: error.message?.match(/#(\d+)/)?.[1]
    });

    // If it's React error #310, log specific guidance
    if (isHookError) {
      console.error('❌ React Hook Error #310 detected!');
      console.error('Component stack:', errorInfo?.componentStack);
      console.error('This means hooks are called in different order between renders.');
      console.error('Check for:');
      console.error('  1. Early returns BEFORE hook declarations');
      console.error('  2. Conditional hook calls (if statements around useX)');
      console.error('  3. Hooks declared after conditional logic');
    }

    // Send to error tracking service (e.g., Sentry)
    if (window.Sentry) {
      window.Sentry.captureException(error, {
        contexts: {
          react: {
            componentStack: errorInfo.componentStack
          }
        },
        tags: {
          component: 'MobileErrorBoundary',
          isHookError: isHookError ? 'true' : 'false'
        }
      });
    }
    
    this.setState(prevState => ({
      error,
      errorInfo,
      errorCount: prevState.errorCount + 1
    }));
    
    // Store error in localStorage for debugging
    try {
      const errorLog = {
        timestamp: new Date().toISOString(),
        error: error.toString(),
        stack: error.stack,
        componentStack: errorInfo.componentStack
      };
      
      const existingLogs = JSON.parse(localStorage.getItem('mobile_error_logs') || '[]');
      existingLogs.push(errorLog);
      
      // Keep only last 10 errors
      if (existingLogs.length > 10) {
        existingLogs.shift();
      }
      
      localStorage.setItem('mobile_error_logs', JSON.stringify(existingLogs));
    } catch (e) {
      console.error('Failed to store error log:', e);
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
    
    // Clear any cached data that might be causing issues
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => {
          caches.delete(name);
        });
      });
    }
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  // Copy crash report to clipboard
  handleCopyCrashReport = async () => {
    try {
      const logs = JSON.parse(localStorage.getItem('mobile_error_logs') || '[]');
      if (logs.length === 0) {
        console.log('No error logs available');
        return;
      }
      
      // Get the latest error log
      const latestLog = logs[logs.length - 1];
      const reportText = JSON.stringify(latestLog, null, 2);
      
      await navigator.clipboard.writeText(reportText);
      
      // Visual feedback - could be replaced with a toast notification
      const button = document.querySelector('.copy-crash-report-btn');
      if (button) {
        const originalText = button.textContent;
        button.textContent = 'Copied!';
        setTimeout(() => {
          if (button) button.textContent = originalText;
        }, 2000);
      }
    } catch (error) {
      console.error('Failed to copy crash report:', error);
    }
  };

  render() {
    if (this.state.hasError) {
      const isDevelopment = process.env.NODE_ENV === 'development';
      
      return (
        <div className="mobile-error-boundary">
          <motion.div 
            className="mobile-error-content"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="mobile-error-icon">
              <ExclamationTriangleIcon className="w-24 h-24 text-red-500" />
            </div>
            
            <h1 className="mobile-error-title">Oops! Something went wrong</h1>
            
            <p className="mobile-error-message">
              We're sorry for the inconvenience. The app encountered an unexpected error.
            </p>
            
            {isDevelopment && this.state.error && (
              <details className="mobile-error-details">
                <summary className="mobile-error-summary">Error Details (Dev Only)</summary>
                <div className="mobile-error-stack">
                  <pre className="mobile-error-pre">
                    {this.state.error.toString()}
                    {this.state.error.stack}
                  </pre>
                  {this.state.errorInfo && (
                    <pre className="mobile-error-pre">
                      Component Stack:
                      {this.state.errorInfo.componentStack}
                    </pre>
                  )}
                </div>
              </details>
            )}
            
            <div className="mobile-error-actions">
              <motion.button
                onClick={this.handleReset}
                className="mobile-error-button mobile-error-button-primary"
                whileTap={{ scale: 0.95 }}
              >
                <ArrowPathIcon className="w-5 h-5" />
                Try Again
              </motion.button>
              
              {/* Copy crash report button */}
              <motion.button
                onClick={this.handleCopyCrashReport}
                className="mobile-error-button mobile-error-button-info copy-crash-report-btn"
                whileTap={{ scale: 0.95 }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy crash report
              </motion.button>
              
              <motion.button
                onClick={this.handleReload}
                className="mobile-error-button mobile-error-button-secondary"
                whileTap={{ scale: 0.95 }}
              >
                Reload App
              </motion.button>
              
              <motion.button
                onClick={this.handleGoHome}
                className="mobile-error-button mobile-error-button-tertiary"
                whileTap={{ scale: 0.95 }}
              >
                <HomeIcon className="w-5 h-5" />
                Go Home
              </motion.button>
            </div>
            
            {this.state.errorCount > 2 && (
              <div className="mobile-error-persistent">
                <p className="text-sm text-gray-600">
                  This error keeps happening. Try clearing your browser cache or updating the app.
                </p>
              </div>
            )}
          </motion.div>
          
          <style jsx>{`
            .mobile-error-boundary {
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              padding: 20px;
            }
            
            .mobile-error-content {
              background: white;
              border-radius: 20px;
              padding: 40px 20px;
              max-width: 400px;
              width: 100%;
              text-align: center;
              box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            }
            
            .mobile-error-icon {
              margin-bottom: 20px;
              display: flex;
              justify-content: center;
            }
            
            .mobile-error-title {
              font-size: 24px;
              font-weight: bold;
              color: #1a202c;
              margin-bottom: 10px;
            }
            
            .mobile-error-message {
              color: #718096;
              margin-bottom: 30px;
              line-height: 1.5;
            }
            
            .mobile-error-details {
              background: #f7fafc;
              border-radius: 10px;
              padding: 15px;
              margin-bottom: 20px;
              text-align: left;
            }
            
            .mobile-error-summary {
              cursor: pointer;
              font-weight: 600;
              color: #4a5568;
              user-select: none;
            }
            
            .mobile-error-stack {
              margin-top: 10px;
              max-height: 200px;
              overflow-y: auto;
            }
            
            .mobile-error-pre {
              font-size: 11px;
              color: #e53e3e;
              white-space: pre-wrap;
              word-break: break-word;
            }
            
            .mobile-error-actions {
              display: flex;
              flex-direction: column;
              gap: 10px;
            }
            
            .mobile-error-button {
              padding: 12px 24px;
              border-radius: 10px;
              font-weight: 600;
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 8px;
              border: none;
              cursor: pointer;
              transition: all 0.2s;
            }
            
            .mobile-error-button-primary {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
            }
            
            .mobile-error-button-secondary {
              background: #edf2f7;
              color: #4a5568;
            }
            
            .mobile-error-button-tertiary {
              background: transparent;
              color: #667eea;
              border: 2px solid #667eea;
            }
            
            .mobile-error-button-info {
              background: #4299e1;
              color: white;
            }
            
            .mobile-error-persistent {
              margin-top: 20px;
              padding-top: 20px;
              border-top: 1px solid #e2e8f0;
            }
          `}</style>
        </div>
      );
    }

    return this.props.children;
  }
}

export default MobileErrorBoundary;