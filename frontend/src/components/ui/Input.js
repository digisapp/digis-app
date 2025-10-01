import React, { memo } from 'react';

const Input = memo(({
  type = 'text',
  label,
  error,
  icon,
  rightElement,
  size = 'md',
  fullWidth = true,
  className = '',
  id = `input-${Math.random().toString(36).substr(2, 9)}`,
  ariaLabel,
  ...props
}) => {
  const sizes = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-4 py-2.5 text-base',
    lg: 'px-5 py-3 text-lg'
  };

  const validTypes = ['text', 'number', 'email', 'password', 'tel', 'url', 'search', 'date', 'time', 'datetime-local'];

  // Validate props
  if (!sizes[size]) {
    console.warn(`Invalid input size: ${size}. Using md.`);
    size = 'md';
  }
  if (!validTypes.includes(type)) {
    console.warn(`Invalid input type: ${type}. Using text.`);
    type = 'text';
  }

  // Handle complex error objects
  const errorMessage = typeof error === 'string' ? error : error?.message || '';

  const baseInputClasses = [
    'w-full bg-white',
    'border border-gray-300 rounded-xl',
    'focus:ring-2 focus:ring-purple-500 focus:border-transparent',
    'transition-all duration-200',
    'disabled:bg-gray-50 disabled:cursor-not-allowed',
    icon ? 'pl-10' : '',
    rightElement ? 'pr-10' : '',
    sizes[size] || sizes.md,
    errorMessage ? 'border-red-500 focus:ring-red-500' : '',
    className
  ].filter(Boolean).join(' ');

  const wrapperClasses = [
    fullWidth ? 'w-full' : ''
  ].filter(Boolean).join(' ');

  return (
    <div className={wrapperClasses}>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1.5">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <span className="text-gray-500 text-lg" aria-hidden="true">
              {typeof icon === 'string' ? icon : React.cloneElement(icon, { 
                className: 'text-lg text-gray-500',
                'aria-hidden': true 
              })}
            </span>
          </div>
        )}
        <input
          type={type}
          id={id}
          className={baseInputClasses}
          aria-label={ariaLabel || label}
          aria-invalid={!!errorMessage}
          aria-describedby={errorMessage ? `${id}-error` : undefined}
          {...props}
        />
        {rightElement && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
            {typeof rightElement === 'string' ? (
              <span className="text-gray-500 text-lg">{rightElement}</span>
            ) : (
              React.cloneElement(rightElement, { 
                className: 'text-lg text-gray-500' 
              })
            )}
          </div>
        )}
      </div>
      {errorMessage && (
        <p id={`${id}-error`} className="mt-1 text-sm text-red-600" role="alert">
          {errorMessage}
        </p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

export const TextArea = memo(({
  label,
  error,
  rows = 4,
  size = 'md',
  fullWidth = true,
  className = '',
  id = `textarea-${Math.random().toString(36).substr(2, 9)}`,
  ariaLabel,
  ...props
}) => {
  const sizes = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-4 py-2.5 text-base',
    lg: 'px-5 py-3 text-lg'
  };

  // Validate props
  if (!sizes[size]) {
    console.warn(`Invalid textarea size: ${size}. Using md.`);
    size = 'md';
  }
  if (rows < 1) {
    console.warn(`Invalid rows: ${rows}. Using 4.`);
    rows = 4;
  }

  // Handle complex error objects
  const errorMessage = typeof error === 'string' ? error : error?.message || '';

  const baseTextAreaClasses = [
    'w-full bg-white',
    'border border-gray-300 rounded-xl',
    'focus:ring-2 focus:ring-purple-500 focus:border-transparent',
    'transition-all duration-200',
    'disabled:bg-gray-50 disabled:cursor-not-allowed',
    'resize-vertical',
    sizes[size] || sizes.md,
    errorMessage ? 'border-red-500 focus:ring-red-500' : '',
    className
  ].filter(Boolean).join(' ');

  const wrapperClasses = [
    fullWidth ? 'w-full' : ''
  ].filter(Boolean).join(' ');

  return (
    <div className={wrapperClasses}>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1.5">
          {label}
        </label>
      )}
      <textarea
        rows={rows}
        id={id}
        className={baseTextAreaClasses}
        aria-label={ariaLabel || label}
        aria-invalid={!!errorMessage}
        aria-describedby={errorMessage ? `${id}-error` : undefined}
        {...props}
      />
      {errorMessage && (
        <p id={`${id}-error`} className="mt-1 text-sm text-red-600" role="alert">
          {errorMessage}
        </p>
      )}
    </div>
  );
});

TextArea.displayName = 'TextArea';

export default Input;