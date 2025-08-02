/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}"
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
    },
  },
  plugins: [],
}

