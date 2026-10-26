// Offline detection utility
export const isOnline = (): boolean => {
  return navigator.onLine;
};

export const addOfflineListener = (callback: (isOnline: boolean) => void) => {
  const handleOnline = () => callback(true);
  const handleOffline = () => callback(false);
  
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
};

export const getOfflineMessage = (error: string): string => {
  if (!isOnline()) {
    return 'You appear to be offline. Some features may not work properly.';
  }
  
  if (error.includes('network') || error.includes('offline') || error.includes('Failed to get document')) {
    return 'Network connection issue. Please check your internet connection.';
  }
  
  return error;
};