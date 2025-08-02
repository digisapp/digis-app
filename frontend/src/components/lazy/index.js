/**
 * Lazy-loaded components for performance optimization
 * Features: code splitting, chunk naming, preloading
 */

import { createLazyRoute, createChunkImport, chunkNames } from '../../utils/lazyLoading';

// Heavy components that benefit from code splitting

// Video-related components (largest bundle)
export const VideoCall = createLazyRoute(
  createChunkImport(chunkNames.video, '../VideoCall'),
  'page'
);

export const EnhancedVideoCall = createLazyRoute(
  createChunkImport(chunkNames.video, '../EnhancedVideoCall'),
  'modal'
);

export const InteractiveVideoFeatures = createLazyRoute(
  createChunkImport(chunkNames.video, '../InteractiveVideoFeatures'),
  'component'
);

// Creator tools (heavy functionality)
export const CreatorStudio = createLazyRoute(
  createChunkImport(chunkNames.creator, '../CreatorStudio'),
  'page'
);

export const StreamRecordingManager = createLazyRoute(
  createChunkImport(chunkNames.creator, '../StreamRecordingManager'),
  'component'
);

export const MultiCreatorCollaboration = createLazyRoute(
  createChunkImport(chunkNames.creator, '../MultiCreatorCollaboration'),
  'component'
);

// Chat and communication
export const Chat = createLazyRoute(
  createChunkImport(chunkNames.chat, '../Chat'),
  'component'
);

export const InteractivePolls = createLazyRoute(
  createChunkImport(chunkNames.chat, '../InteractivePolls'),
  'component'
);

// Admin components (rarely used)
export const AdminDashboard = createLazyRoute(
  createChunkImport(chunkNames.admin, '../AdminDashboard'),
  'page'
);

export const PrivacySettings = createLazyRoute(
  createChunkImport(chunkNames.admin, '../PrivacySettings'),
  'page'
);

// Tokens
export const TokenPurchase = createLazyRoute(
  createChunkImport(chunkNames.tokens, '../TokenPurchase'),
  'modal'
);

// Preload critical components on app start
export const preloadCriticalComponents = () => {
  // Preload components likely to be used soon
  import('../VideoCall');
  import('../Chat');
  import('../TokenPurchase');
};

// Preload on user interaction
export const preloadOnHover = {
  creatorStudio: () => import('../CreatorStudio'),
  adminDashboard: () => import('../AdminDashboard')
};

export default {
  VideoCall,
  EnhancedVideoCall,
  InteractiveVideoFeatures,
  CreatorStudio,
  StreamRecordingManager,
  MultiCreatorCollaboration,
  Chat,
  InteractivePolls,
  AdminDashboard,
  PrivacySettings,
  TokenPurchase,
  preloadCriticalComponents,
  preloadOnHover
};