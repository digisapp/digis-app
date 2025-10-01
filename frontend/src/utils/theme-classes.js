// Centralized theme classes for consistent dark mode styling
export const themeClasses = {
  // Backgrounds
  bg: {
    primary: 'bg-white dark:bg-gray-900',
    secondary: 'bg-gray-50 dark:bg-gray-800',
    tertiary: 'bg-gray-100 dark:bg-gray-700',
    card: 'bg-white dark:bg-gray-800',
    hover: 'hover:bg-gray-50 dark:hover:bg-gray-700',
    modal: 'bg-white dark:bg-gray-800',
    overlay: 'bg-black/50 dark:bg-black/70',
  },
  
  // Text colors
  text: {
    primary: 'text-gray-900 dark:text-white',
    secondary: 'text-gray-700 dark:text-gray-300',
    tertiary: 'text-gray-600 dark:text-gray-400',
    muted: 'text-gray-500 dark:text-gray-500',
    inverse: 'text-white dark:text-gray-900',
  },
  
  // Borders
  border: {
    default: 'border-gray-200 dark:border-gray-700',
    light: 'border-gray-100 dark:border-gray-800',
    dark: 'border-gray-300 dark:border-gray-600',
  },
  
  // Input styles
  input: {
    base: 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 focus:border-purple-500 dark:focus:border-purple-400',
    placeholder: 'placeholder-gray-400 dark:placeholder-gray-500',
  },
  
  // Button styles
  button: {
    primary: 'bg-purple-600 hover:bg-purple-700 text-white',
    secondary: 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white',
    ghost: 'bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300',
  },
  
  // Shadow
  shadow: {
    sm: 'shadow-sm dark:shadow-gray-900/50',
    md: 'shadow-md dark:shadow-gray-900/50',
    lg: 'shadow-lg dark:shadow-gray-900/50',
  },
  
  // Divide
  divide: {
    y: 'divide-y divide-gray-200 dark:divide-gray-700',
    x: 'divide-x divide-gray-200 dark:divide-gray-700',
  }
};

// Helper function to combine classes
export const cn = (...classes) => {
  return classes.filter(Boolean).join(' ');
};