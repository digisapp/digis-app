import React from 'react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';

const Select = ({ 
  options = [], 
  value, 
  onChange, 
  placeholder = 'Select an option',
  disabled = false,
  error = false,
  className = '',
  ...props 
}) => {
  const baseClasses = `
    w-full px-3 py-2 border rounded-lg
    bg-white dark:bg-neutral-800
    text-neutral-900 dark:text-neutral-100
    focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
    disabled:opacity-50 disabled:cursor-not-allowed
    appearance-none relative
  `;

  const errorClasses = error 
    ? 'border-red-500 dark:border-red-400' 
    : 'border-neutral-300 dark:border-neutral-600';

  return (
    <div className="relative">
      <select
        value={value}
        onChange={onChange}
        disabled={disabled}
        className={`${baseClasses} ${errorClasses} ${className} pr-10`}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
        <ChevronDownIcon className="h-4 w-4 text-neutral-400" />
      </div>
    </div>
  );
};

export default Select;