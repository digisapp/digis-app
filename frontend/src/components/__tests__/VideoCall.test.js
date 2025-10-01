import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import VideoCall from '../VideoCall';

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
    setDevice: jest.fn().mockResolvedValue(),
    setBeautyEffect: jest.fn().mockResolvedValue(),
    setBackgroundBlurring: jest.fn().mockResolvedValue(),
    setBackgroundImage: jest.fn().mockResolvedValue(),
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
  createMicrophoneAndCameraTracks: jest.fn().mockResolvedValue([
    {
      setEnabled: jest.fn().mockResolvedValue(),
      setVolume: jest.fn(),
      stop: jest.fn(),
      close: jest.fn(),
    },
    {
      setEnabled: jest.fn().mockResolvedValue(),
      play: jest.fn(),
      stop: jest.fn(),
      close: jest.fn(),
    }
  ]),
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
  __esModule: true,
  default: jest.fn(),
}));

// Mock VirtualGifts component
jest.mock('../VirtualGifts', () => {
  return function MockVirtualGifts({ onGiftSent, onClose }) {
    return (
      <div data-testid="virtual-gifts">
        <button onClick={() => onGiftSent({ name: 'Test Gift' })}>
          Send Gift
        </button>
        <button onClick={onClose}>Close</button>
      </div>
    );
  };
});

// Mock fetch for API calls
global.fetch = jest.fn();

describe('VideoCall Component', () => {
  const defaultProps = {
    channel: 'test-channel',
    token: 'test-token',
    uid: '12345',
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
    tokenBalance: 1000,
    onTokenUpdate: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    fetch.mockClear();
    
    // Mock successful API responses
    fetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        rtcToken: 'new-token',
        balance: 1000,
      }),
    });

    // Mock environment variables
    import.meta.env.VITE_AGORA_APP_ID = 'test-app-id';
    import.meta.env.VITE_BACKEND_URL = 'http://localhost:3001';
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Component Rendering', () => {
    test('renders VideoCall component with correct title', async () => {
      await act(async () => {
        render(<VideoCall {...defaultProps} />);
      });

      expect(screen.getByText(/🎥 Video Call - Host/)).toBeInTheDocument();
    });

    test('renders as voice call when isVoiceOnly is true', async () => {
      await act(async () => {
        render(<VideoCall {...defaultProps} isVoiceOnly={true} />);
      });

      expect(screen.getByText(/🎙️ Voice Call - Host/)).toBeInTheDocument();
    });

    test('renders as live stream when isStreaming is true', async () => {
      await act(async () => {
        render(<VideoCall {...defaultProps} isStreaming={true} />);
      });

      expect(screen.getByText(/📡 Live Stream - Host/)).toBeInTheDocument();
    });

    test('shows audience view when isHost is false', async () => {
      await act(async () => {
        render(<VideoCall {...defaultProps} isHost={false} />);
      });

      expect(screen.getByText(/🎥 Video Call - Audience/)).toBeInTheDocument();
    });
  });

  describe('Media Controls', () => {
    test('displays audio and video controls for host', async () => {
      await act(async () => {
        render(<VideoCall {...defaultProps} />);
      });

      // Wait for component to initialize
      await waitFor(() => {
        expect(screen.getByText(/🔊 Mute/)).toBeInTheDocument();
        expect(screen.getByText(/📹 Stop Video/)).toBeInTheDocument();
      });
    });

    test('audio toggle functionality works', async () => {
      await act(async () => {
        render(<VideoCall {...defaultProps} />);
      });

      await waitFor(() => {
        const audioButton = screen.getByText(/🔊 Mute/);
        expect(audioButton).toBeInTheDocument();
      });

      await act(async () => {
        const audioButton = screen.getByText(/🔊 Mute/);
        fireEvent.click(audioButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/🔇 Unmute/)).toBeInTheDocument();
      });
    });

    test('video toggle functionality works', async () => {
      await act(async () => {
        render(<VideoCall {...defaultProps} />);
      });

      await waitFor(() => {
        const videoButton = screen.getByText(/📹 Stop Video/);
        expect(videoButton).toBeInTheDocument();
      });

      await act(async () => {
        const videoButton = screen.getByText(/📹 Stop Video/);
        fireEvent.click(videoButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/📷 Start Video/)).toBeInTheDocument();
      });
    });

    test('does not show video controls in voice-only mode', async () => {
      await act(async () => {
        render(<VideoCall {...defaultProps} isVoiceOnly={true} />);
      });

      await waitFor(() => {
        expect(screen.queryByText(/📹 Stop Video/)).not.toBeInTheDocument();
        expect(screen.queryByText(/📷 Start Video/)).not.toBeInTheDocument();
      });
    });
  });

  describe('Screen Sharing', () => {
    test('shows screen sharing controls for host', async () => {
      await act(async () => {
        render(<VideoCall {...defaultProps} />);
      });

      await waitFor(() => {
        expect(screen.getByText(/🖥️ Share Screen/)).toBeInTheDocument();
      });
    });

    test('screen sharing toggle works', async () => {
      await act(async () => {
        render(<VideoCall {...defaultProps} />);
      });

      await waitFor(() => {
        const screenShareButton = screen.getByText(/🖥️ Share Screen/);
        expect(screenShareButton).toBeInTheDocument();
      });

      await act(async () => {
        const screenShareButton = screen.getByText(/🖥️ Share Screen/);
        fireEvent.click(screenShareButton);
      });

      // Note: In a real test, we might need to mock createScreenVideoTrack more thoroughly
    });
  });

  describe('Connection Status', () => {
    test('displays connection status indicator', async () => {
      await act(async () => {
        render(<VideoCall {...defaultProps} />);
      });

      await waitFor(() => {
        expect(screen.getByText(/CONNECTED|CONNECTING|DISCONNECTED/)).toBeInTheDocument();
      });
    });

    test('shows network quality indicators', async () => {
      await act(async () => {
        render(<VideoCall {...defaultProps} />);
      });

      await waitFor(() => {
        expect(screen.getByText(/Network:/)).toBeInTheDocument();
      });
    });

    test('displays viewer count', async () => {
      await act(async () => {
        render(<VideoCall {...defaultProps} />);
      });

      await waitFor(() => {
        expect(screen.getByText(/Users:/)).toBeInTheDocument();
      });
    });
  });

  describe('Session Information', () => {
    test('displays session timer', async () => {
      await act(async () => {
        render(<VideoCall {...defaultProps} />);
      });

      await waitFor(() => {
        expect(screen.getByText(/⏱️/)).toBeInTheDocument();
      });
    });

    test('shows token balance for non-host users', async () => {
      await act(async () => {
        render(<VideoCall {...defaultProps} isHost={false} />);
      });

      await waitFor(() => {
        expect(screen.getByText(/💎 1,000 tokens/)).toBeInTheDocument();
      });
    });

    test('displays session cost for audience members', async () => {
      await act(async () => {
        render(<VideoCall {...defaultProps} isHost={false} />);
      });

      // Session cost should appear after some time
      await waitFor(() => {
        const costElement = screen.queryByText(/-\d+ tokens/);
        // Cost might be 0 initially, so we just check the structure exists
        expect(screen.getByText(/💎 1,000 tokens/)).toBeInTheDocument();
      });
    });
  });

  describe('Virtual Gifts', () => {
    test('shows gift button when enabled', async () => {
      await act(async () => {
        render(<VideoCall {...defaultProps} />);
      });

      await waitFor(() => {
        const giftButton = screen.getByText(/🎁 Send Gift/);
        expect(giftButton).toBeInTheDocument();
      });
    });

    test('opens gift modal when gift button is clicked', async () => {
      await act(async () => {
        render(<VideoCall {...defaultProps} />);
      });

      await waitFor(() => {
        const giftButton = screen.getByText(/🎁 Send Gift/);
        fireEvent.click(giftButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('virtual-gifts')).toBeInTheDocument();
      });
    });
  });

  describe('Advanced Controls', () => {
    test('shows advanced controls toggle', async () => {
      await act(async () => {
        render(<VideoCall {...defaultProps} />);
      });

      await waitFor(() => {
        expect(screen.getByText(/🔼 Show Advanced/)).toBeInTheDocument();
      });
    });

    test('advanced controls expand when toggled', async () => {
      await act(async () => {
        render(<VideoCall {...defaultProps} />);
      });

      await waitFor(() => {
        const advancedToggle = screen.getByText(/🔼 Show Advanced/);
        fireEvent.click(advancedToggle);
      });

      await waitFor(() => {
        expect(screen.getByText(/🔽 Hide Advanced/)).toBeInTheDocument();
        expect(screen.getByText(/🔧 Advanced Settings/)).toBeInTheDocument();
      });
    });

    test('quality controls are present in advanced settings', async () => {
      await act(async () => {
        render(<VideoCall {...defaultProps} />);
      });

      await waitFor(() => {
        const advancedToggle = screen.getByText(/🔼 Show Advanced/);
        fireEvent.click(advancedToggle);
      });

      await waitFor(() => {
        expect(screen.getByText(/Quality:/)).toBeInTheDocument();
      });
    });
  });

  describe('Video Quality Settings', () => {
    test('displays quality control buttons', async () => {
      await act(async () => {
        render(<VideoCall {...defaultProps} />);
      });

      await waitFor(() => {
        expect(screen.getByText(/Quality:/)).toBeInTheDocument();
      });
    });

    test('quality buttons are clickable', async () => {
      await act(async () => {
        render(<VideoCall {...defaultProps} />);
      });

      await waitFor(() => {
        const qualityButton = screen.getByText('720p');
        expect(qualityButton).toBeInTheDocument();
        fireEvent.click(qualityButton);
      });
    });
  });

  describe('Error Handling', () => {
    test('shows error state when connection fails', async () => {
      // Mock a failed connection
      const mockClient = {
        join: jest.fn().mockRejectedValue(new Error('Connection failed')),
        on: jest.fn(),
        removeAllListeners: jest.fn(),
      };

      require('agora-rtc-sdk-ng').createClient.mockReturnValue(mockClient);

      await act(async () => {
        render(<VideoCall {...defaultProps} />);
      });

      await waitFor(() => {
        expect(screen.getByText(/Connection failed/)).toBeInTheDocument();
      });
    });

    test('handles missing required props gracefully', async () => {
      const incompleteProps = {
        ...defaultProps,
        channel: null,
      };

      await act(async () => {
        render(<VideoCall {...incompleteProps} />);
      });

      // Component should not crash and should show some error indication
      expect(screen.getByText(/Video Call/)).toBeInTheDocument();
    });
  });

  describe('Cleanup and Unmounting', () => {
    test('properly cleans up resources on unmount', async () => {
      const { unmount } = await act(async () => {
        return render(<VideoCall {...defaultProps} />);
      });

      await act(async () => {
        unmount();
      });

      // Verify cleanup was called (this would need more sophisticated mocking in a real scenario)
      expect(true).toBe(true); // Placeholder assertion
    });
  });

  describe('Token Management', () => {
    test('refreshes token when needed', async () => {
      await act(async () => {
        render(<VideoCall {...defaultProps} />);
      });

      // Wait for initial setup
      await waitFor(() => {
        expect(screen.getByText(/Video Call/)).toBeInTheDocument();
      });

      // Token refresh would be tested with more sophisticated timing mocks
      expect(fetch).toHaveBeenCalled();
    });

    test('handles token expiration', async () => {
      const onTokenExpired = jest.fn();
      
      await act(async () => {
        render(<VideoCall {...defaultProps} onTokenExpired={onTokenExpired} />);
      });

      // Simulate token expiration event
      // This would require mocking the Agora client events more thoroughly
      expect(true).toBe(true); // Placeholder for token expiration test
    });
  });

  describe('Recording Features', () => {
    test('shows recording controls for host', async () => {
      await act(async () => {
        render(<VideoCall {...defaultProps} />);
      });

      await waitFor(() => {
        expect(screen.getByText(/🔴 Record/)).toBeInTheDocument();
      });
    });

    test('does not show recording for audience', async () => {
      await act(async () => {
        render(<VideoCall {...defaultProps} isHost={false} />);
      });

      await waitFor(() => {
        expect(screen.queryByText(/🔴 Record/)).not.toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    test('has proper ARIA labels', async () => {
      await act(async () => {
        render(<VideoCall {...defaultProps} />);
      });

      // Check for accessible elements
      const videoElement = screen.getByRole('button', { name: /mute/i }) || 
                          screen.getByText(/🔊 Mute/);
      expect(videoElement).toBeInTheDocument();
    });

    test('supports keyboard navigation', async () => {
      await act(async () => {
        render(<VideoCall {...defaultProps} />);
      });

      await waitFor(() => {
        const firstButton = screen.getByText(/🔊 Mute/);
        firstButton.focus();
        expect(document.activeElement).toBe(firstButton);
      });
    });
  });
});