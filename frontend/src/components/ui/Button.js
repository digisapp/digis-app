import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { useReducedMotion } from '../../hooks/useReducedMotion';

const Button = memo(({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  onClick, 
  disabled = false,
  loading = false,
  icon,
  fullWidth = false,
  className = '',
  ariaLabel,
  type = 'button',
  ...props 
}) => {
  // Consistent styling system
  const variants = {
    primary: 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700',
    secondary: 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700',
    success: 'bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700',
    danger: 'bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700',
    warning: 'bg-gradient-to-r from-yellow-500 to-orange-600 text-white hover:from-yellow-600 hover:to-orange-700',
    ghost: 'bg-transparent text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800',
    outline: 'bg-transparent border-2 border-purple-600 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20'
  };

  const sizes = {
    xs: 'px-3 py-1.5 text-xs',
    sm: 'px-4 py-2 text-sm',
    md: 'px-5 py-2.5 text-base',
    lg: 'px-6 py-3 text-lg',
    xl: 'px-8 py-4 text-xl'
  };

  // Validate props
  if (!variants[variant]) {
    console.warn(`Invalid button variant: ${variant}. Using primary.`);
    variant = 'primary';
  }

  if (!sizes[size]) {
    console.warn(`Invalid button size: ${size}. Using md.`);
    size = 'md';
  }

  // Build classes using array for better readability
  const baseClasses = [
    'inline-flex items-center justify-center gap-2',
    'font-medium rounded-xl',
    'transition-all duration-200',
    'focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    fullWidth ? 'w-full' : '',
    variants[variant],
    sizes[size],
    className
  ].filter(Boolean).join(' ');

  // Handle keyboard events for accessibility
  const handleKeyDown = (e) => {
    // Only trigger on Enter or Space when not a form submit button
    if ((e.key === 'Enter' || e.key === ' ') && type !== 'submit' && !disabled && !loading) {
      e.preventDefault();
      onClick?.(e);
    }
  };

  // Check for reduced motion preference
  const prefersReducedMotion = useReducedMotion();

  // Render icon - support both string emojis and JSX elements
  const renderIcon = () => {
    if (!icon) return null;

    if (typeof icon === 'string') {
      return <span className="text-lg" aria-hidden="true">{icon}</span>;
    }

    // Handle JSX elements (e.g., Heroicons)
    if (React.isValidElement(icon)) {
      return React.cloneElement(icon, {
        className: `w-5 h-5 ${icon.props.className || ''}`,
        'aria-hidden': 'true'
      });
    }

    console.warn('Invalid icon prop. Expected string or React element.');
    return null;
  };

  return (
    <motion.button
      whileHover={prefersReducedMotion ? undefined : { scale: disabled || loading ? 1 : 1.02 }}
      whileTap={prefersReducedMotion ? undefined : { scale: disabled || loading ? 1 : 0.98 }}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      disabled={disabled || loading}
      aria-disabled={disabled || loading}
      aria-label={ariaLabel || (typeof children === 'string' ? children : undefined)}
      aria-busy={loading}
      className={baseClasses}
      type={type}
      role="button"
      {...props}
    >
      {loading ? (
        <>
          <svg 
            className="animate-spin h-4 w-4" 
            xmlns="http://www.w3.org/2000/svg" 
            fill="none" 
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle 
              className="opacity-25" 
              cx="12" 
              cy="12" 
              r="10" 
              stroke="currentColor" 
              strokeWidth="4"
            />
            <path 
              className="opacity-75" 
              fill="currentColor" 
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span>Loading...</span>
        </>
      ) : (
        <>
          {renderIcon()}
          {children}
        </>
      )}
    </motion.button>
  );
});

Button.displayName = 'Button';

export default Button;