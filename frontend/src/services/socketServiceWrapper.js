/**
 * Socket Service Wrapper - Feature Flag Based Selection
 *
 * Conditionally exports either Socket.io or Ably based on VITE_USE_ABLY flag.
 * This allows for zero-downtime migration to Vercel-compatible Ably.
 *
 * Usage:
 * import socketService from './services/socketServiceWrapper';
 * await socketService.connect();
 */

const USE_ABLY = import.meta.env.VITE_USE_ABLY === 'true';

console.log(`🔌 Real-time service: ${USE_ABLY ? 'Ably (Vercel)' : 'Socket.io (legacy)'}`);

// Import the correct service based on feature flag
let service;
if (USE_ABLY) {
  const { default: ablyService } = await import('./ablyService.js');
  service = ablyService;
} else {
  const { default: socketService } = await import('./socket.js');
  service = socketService;
}

export default service;
