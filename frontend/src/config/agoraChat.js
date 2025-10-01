// Agora Chat SDK Configuration
export const AGORA_CHAT_CONFIG = {
  appKey: '411305034#1504278',
  orgName: '411305034',
  appName: '1504278',
  apiUrl: 'https://a41.chat.agora.io',
  wsUrl: 'wss://msync-api-41.chat.agora.io',
  restApi: 'a41.chat.agora.io',
  isHttpDNS: true,
  delivery: true,
  useOwnUploadFun: false,
  https: true,
  isMultiLoginSessions: false,
  isChatRoomWhitelistEnabled: false,
  isAutoLogin: false
};

// Helper function to get Agora Chat connection options
export const getAgoraChatConnection = () => ({
  apiUrl: AGORA_CHAT_CONFIG.apiUrl,
  url: AGORA_CHAT_CONFIG.wsUrl,
  heartBeatWait: 30,
  delivery: AGORA_CHAT_CONFIG.delivery,
  useOwnUploadFun: AGORA_CHAT_CONFIG.useOwnUploadFun
});

// Message types
export const CHAT_MESSAGE_TYPES = {
  TEXT: 'txt',
  IMAGE: 'img',
  AUDIO: 'audio',
  VIDEO: 'video',
  FILE: 'file',
  LOCATION: 'loc',
  CMD: 'cmd',
  CUSTOM: 'custom'
};

// Chat room types
export const CHAT_ROOM_TYPES = {
  SINGLE: 'singleChat',
  GROUP: 'groupChat',
  CHAT_ROOM: 'chatRoom'
};