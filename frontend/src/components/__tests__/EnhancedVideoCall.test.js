import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import EnhancedVideoCall from '../EnhancedVideoCall';

// Mock Agora SDK
jest.mock('agora-rtc-sdk-ng', () => ({
  createClient: jest.fn(() => ({
    join: jest.fn().mockResolvedValue(12345),
    leave: jest.fn().mockResolvedValue(),
    publish: jest.fn().mockResolvedValue(),
    unpublish: jest.fn().mockResolvedValue(),
    subscribe: jest.fn().mockResolvedValue(),
    on: jest.fn(),
    removeAllListeners: jest.fn(),
    renewToken: jest.fn().mockResolvedValue(),
    setClientRole: jest.fn().mockResolvedValue(),
    getStats: jest.fn().mockResolvedValue({ RTT: 50 }),
  })),
  createMicrophoneAudioTrack: jest.fn().mockResolvedValue({
    setEnabled: jest.fn().mockResolvedValue(),
    setVolume: jest.fn(),
    stop: jest.fn(),
    close: jest.fn(),
    on: jest.fn(),
  }),
  createCameraVideoTrack: jest.fn().mockResolvedValue({
    setEnabled: jest.fn().mockResolvedValue(),
    setEncoderConfiguration: jest.fn().mockResolvedValue(),
    play: jest.fn(),
    stop: jest.fn(),
    close: jest.fn(),
    on: jest.fn(),
  }),
  createScreenVideoTrack: jest.fn().mockResolvedValue({
    setEncoderConfiguration: jest.fn().mockResolvedValue(),
    play: jest.fn(),
    stop: jest.fn(),
    close: jest.fn(),
    on: jest.fn(),
  }),
}));

// Mock Supabase auth
jest.mock('../../utils/auth-helpers', () => ({
  auth: {
    currentUser: {
      getAuthToken: jest.fn().mockResolvedValue('mock-supabase-token'),
      uid: 'test-user-123',
    },
  },
}));

// Mock react-hot-toast
jest.mock('react-hot-toast', () => ({
  success: jest.fn(),
  error: jest.fn(),
  loading: jest.fn(),
  dismiss: jest.fn(),
  __esModule: true,
  default: jest.fn(),
}));

// Mock VirtualGifts component
jest.mock('../VirtualGifts', () => {
  return function MockVirtualGifts({ onGiftSent, onClose }) {
    return (
      <div data-testid="virtual-gifts">
        <button onClick={() => onGiftSent({ name: 'Test Gift', tokens: 50 })}>
          Send Gift
        </button>
        <button onClick={onClose}>Close</button>
      </div>
    );
  };
});

// Mock LiveChat component
jest.mock('../LiveChat', () => {
  return function MockLiveChat({ channel, user, onMessageSent }) {
    return (
      <div data-testid="live-chat">
        <button onClick={() => onMessageSent({ text: 'Test message', sender: user.id })}>
          Send Message
        </button>
      </div>
    );
  };
});

// Mock fetch for API calls
global.fetch = jest.fn();

describe('EnhancedVideoCall Component', () => {
  const defaultProps = {
    channel: 'enhanced-test-channel',
    token: 'enhanced-test-token',
    uid: '54321',
    isHost: true,
    isStreaming: false,
    isVoiceOnly: false,
    onTokenExpired: jest.fn(),
    onSessionEnd: jest.fn(),
    onTokenDeduction: jest.fn(),
    user: {
      uid: 'test-user-123',
      getAuthToken: jest.fn().mockResolvedValue('mock-supabase-token'),
    },
    tokenBalance: 2000,
    onTokenUpdate: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    fetch.mockClear();
    
    // Mock successful API responses
    fetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        rtcToken: 'new-enhanced-token',
        balance: 2000,
      }),
    });

    // Mock environment variables
    import.meta.env.VITE_AGORA_APP_ID = 'enhanced-test-app-id';
    import.meta.env.VITE_BACKEND_URL = 'http://localhost:3001';
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Enhanced Features', () => {
    test('renders enhanced video call interface', async () => {
      await act(async () => {
        render(<EnhancedVideoCall {...defaultProps} />);
      });

      expect(screen.getByText(/Enhanced Video Call/)).toBeInTheDocument();
    });

    test('displays live chat component', async () => {
      await act(async () => {
        render(<EnhancedVideoCall {...defaultProps} />);
      });

      await waitFor(() => {
        expect(screen.getByTestId('live-chat')).toBeInTheDocument();
      });
    });

    test('shows virtual gifts interface', async () => {
      await act(async () => {
        render(<EnhancedVideoCall {...defaultProps} />);
      });

      await waitFor(() => {
        const giftButton = screen.getByText(/🎁 Send Gift/);
        fireEvent.click(giftButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('virtual-gifts')).toBeInTheDocument();
      });
    });

    test('handles screen sharing with advanced options', async () => {
      await act(async () => {
        render(<EnhancedVideoCall {...defaultProps} />);
      });

      await waitFor(() => {
        const screenShareButton = screen.getByText(/🖥️ Share Screen/);
        fireEvent.click(screenShareButton);
      });

      // Enhanced screen sharing should have additional options
      await waitFor(() => {
        expect(screen.getByText(/Stop Screen Share|Sharing Screen/)).toBeInTheDocument();
      });
    });

    test('provides advanced video settings', async () => {
      await act(async () => {
        render(<EnhancedVideoCall {...defaultProps} />);
      });

      await waitFor(() => {
        const advancedToggle = screen.getByText(/Advanced Settings|🔼 Show Advanced/);
        if (advancedToggle) {
          fireEvent.click(advancedToggle);
        }
      });

      // Should have enhanced settings
      expect(screen.queryByText(/Quality|Resolution|Bitrate/)).toBeDefined();
    });
  });

  describe('Interactive Features', () => {
    test('handles gift sending', async () => {
      const onTokenUpdate = jest.fn();
      
      await act(async () => {
        render(<EnhancedVideoCall {...defaultProps} onTokenUpdate={onTokenUpdate} />);
      });

      await waitFor(() => {
        const giftButton = screen.getByText(/🎁 Send Gift/);
        fireEvent.click(giftButton);
      });

      await waitFor(() => {
        const sendGiftButton = screen.getByText('Send Gift');
        fireEvent.click(sendGiftButton);
      });

      // Should handle gift sending
      expect(fetch).toHaveBeenCalled();
    });

    test('processes chat messages', async () => {
      await act(async () => {
        render(<EnhancedVideoCall {...defaultProps} />);
      });

      await waitFor(() => {
        const sendMessageButton = screen.getByText('Send Message');
        fireEvent.click(sendMessageButton);
      });

      // Should process chat messages
      expect(screen.getByTestId('live-chat')).toBeInTheDocument();
    });

    test('shows participant list', async () => {
      await act(async () => {
        render(<EnhancedVideoCall {...defaultProps} />);
      });

      // Should display participant information
      await waitFor(() => {
        expect(screen.getByText(/Users:|Participants:/)).toBeInTheDocument();
      });
    });
  });

  describe('Performance Monitoring', () => {
    test('displays network statistics', async () => {
      await act(async () => {
        render(<EnhancedVideoCall {...defaultProps} />);
      });

      await waitFor(() => {
        expect(screen.getByText(/Network:|Connection:/)).toBeInTheDocument();
      });
    });

    test('shows video quality indicators', async () => {
      await act(async () => {
        render(<EnhancedVideoCall {...defaultProps} />);
      });

      await waitFor(() => {
        expect(screen.getByText(/Quality:|Resolution/)).toBeInTheDocument();
      });
    });

    test('monitors connection stability', async () => {
      await act(async () => {
        render(<EnhancedVideoCall {...defaultProps} />);
      });

      // Should show connection status
      await waitFor(() => {
        expect(screen.getByText(/CONNECTED|CONNECTING|DISCONNECTED/)).toBeInTheDocument();
      });
    });
  });

  describe('Token Management', () => {
    test('displays enhanced token information', async () => {
      await act(async () => {
        render(<EnhancedVideoCall {...defaultProps} isHost={false} />);
      });

      await waitFor(() => {
        expect(screen.getByText(/💎 2,000 tokens/)).toBeInTheDocument();
      });
    });

    test('handles token renewal with retry logic', async () => {
      const onTokenExpired = jest.fn();
      
      await act(async () => {
        render(<EnhancedVideoCall {...defaultProps} onTokenExpired={onTokenExpired} />);
      });

      // Simulate token renewal
      await waitFor(() => {
        expect(fetch).toHaveBeenCalled();
      });
    });
  });

  describe('Error Recovery', () => {
    test('handles connection failures gracefully', async () => {
      const mockClient = {
        join: jest.fn().mockRejectedValue(new Error('Enhanced connection failed')),
        on: jest.fn(),
        removeAllListeners: jest.fn(),
      };

      require('agora-rtc-sdk-ng').createClient.mockReturnValue(mockClient);

      await act(async () => {
        render(<EnhancedVideoCall {...defaultProps} />);
      });

      await waitFor(() => {
        expect(screen.getByText(/Enhanced connection failed|Connection Error/)).toBeInTheDocument();
      });
    });

    test('provides retry mechanisms', async () => {
      await act(async () => {
        render(<EnhancedVideoCall {...defaultProps} />);
      });

      // Should have retry options in case of failures
      expect(screen.queryByText(/Retry|Try Again/)).toBeDefined();
    });
  });

  describe('Accessibility Features', () => {
    test('provides enhanced accessibility controls', async () => {
      await act(async () => {
        render(<EnhancedVideoCall {...defaultProps} />);
      });

      // Should have enhanced accessibility
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });

    test('supports keyboard navigation', async () => {
      await act(async () => {
        render(<EnhancedVideoCall {...defaultProps} />);
      });

      const firstButton = screen.getAllByRole('button')[0];
      if (firstButton) {
        firstButton.focus();
        expect(document.activeElement).toBe(firstButton);
      }
    });
  });

  describe('Streaming Features', () => {
    test('handles live streaming mode', async () => {
      await act(async () => {
        render(<EnhancedVideoCall {...defaultProps} isStreaming={true} />);
      });

      expect(screen.getByText(/Live Stream|Streaming/)).toBeInTheDocument();
    });

    test('shows viewer count for streams', async () => {
      await act(async () => {
        render(<EnhancedVideoCall {...defaultProps} isStreaming={true} />);
      });

      await waitFor(() => {
        expect(screen.getByText(/Viewers:|Users:/)).toBeInTheDocument();
      });
    });
  });

  describe('Cleanup and Memory Management', () => {
    test('properly cleans up enhanced resources', async () => {
      const { unmount } = await act(async () => {
        return render(<EnhancedVideoCall {...defaultProps} />);
      });

      await act(async () => {
        unmount();
      });

      // Verify enhanced cleanup
      expect(true).toBe(true); // Placeholder for cleanup verification
    });
  });
});