import React from 'react';

const Input = ({
  type = 'text',
  label,
  error,
  icon,
  rightElement,
  size = 'md',
  fullWidth = true,
  className = '',
  ...props
}) => {
  const sizes = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-4 py-2.5 text-base',
    lg: 'px-5 py-3 text-lg'
  };

  const baseInputClasses = `
    w-full bg-white 
    border border-gray-300 rounded-xl
    focus:ring-2 focus:ring-purple-500 focus:border-transparent
    transition-all duration-200
    disabled:bg-gray-50 disabled:cursor-not-allowed
    ${icon ? 'pl-10' : ''}
    ${rightElement ? 'pr-10' : ''}
    ${sizes[size]}
    ${error ? 'border-red-500 focus:ring-red-500' : ''}
    ${className}
  `;

  const wrapperClasses = `
    ${fullWidth ? 'w-full' : ''}
  `;

  return (
    <div className={wrapperClasses}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <span className="text-gray-500 text-lg">{icon}</span>
          </div>
        )}
        <input
          type={type}
          className={baseInputClasses}
          {...props}
        />
        {rightElement && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
            {rightElement}
          </div>
        )}
      </div>
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
};

export const TextArea = ({
  label,
  error,
  rows = 4,
  size = 'md',
  fullWidth = true,
  className = '',
  ...props
}) => {
  const sizes = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-4 py-2.5 text-base',
    lg: 'px-5 py-3 text-lg'
  };

  const baseTextAreaClasses = `
    w-full bg-white 
    border border-gray-300 rounded-xl
    focus:ring-2 focus:ring-purple-500 focus:border-transparent
    transition-all duration-200
    disabled:bg-gray-50 disabled:cursor-not-allowed
    resize-vertical
    ${sizes[size]}
    ${error ? 'border-red-500 focus:ring-red-500' : ''}
    ${className}
  `;

  const wrapperClasses = `
    ${fullWidth ? 'w-full' : ''}
  `;

  return (
    <div className={wrapperClasses}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          {label}
        </label>
      )}
      <textarea
        rows={rows}
        className={baseTextAreaClasses}
        {...props}
      />
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
};

export default Input;