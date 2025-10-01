/**
 * Digis Design System
 * Centralized design tokens and utilities for consistent UI/UX
 */

// Color Palette
export const colors = {
  // Primary colors
  primary: {
    50: '#faf5ff',
    100: '#f3e8ff',
    200: '#e9d5ff',
    300: '#d8b4fe',
    400: '#c084fc',
    500: '#a855f7',
    600: '#9333ea',
    700: '#7c3aed',
    800: '#6b21a8',
    900: '#581c87'
  },
  
  // Secondary colors
  secondary: {
    50: '#fdf2f8',
    100: '#fce7f3',
    200: '#fbcfe8',
    300: '#f9a8d4',
    400: '#f472b6',
    500: '#ec4899',
    600: '#db2777',
    700: '#be185d',
    800: '#9d174d',
    900: '#831843'
  },
  
  // Neutral colors
  gray: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827'
  },
  
  // Semantic colors
  success: {
    light: '#86efac',
    DEFAULT: '#22c55e',
    dark: '#16a34a'
  },
  warning: {
    light: '#fde047',
    DEFAULT: '#eab308',
    dark: '#ca8a04'
  },
  error: {
    light: '#fca5a5',
    DEFAULT: '#ef4444',
    dark: '#dc2626'
  },
  info: {
    light: '#93c5fd',
    DEFAULT: '#3b82f6',
    dark: '#2563eb'
  }
};

// Typography
export const typography = {
  fontFamily: {
    sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
    mono: ['JetBrains Mono', 'monospace']
  },
  fontSize: {
    xs: '0.75rem',    // 12px
    sm: '0.875rem',   // 14px
    base: '1rem',     // 16px
    lg: '1.125rem',   // 18px
    xl: '1.25rem',    // 20px
    '2xl': '1.5rem',  // 24px
    '3xl': '1.875rem', // 30px
    '4xl': '2.25rem', // 36px
    '5xl': '3rem'     // 48px
  },
  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700
  },
  lineHeight: {
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.75
  }
};

// Spacing Scale
export const spacing = {
  0: '0',
  1: '0.25rem',   // 4px
  2: '0.5rem',    // 8px
  3: '0.75rem',   // 12px
  4: '1rem',      // 16px
  5: '1.25rem',   // 20px
  6: '1.5rem',    // 24px
  8: '2rem',      // 32px
  10: '2.5rem',   // 40px
  12: '3rem',     // 48px
  16: '4rem',     // 64px
  20: '5rem',     // 80px
  24: '6rem'      // 96px
};

// Border Radius
export const borderRadius = {
  none: '0',
  sm: '0.125rem',   // 2px
  DEFAULT: '0.25rem', // 4px
  md: '0.375rem',   // 6px
  lg: '0.5rem',     // 8px
  xl: '0.75rem',    // 12px
  '2xl': '1rem',    // 16px
  '3xl': '1.5rem',  // 24px
  full: '9999px'
};

// Shadows
export const shadows = {
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  DEFAULT: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
  none: 'none'
};

// Animation Durations
export const animations = {
  duration: {
    fast: '150ms',
    normal: '300ms',
    slow: '500ms'
  },
  easing: {
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)'
  }
};

// Breakpoints
export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px'
};

// Z-Index Scale
export const zIndex = {
  0: 0,
  10: 10,
  20: 20,
  30: 30,
  40: 40,
  50: 50,
  modal: 1000,
  popover: 1100,
  tooltip: 1200,
  notification: 1300
};

// Component Styles
export const components = {
  // Button styles
  button: {
    base: 'inline-flex items-center justify-center font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed',
    sizes: {
      sm: 'px-3 py-1.5 text-sm rounded-md',
      md: 'px-4 py-2 text-base rounded-lg',
      lg: 'px-6 py-3 text-lg rounded-lg',
      xl: 'px-8 py-4 text-xl rounded-xl'
    },
    variants: {
      primary: 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 focus:ring-purple-500',
      secondary: 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 focus:ring-gray-500',
      ghost: 'bg-transparent text-gray-700 hover:bg-gray-100 focus:ring-gray-500',
      danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500'
    }
  },
  
  // Input styles
  input: {
    base: 'w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200',
    error: 'border-red-500 focus:ring-red-500',
    sizes: {
      sm: 'text-sm py-1.5',
      md: 'text-base py-2',
      lg: 'text-lg py-3'
    }
  },
  
  // Card styles
  card: {
    base: 'bg-white rounded-xl shadow-sm border border-gray-200',
    hover: 'hover:shadow-md hover:border-purple-200 transition-all duration-200',
    padding: {
      sm: 'p-4',
      md: 'p-6',
      lg: 'p-8'
    }
  },
  
  // Modal styles
  modal: {
    overlay: 'fixed inset-0 bg-black/50 backdrop-blur-sm z-50',
    content: 'bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4',
    header: 'px-6 py-4 border-b border-gray-200',
    body: 'px-6 py-4',
    footer: 'px-6 py-4 border-t border-gray-200'
  }
};

// Utility Classes
export const utilities = {
  // Text utilities
  textGradient: 'bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent',
  
  // Focus utilities
  focusRing: 'focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2',
  
  // Animation utilities
  fadeIn: 'animate-fadeIn',
  slideUp: 'animate-slideUp',
  
  // Loading states
  skeleton: 'animate-pulse bg-gray-200 rounded',
  
  // Accessibility
  srOnly: 'absolute w-px h-px p-0 -m-px overflow-hidden whitespace-nowrap border-0',
  
  // Touch targets (minimum 44x44px)
  touchTarget: 'min-w-[44px] min-h-[44px]'
};

// Helper Functions
export const helpers = {
  // Get color with opacity
  withOpacity: (color, opacity) => {
    return `${color}/${opacity}`;
  },
  
  // Responsive value helper
  responsive: (mobile, tablet, desktop) => ({
    base: mobile,
    md: tablet,
    lg: desktop
  }),
  
  // Combine class names
  cn: (...classes) => {
    return classes.filter(Boolean).join(' ');
  },
  
  // Get contrast color
  getContrastColor: (backgroundColor) => {
    // Simple implementation - in production use a proper algorithm
    const darkColors = ['gray-800', 'gray-900', 'purple-800', 'purple-900'];
    return darkColors.includes(backgroundColor) ? 'white' : 'gray-900';
  }
};

// Accessibility Helpers
export const a11y = {
  // Skip link styles
  skipLink: 'sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-white px-4 py-2 rounded-lg shadow-lg z-50',
  
  // Live region
  liveRegion: 'sr-only aria-live-polite',
  
  // Focus trap
  focusTrap: 'focus:outline-none tabindex="-1"',
  
  // Visually hidden but accessible
  visuallyHidden: 'absolute left-[-10000px] top-auto width-px height-px overflow-hidden'
};

// Export custom CSS variables for use in CSS files
export const cssVariables = `
  :root {
    /* Colors */
    --color-primary: ${colors.primary[600]};
    --color-secondary: ${colors.secondary[600]};
    
    /* Spacing */
    --spacing-unit: 0.25rem;
    
    /* Typography */
    --font-sans: ${typography.fontFamily.sans.join(', ')};
    
    /* Animations */
    --duration-fast: ${animations.duration.fast};
    --duration-normal: ${animations.duration.normal};
    
    /* Touch targets */
    --touch-target: 44px;
  }
`;

export default {
  colors,
  typography,
  spacing,
  borderRadius,
  shadows,
  animations,
  breakpoints,
  zIndex,
  components,
  utilities,
  helpers,
  a11y,
  cssVariables
};