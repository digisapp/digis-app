// Socket utility wrapper
// This file exports the socket service for backward compatibility

import socketService from '../services/socket';

export default socketService;

// Re-export common methods for convenience
export const {
  connect,
  disconnect,
  emit,
  on,
  off,
  getSocket,
  isConnected
} = socketService;