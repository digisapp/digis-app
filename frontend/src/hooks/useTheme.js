import { useCallback } from 'react';
import useStore from '../stores/useStore';

// Hook wrapper for ThemeContext functionality with optimized selectors
export const useTheme = () => {
  // Use shallow comparison for better performance
  const theme = useStore((state) => state.theme);
  const animations = useStore((state) => state.animations);
  const accentColor = useStore((state) => state.accentColor);
  const fontSize = useStore((state) => state.fontSize);
  const highContrast = useStore((state) => state.highContrast);
  
  // Static values that don't change
  const themes = useStore((state) => state.themes);
  const accentColors = useStore((state) => state.accentColors);
  const fontSizes = useStore((state) => state.fontSizes);
  
  // Actions are stable references
  const setTheme = useStore((state) => state.setTheme);
  const toggleTheme = useStore((state) => state.toggleTheme);
  const resetToSystemTheme = useStore((state) => state.resetToSystemTheme);
  const setAccentColor = useStore((state) => state.setAccentColor);
  const setAnimations = useStore((state) => state.setAnimations);
  const setFontSize = useStore((state) => state.setFontSize);
  const setHighContrast = useStore((state) => state.setHighContrast);
  const enableTransitions = useStore((state) => state.enableTransitions);
  const getThemeValue = useStore((state) => state.getThemeValue);

  return {
    theme,
    accentColor,
    animations,
    fontSize,
    highContrast,
    isDark: theme === 'dark',
    prefersReducedMotion: !animations,
    themes,
    accentColors,
    fontSizes,
    setTheme,
    toggleTheme,
    resetToSystem: resetToSystemTheme,
    setAccentColor,
    setAnimations,
    setFontSize,
    setHighContrast,
    enableTransitions,
    getThemeValue
  };
};