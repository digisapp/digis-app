/**
 * Test data and fixtures for E2E tests
 */

export const testUsers = {
  creator: {
    id: 'creator-test-123',
    email: 'creator@test.com',
    password: 'TestPassword123!',
    username: 'testcreator',
    is_creator: true,
    token_balance: 0,
    profile: {
      display_name: 'Test Creator',
      bio: 'Testing ticketed shows',
      avatar_url: 'https://via.placeholder.com/150'
    }
  },
  viewer1: {
    id: 'viewer1-test-123',
    email: 'viewer1@test.com',
    password: 'TestPassword123!',
    username: 'viewer1',
    is_creator: false,
    token_balance: 2000,
    profile: {
      display_name: 'Viewer One',
      bio: 'Rich viewer with tokens',
      avatar_url: 'https://via.placeholder.com/150'
    }
  },
  viewer2: {
    id: 'viewer2-test-123',
    email: 'viewer2@test.com',
    password: 'TestPassword123!',
    username: 'viewer2',
    is_creator: false,
    token_balance: 100,
    profile: {
      display_name: 'Viewer Two',
      bio: 'Viewer with limited tokens',
      avatar_url: 'https://via.placeholder.com/150'
    }
  },
  richViewer: {
    id: 'rich-viewer-123',
    email: 'rich@test.com',
    password: 'TestPassword123!',
    username: 'richviewer',
    is_creator: false,
    token_balance: 10000,
    profile: {
      display_name: 'Rich Viewer',
      bio: 'Loaded with tokens',
      avatar_url: 'https://via.placeholder.com/150'
    }
  }
};

export const testShows = {
  basic: {
    title: 'Exclusive Q&A Session',
    description: 'Personal Q&A and behind the scenes content!',
    tokenPrice: 500,
    maxTickets: null,
    earlyBirdPrice: null,
    earlyBirdDeadline: null
  },
  premium: {
    title: 'VIP Private Show',
    description: 'Ultra exclusive content for VIP members only',
    tokenPrice: 2000,
    maxTickets: 10,
    earlyBirdPrice: 1500,
    earlyBirdDeadline: new Date(Date.now() + 30 * 60000).toISOString() // 30 mins from now
  },
  limited: {
    title: 'Limited Seats Special',
    description: 'Only 5 seats available!',
    tokenPrice: 1000,
    maxTickets: 5,
    earlyBirdPrice: 800,
    earlyBirdDeadline: new Date(Date.now() + 15 * 60000).toISOString() // 15 mins from now
  },
  scheduled: {
    title: 'Scheduled Show',
    description: 'Starting in 1 hour',
    tokenPrice: 750,
    maxTickets: 50,
    startTime: new Date(Date.now() + 60 * 60000).toISOString(), // 1 hour from now
    earlyBirdPrice: 600,
    earlyBirdDeadline: new Date(Date.now() + 45 * 60000).toISOString() // 45 mins from now
  }
};

export const testStreams = {
  activePublic: {
    id: 'stream-public-123',
    title: 'Public Live Stream',
    creator_id: testUsers.creator.id,
    status: 'live',
    is_private: false,
    viewer_count: 45
  },
  withTicketedShow: {
    id: 'stream-ticketed-123',
    title: 'Stream with Private Show',
    creator_id: testUsers.creator.id,
    status: 'live',
    is_private: false,
    viewer_count: 120,
    has_ticketed_show: true
  }
};

export const mockSocketEvents = {
  ticketedShowAnnounced: {
    event: 'ticketed_show_announced',
    data: {
      show: {
        id: 'show-123',
        title: 'New Private Show',
        token_price: 500,
        creator_id: testUsers.creator.id,
        stream_id: testStreams.withTicketedShow.id
      }
    }
  },
  privateModeStarted: {
    event: 'private_mode_started',
    data: {
      showId: 'show-123',
      streamId: testStreams.withTicketedShow.id,
      ticketHolders: ['viewer1-test-123']
    }
  },
  ticketPurchased: {
    event: 'ticket_purchased',
    data: {
      showId: 'show-123',
      viewerId: 'viewer1-test-123',
      ticketsSold: 1
    }
  },
  enablePrivateVideo: {
    event: 'enable_private_video',
    data: {
      showId: 'show-123',
      viewerId: 'viewer1-test-123'
    }
  },
  privateShowEnded: {
    event: 'private_show_ended',
    data: {
      showId: 'show-123',
      streamId: testStreams.withTicketedShow.id
    }
  }
};

export const mockApiResponses = {
  announceShow: {
    success: true,
    show: {
      id: 'show-new-123',
      stream_id: testStreams.withTicketedShow.id,
      creator_id: testUsers.creator.id,
      title: testShows.basic.title,
      description: testShows.basic.description,
      token_price: testShows.basic.tokenPrice,
      status: 'announced',
      created_at: new Date().toISOString()
    }
  },
  buyTicket: {
    success: true,
    ticket: {
      id: 'ticket-123',
      show_id: 'show-123',
      viewer_id: testUsers.viewer1.id,
      tokens_paid: 500,
      purchased_at: new Date().toISOString()
    },
    newBalance: 1500
  },
  insufficientTokens: {
    success: false,
    error: 'Insufficient tokens. You need 500 tokens but only have 100.'
  },
  showDetails: {
    success: true,
    show: {
      id: 'show-123',
      title: testShows.basic.title,
      token_price: 500,
      current_price: 500,
      status: 'announced',
      tickets_sold: 5,
      max_tickets: null
    },
    hasTicket: false,
    ticketsSold: 5
  },
  analytics: {
    success: true,
    analytics: {
      tickets_sold: 25,
      revenue_generated: 12500,
      peak_viewers: 30,
      avg_watch_time_seconds: 1800,
      early_bird_sales: 10,
      regular_sales: 15,
      conversion_rate: 0.65
    }
  }
};

/**
 * Mock Stripe payment data
 */
export const mockStripeData = {
  testCard: {
    number: '4242424242424242',
    exp_month: '12',
    exp_year: '2030',
    cvc: '123',
    zip: '10001'
  },
  insufficientFundsCard: {
    number: '4000000000009995',
    exp_month: '12',
    exp_year: '2030',
    cvc: '123',
    zip: '10001'
  }
};

/**
 * Test selectors for common elements
 */
export const selectors = {
  // Authentication
  authButton: '[data-testid="auth-button"]',
  emailInput: 'input[type="email"]',
  passwordInput: 'input[type="password"]',
  loginButton: 'button:has-text("Sign In")',
  
  // Stream elements
  streamPlayer: '[data-testid="stream-player"]',
  streamChat: '[data-testid="stream-chat"]',
  chatInput: '[data-testid="chat-input"]',
  chatMessage: '[data-testid="chat-message"]',
  
  // Ticketed show elements
  announceButton: 'button:has-text("Announce Private Show")',
  privateShowControls: '[data-testid="private-show-controls"]',
  buyTicketButton: 'button:has-text("Buy Ticket")',
  ticketCounter: '[data-testid="ticket-counter"]',
  videoLockScreen: '[data-testid="video-lock-screen"]',
  
  // Wallet
  tokenBalance: '[data-testid="token-balance"]',
  purchaseTokenButton: '[data-testid="purchase-tokens"]',
  
  // Notifications
  toast: '[data-testid="toast"]',
  successToast: '[data-testid="toast-success"]',
  errorToast: '[data-testid="toast-error"]'
};

/**
 * Wait times for various operations
 */
export const waitTimes = {
  shortAnimation: 300,
  navigation: 1000,
  apiCall: 2000,
  streamLoad: 5000,
  socketConnection: 3000,
  videoLoad: 10000
};

/**
 * Environment-specific configurations
 */
export const testConfig = {
  baseUrl: process.env.VITE_FRONTEND_URL || 'http://localhost:5173',
  apiUrl: process.env.VITE_BACKEND_URL || 'http://localhost:5002',
  socketUrl: process.env.VITE_SOCKET_URL || 'ws://localhost:5002',
  supabaseUrl: process.env.VITE_SUPABASE_URL || 'https://test.supabase.co',
  supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY || 'test-anon-key'
};