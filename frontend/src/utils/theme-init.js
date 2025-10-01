// Theme initialization utility
// Ensures app defaults to light theme but respects user preference

export const initializeTheme = () => {
  // Check if user has a saved theme preference
  const savedTheme = localStorage.getItem('theme');
  
  // Check system preference
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  // Determine which theme to use (priority order):
  // 1. User's saved preference
  // 2. System preference
  // 3. Default to light theme
  let theme = 'light';
  
  if (savedTheme) {
    theme = savedTheme;
  } else if (prefersDark) {
    // Only use system preference if no saved preference exists
    theme = 'dark';
  }
  
  // Apply theme to document
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
  
  // Save the theme preference
  localStorage.setItem('theme', theme);
  
  return theme;
};

// Listen for system theme changes
export const watchSystemTheme = (callback) => {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  
  const handleChange = (e) => {
    // Only change if user hasn't manually set a preference
    const savedTheme = localStorage.getItem('theme-manual');
    if (!savedTheme) {
      const theme = e.matches ? 'dark' : 'light';
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      localStorage.setItem('theme', theme);
      if (callback) callback(theme);
    }
  };
  
  // Modern browsers
  if (mediaQuery.addEventListener) {
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }
  // Legacy browsers
  else if (mediaQuery.addListener) {
    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }
};

// Toggle theme function
export const toggleTheme = () => {
  const isDark = document.documentElement.classList.contains('dark');
  const newTheme = isDark ? 'light' : 'dark';
  
  if (newTheme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
  
  // Save theme preference and mark as manually set
  localStorage.setItem('theme', newTheme);
  localStorage.setItem('theme-manual', 'true');
  
  return newTheme;
};

// Get current theme
export const getCurrentTheme = () => {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
};