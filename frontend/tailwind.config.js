/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
    // Include any other template paths
  ],
  // Safelist important dynamic classes that might be constructed at runtime
  safelist: [
    // Miami colors that might be used dynamically
    'bg-miami-cyan',
    'bg-miami-magenta',
    'bg-miami-coral',
    'bg-miami-lime',
    'bg-miami-purple',
    'bg-miami-gold',
    'bg-miami-sunset',
    'bg-miami-ocean',
    'text-miami-cyan',
    'text-miami-magenta',
    'text-miami-coral',
    'text-miami-lime',
    'text-miami-purple',
    'text-miami-gold',
    'text-miami-sunset',
    'text-miami-ocean',
    'border-miami-cyan',
    'border-miami-magenta',
    'border-miami-coral',
    'border-miami-lime',
    'border-miami-purple',
    'border-miami-gold',
    'border-miami-sunset',
    'border-miami-ocean',
    // Gradient backgrounds
    'bg-miami-gradient',
    'bg-sunset-gradient',
    'bg-ocean-gradient',
    'bg-gold-gradient',
    'bg-neon-gradient',
    // Animation classes
    'animate-float-up',
    'animate-neon-glow',
    'animate-shimmer',
    // Shadow classes
    'shadow-miami-cyan',
    'shadow-miami-magenta',
    'shadow-miami-lime',
    'shadow-luxury',
    'shadow-luxury-dark',
    // Dark mode specific
    'dark',
    // Responsive variants
    {
      pattern: /(bg|text|border)-(miami-cyan|miami-magenta|miami-coral|miami-lime|miami-purple|miami-gold|miami-sunset|miami-ocean)/,
      variants: ['hover', 'focus', 'dark', 'dark:hover', 'dark:focus'],
    },
  ],
  theme: {
    extend: {
      fontFamily: {
        'sans': ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        miami: {
          cyan: '#00d4ff',
          magenta: '#ff006e',
          coral: '#ff6b35',
          lime: '#39ff14',
          purple: '#8b5cf6',
          gold: '#ffd700',
          sunset: '#ff5e5b',
          ocean: '#0077be',
          // High contrast variants for accessibility
          'high-cyan': '#00ffff',
          'high-magenta': '#ff00ff',
          'high-coral': '#ff4500',
          'high-lime': '#32cd32',
          'high-purple': '#9400d3',
          'high-gold': '#ffff00',
          'high-sunset': '#ff0000',
          'high-ocean': '#0000ff',
        },
      },
      backgroundImage: {
        'miami-gradient': 'linear-gradient(135deg, #00d4ff 0%, #ff006e 50%, #8b5cf6 100%)',
        'sunset-gradient': 'linear-gradient(135deg, #ff5e5b 0%, #ff006e 50%, #8b5cf6 100%)',
        'ocean-gradient': 'linear-gradient(135deg, #0077be 0%, #00d4ff 50%, #39ff14 100%)',
        'gold-gradient': 'linear-gradient(135deg, #ffd700 0%, #ff6b35 100%)',
        'neon-gradient': 'linear-gradient(135deg, #39ff14 0%, #00d4ff 50%, #ff006e 100%)',
      },
      animation: {
        'float-up': 'floatUp 0.6s ease-out forwards',
        'neon-glow': 'neonGlow 3s ease-in-out infinite',
        'shimmer': 'shimmer 2s infinite',
        'pulse-subtle': 'pulse-subtle 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'blob': 'blob 7s infinite',
        'gradient-x': 'gradient-x 3s ease infinite',
      },
      keyframes: {
        floatUp: {
          '0%': {
            opacity: '0',
            transform: 'translateY(20px) scale(0.8)',
          },
          '100%': {
            opacity: '1',
            transform: 'translateY(0) scale(1)',
          },
        },
        neonGlow: {
          '0%, 100%': {
            boxShadow: '0 0 20px rgba(0, 212, 255, 0.5)',
            borderColor: '#00d4ff',
          },
          '33%': {
            boxShadow: '0 0 20px rgba(255, 0, 110, 0.5)',
            borderColor: '#ff006e',
          },
          '66%': {
            boxShadow: '0 0 20px rgba(57, 255, 20, 0.5)',
            borderColor: '#39ff14',
          },
        },
        shimmer: {
          '0%': {
            backgroundPosition: '-200% center',
          },
          '100%': {
            backgroundPosition: '200% center',
          },
        },
      },
      boxShadow: {
        'miami-cyan': '0 0 20px rgba(0, 212, 255, 0.5)',
        'miami-magenta': '0 0 20px rgba(255, 0, 110, 0.5)',
        'miami-lime': '0 0 20px rgba(57, 255, 20, 0.5)',
        'luxury': '0 8px 32px rgba(0, 212, 255, 0.15)',
        'luxury-dark': '0 8px 32px rgba(139, 92, 246, 0.2)',
      },
      backdropBlur: {
        'luxury': '20px',
      },
      screens: {
        // Better mobile breakpoints
        'xs': '475px',
        // Default Tailwind breakpoints
        'sm': '640px',
        'md': '768px',
        'lg': '1024px',
        'xl': '1280px',
        '2xl': '1536px',
        // Custom breakpoints for large displays
        '3xl': '1920px',
        '4xl': '2560px',
      },
      transitionDuration: {
        '400': '400ms',
        '600': '600ms',
        '800': '800ms',
        '900': '900ms',
      },
      transitionTimingFunction: {
        'bounce-in': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
        'bounce-out': 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
      },
    },
  },
  plugins: [],
  // Production optimizations
  future: {
    hoverOnlyWhenSupported: true,
  },
}

