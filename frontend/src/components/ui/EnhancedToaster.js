import React from 'react';
import { Toaster } from 'react-hot-toast';

const EnhancedToaster = () => {
  return (
    <Toaster
      position="top-right"
      reverseOrder={false}
      gutter={12}
      containerClassName=""
      containerStyle={{}}
      toastOptions={{
        // Default options for all toasts
        duration: 5000,
        style: {
          borderRadius: '12px',
          padding: '16px',
          color: '#1F2937',
          fontSize: '14px',
          fontWeight: '500',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
          maxWidth: '420px',
        },
        
        // Specific toast type styles
        success: {
          style: {
            background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
            color: 'white',
          },
          iconTheme: {
            primary: 'white',
            secondary: '#10B981',
          },
          className: 'border border-green-200',
        },
        
        error: {
          style: {
            background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
            color: 'white',
          },
          iconTheme: {
            primary: 'white',
            secondary: '#EF4444',
          },
          className: 'border border-red-200',
        },
        
        loading: {
          style: {
            background: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)',
            color: 'white',
          },
          iconTheme: {
            primary: 'white',
            secondary: '#8B5CF6',
          },
        },
        
        blank: {
          style: {
            background: 'linear-gradient(135deg, #F3F4F6 0%, #E5E7EB 100%)',
            color: '#1F2937',
          },
        },
        
        custom: {
          style: {
            background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
            color: 'white',
          },
        },
      }}
    />
  );
};

// Custom toast functions with enhanced styling
export const customToast = {
  success: (message, options = {}) => {
    return toast.success(message, {
      icon: '✨',
      style: {
        background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
        color: 'white',
        border: '1px solid rgba(16, 185, 129, 0.2)',
      },
      ...options,
    });
  },
  
  error: (message, options = {}) => {
    return toast.error(message, {
      icon: '⚠️',
      style: {
        background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
        color: 'white',
        border: '1px solid rgba(239, 68, 68, 0.2)',
      },
      ...options,
    });
  },
  
  info: (message, options = {}) => {
    return toast(message, {
      icon: 'ℹ️',
      style: {
        background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
        color: 'white',
        border: '1px solid rgba(59, 130, 246, 0.2)',
      },
      ...options,
    });
  },
  
  warning: (message, options = {}) => {
    return toast(message, {
      icon: '⚡',
      style: {
        background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
        color: 'white',
        border: '1px solid rgba(245, 158, 11, 0.2)',
      },
      ...options,
    });
  },
  
  promise: (promise, messages, options = {}) => {
    return toast.promise(
      promise,
      {
        loading: messages.loading || 'Loading...',
        success: messages.success || 'Success!',
        error: messages.error || 'Error occurred',
      },
      {
        style: {
          minWidth: '250px',
        },
        ...options,
      }
    );
  },
  
  custom: (content, options = {}) => {
    return toast.custom(
      (t) => (
        <div
          className={`${
            t.visible ? 'animate-enter' : 'animate-leave'
          } max-w-md w-full bg-white shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5`}
        >
          <div className="flex-1 w-0 p-4">{content}</div>
          <div className="flex border-l border-gray-200">
            <button
              onClick={() => toast.dismiss(t.id)}
              className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-indigo-600 hover:text-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              Close
            </button>
          </div>
        </div>
      ),
      options
    );
  },
};

export default EnhancedToaster;