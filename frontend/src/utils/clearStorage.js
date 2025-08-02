// Utility function to clear all browser storage and cookies
export const clearAllStorage = () => {
  // Clear localStorage
  localStorage.clear();
  
  // Clear sessionStorage
  sessionStorage.clear();
  
  // Clear all cookies
  document.cookie.split(";").forEach(function(c) {
    document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
  });
  
  console.log('✅ All browser storage cleared');
};

// Force clear and redirect to a specific path
export const clearAndRedirect = (path = '/') => {
  clearAllStorage();
  window.location.href = path;
};

// Clear storage and reload the app
export const clearAndReload = () => {
  clearAllStorage();
  window.location.reload();
};