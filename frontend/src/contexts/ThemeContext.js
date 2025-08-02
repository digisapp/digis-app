import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    // Check system preference and saved preference
    const saved = localStorage.getItem('digis-theme');
    if (saved) return saved;
    
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  const [accentColor, setAccentColor] = useState(() => {
    return localStorage.getItem('digis-accent') || 'primary';
  });

  const [animations, setAnimations] = useState(() => {
    const saved = localStorage.getItem('digis-animations');
    if (saved !== null) return JSON.parse(saved);
    
    // Check if user prefers reduced motion
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  const [fontSize, setFontSize] = useState(() => {
    return localStorage.getItem('digis-font-size') || 'normal';
  });

  const [highContrast, setHighContrast] = useState(() => {
    const saved = localStorage.getItem('digis-high-contrast');
    return saved ? JSON.parse(saved) : false;
  });

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement;
    
    // Set theme attribute
    root.setAttribute('data-theme', theme);
    
    // Apply dark class for Tailwind CSS
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    
    // Set accent color
    root.setAttribute('data-accent', accentColor);
    
    // Set font size
    const fontSizeMap = {
      small: '0.875',
      normal: '1',
      large: '1.125',
      xlarge: '1.25'
    };
    root.style.fontSize = `${fontSizeMap[fontSize]}rem`;
    
    // Set animations
    if (!animations) {
      root.style.setProperty('--duration-75', '0ms');
      root.style.setProperty('--duration-100', '0ms');
      root.style.setProperty('--duration-150', '0ms');
      root.style.setProperty('--duration-200', '0ms');
      root.style.setProperty('--duration-300', '0ms');
      root.style.setProperty('--duration-500', '0ms');
      root.style.setProperty('--duration-700', '0ms');
      root.style.setProperty('--duration-1000', '0ms');
    } else {
      root.style.removeProperty('--duration-75');
      root.style.removeProperty('--duration-100');
      root.style.removeProperty('--duration-150');
      root.style.removeProperty('--duration-200');
      root.style.removeProperty('--duration-300');
      root.style.removeProperty('--duration-500');
      root.style.removeProperty('--duration-700');
      root.style.removeProperty('--duration-1000');
    }
    
    // Set high contrast
    if (highContrast) {
      root.setAttribute('data-high-contrast', 'true');
    } else {
      root.removeAttribute('data-high-contrast');
    }
    
    // Save preferences
    localStorage.setItem('digis-theme', theme);
    localStorage.setItem('digis-accent', accentColor);
    localStorage.setItem('digis-animations', JSON.stringify(animations));
    localStorage.setItem('digis-font-size', fontSize);
    localStorage.setItem('digis-high-contrast', JSON.stringify(highContrast));
  }, [theme, accentColor, animations, fontSize, highContrast]);

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e) => {
      // Only auto-switch if user hasn't manually set a preference
      if (!localStorage.getItem('digis-theme-manual')) {
        setTheme(e.matches ? 'dark' : 'light');
      }
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const toggleTheme = () => {
    setTheme(prev => {
      const newTheme = prev === 'light' ? 'dark' : 'light';
      localStorage.setItem('digis-theme-manual', 'true');
      return newTheme;
    });
  };

  const setCustomTheme = (newTheme) => {
    setTheme(newTheme);
    localStorage.setItem('digis-theme-manual', 'true');
  };

  const resetToSystem = () => {
    localStorage.removeItem('digis-theme-manual');
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    setTheme(systemTheme);
  };

  // Smooth theme transition
  const enableTransitions = () => {
    const css = document.createElement('style');
    css.type = 'text/css';
    css.appendChild(document.createTextNode(`
      * {
        transition: background-color var(--duration-300) var(--ease-out),
                    border-color var(--duration-300) var(--ease-out),
                    color var(--duration-300) var(--ease-out),
                    box-shadow var(--duration-300) var(--ease-out) !important;
      }
    `));
    document.head.appendChild(css);
    
    setTimeout(() => {
      document.head.removeChild(css);
    }, 300);
  };

  const value = {
    theme,
    setTheme: setCustomTheme,
    toggleTheme,
    resetToSystem,
    isDark: theme === 'dark',
    
    accentColor,
    setAccentColor,
    
    animations,
    setAnimations,
    
    fontSize,
    setFontSize,
    
    highContrast,
    setHighContrast,
    
    enableTransitions,
    
    // Utility functions
    getThemeValue: (lightValue, darkValue) => theme === 'dark' ? darkValue : lightValue,
    
    // Accessibility helpers
    prefersReducedMotion: !animations,
    
    // Theme variants
    themes: {
      light: 'Light',
      dark: 'Dark',
      auto: 'System'
    },
    
    accentColors: {
      primary: 'Indigo',
      secondary: 'Purple', 
      emerald: 'Emerald',
      rose: 'Rose',
      gold: 'Gold',
      sky: 'Sky'
    },
    
    fontSizes: {
      small: 'Small',
      normal: 'Normal',
      large: 'Large',
      xlarge: 'Extra Large'
    }
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};