/**
 * Real-time Service Wrapper
 *
 * Exports Ably service for all real-time features (Socket.io fully replaced).
 * All connections use Ably for serverless compatibility (Vercel).
 *
 * Usage:
 * import socketService from './services/socketServiceWrapper';
 * await socketService.connect();
 */

console.log('🔌 Real-time service: Ably (serverless-compatible)');

// Import Ably service (Socket.io fully removed)
const { default: ablyService } = await import('./ablyService.js');

export default ablyService;
