import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../../hooks/useTheme';
import { XMarkIcon, CheckCircleIcon, ExclamationCircleIcon, InformationCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

const Notification = ({ 
  type = 'info', 
  title, 
  message, 
  duration = 5000, 
  onClose,
  actions = [],
  position = 'top-right',
  animate = true,
  persistent = false,
  showProgress = true
}) => {
  const { animations } = useTheme();
  const [progress, setProgress] = useState(100);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (!persistent && duration > 0) {
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          const newProgress = prev - (100 / (duration / 100));
          if (newProgress <= 0) {
            clearInterval(progressInterval);
            setIsVisible(false);
            setTimeout(() => onClose?.(), 300);
            return 0;
          }
          return newProgress;
        });
      }, 100);

      return () => clearInterval(progressInterval);
    }
  }, [duration, persistent, onClose]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => onClose?.(), 300);
  };

  const typeConfig = {
    success: {
      icon: CheckCircleIcon,
      className: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-700/30 text-emerald-800 dark:text-emerald-200',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      progressColor: 'bg-emerald-500'
    },
    error: {
      icon: ExclamationCircleIcon,
      className: 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-700/30 text-rose-800 dark:text-rose-200',
      iconColor: 'text-rose-600 dark:text-rose-400',
      progressColor: 'bg-rose-500'
    },
    warning: {
      icon: ExclamationTriangleIcon,
      className: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700/30 text-amber-800 dark:text-amber-200',
      iconColor: 'text-amber-600 dark:text-amber-400',
      progressColor: 'bg-amber-500'
    },
    info: {
      icon: InformationCircleIcon,
      className: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700/30 text-blue-800 dark:text-blue-200',
      iconColor: 'text-blue-600 dark:text-blue-400',
      progressColor: 'bg-blue-500'
    }
  };

  const config = typeConfig[type];
  const IconComponent = config.icon;

  const positionClasses = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-center': 'top-4 left-1/2 transform -translate-x-1/2',
    'bottom-center': 'bottom-4 left-1/2 transform -translate-x-1/2'
  };

  const slideVariants = {
    initial: {
      opacity: 0,
      x: position.includes('right') ? 300 : position.includes('left') ? -300 : 0,
      y: position.includes('top') ? -100 : position.includes('bottom') ? 100 : 0,
      scale: 0.9
    },
    animate: {
      opacity: 1,
      x: 0,
      y: 0,
      scale: 1,
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 25,
        duration: 0.4
      }
    },
    exit: {
      opacity: 0,
      x: position.includes('right') ? 300 : position.includes('left') ? -300 : 0,
      y: position.includes('top') ? -100 : position.includes('bottom') ? 100 : 0,
      scale: 0.9,
      transition: {
        duration: 0.3,
        ease: "easeIn"
      }
    }
  };

  const NotificationComponent = animate && animations ? motion.div : 'div';

  const motionProps = animate && animations ? {
    variants: slideVariants,
    initial: "initial",
    animate: isVisible ? "animate" : "exit",
    exit: "exit",
    layout: true
  } : {};

  return (
    <AnimatePresence mode="wait">
      {isVisible && (
        <NotificationComponent
          className={`
            fixed
            z-50
            min-w-[320px]
            max-w-[420px]
            p-4
            border
            rounded-xl
            shadow-lg
            backdrop-blur-sm
            ${config.className}
            ${positionClasses[position]}
          `}
          {...motionProps}
        >
          {/* Progress bar */}
          {showProgress && !persistent && (
            <div className="absolute top-0 left-0 right-0 h-1 bg-black/5 dark:bg-white/5 rounded-t-xl overflow-hidden">
              <motion.div
                className={`h-full ${config.progressColor}`}
                style={{ width: `${progress}%` }}
                transition={{ duration: 0.1, ease: "linear" }}
              />
            </div>
          )}

          <div className="flex items-start gap-3">
            {/* Icon */}
            <div className={`flex-shrink-0 ${config.iconColor}`}>
              <IconComponent className="w-6 h-6" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              {title && (
                <h4 className="font-semibold text-sm mb-1 truncate">
                  {title}
                </h4>
              )}
              <p className="text-sm leading-relaxed">
                {message}
              </p>

              {/* Actions */}
              {actions.length > 0 && (
                <div className="flex gap-2 mt-3">
                  {actions.map((action, index) => (
                    <button
                      key={index}
                      onClick={action.onClick}
                      className={`
                        px-3
                        py-1
                        text-xs
                        font-medium
                        rounded-lg
                        transition-colors
                        duration-200
                        ${action.primary 
                          ? `${config.iconColor} hover:opacity-80` 
                          : 'text-current opacity-70 hover:opacity-100'
                        }
                      `}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Close button */}
            <button
              onClick={handleClose}
              className="flex-shrink-0 p-1 rounded-lg text-current opacity-50 hover:opacity-100 transition-opacity duration-200"
              aria-label="Close notification"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>
        </NotificationComponent>
      )}
    </AnimatePresence>
  );
};

export default Notification;