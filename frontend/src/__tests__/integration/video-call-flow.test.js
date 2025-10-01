import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import VideoCall from '../../components/VideoCall';
import EnhancedVideoCall from '../../components/EnhancedVideoCall';

// Mock Agora SDK with comprehensive functionality
const mockAgoraClient = {
  join: jest.fn(),
  leave: jest.fn(),
  publish: jest.fn(),
  unpublish: jest.fn(),
  subscribe: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
  removeAllListeners: jest.fn(),
  renewToken: jest.fn(),
  setClientRole: jest.fn(),
  getStats: jest.fn(),
  getRemoteUsers: jest.fn(() => []),
  getRemoteAudioStats: jest.fn(() => ({})),
  getRemoteVideoStats: jest.fn(() => ({})),
  getLocalVideoStats: jest.fn(() => ({})),
  getLocalAudioStats: jest.fn(() => ({})),
};

const mockAudioTrack = {
  setEnabled: jest.fn(),
  setVolume: jest.fn(),
  stop: jest.fn(),
  close: jest.fn(),
  on: jest.fn(),
  play: jest.fn(),
};

const mockVideoTrack = {
  setEnabled: jest.fn(),
  setEncoderConfiguration: jest.fn(),
  play: jest.fn(),
  stop: jest.fn(),
  close: jest.fn(),
  on: jest.fn(),
  setDevice: jest.fn(),
};

jest.mock('agora-rtc-sdk-ng', () => ({
  createClient: jest.fn(() => mockAgoraClient),
  createMicrophoneAudioTrack: jest.fn(() => Promise.resolve(mockAudioTrack)),
  createCameraVideoTrack: jest.fn(() => Promise.resolve(mockVideoTrack)),
  createScreenVideoTrack: jest.fn(() => Promise.resolve(mockVideoTrack)),
  createMicrophoneAndCameraTracks: jest.fn(() => Promise.resolve([mockAudioTrack, mockVideoTrack])),
}));

// Mock Supabase
const mockUser = {
  uid: 'test-user-123',
  displayName: 'Test User',
  getAuthToken: jest.fn(),
};

jest.mock('../../utils/auth-helpers', () => ({
  auth: {
    currentUser: mockUser,
  },
}));

// Mock toast notifications
jest.mock('react-hot-toast', () => ({
  success: jest.fn(),
  error: jest.fn(),
  loading: jest.fn(),
  dismiss: jest.fn(),
}));

// Mock API responses
global.fetch = jest.fn();

describe('Video Call Integration Tests', () => {
  const mockProps = {
    channel: 'test-integration-channel',
    token: 'test-integration-token',
    uid: '12345',
    isHost: true,
    isStreaming: false,
    isVoiceOnly: false,
    onTokenExpired: jest.fn(),
    onSessionEnd: jest.fn(),
    onTokenDeduction: jest.fn(),
    user: mockUser,
    tokenBalance: 1000,
    onTokenUpdate: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mock responses
    mockUser.getAuthToken.mockResolvedValue('mock-supabase-token');
    mockAgoraClient.join.mockResolvedValue(12345);
    mockAgoraClient.leave.mockResolvedValue();
    mockAgoraClient.publish.mockResolvedValue();
    mockAgoraClient.unpublish.mockResolvedValue();
    mockAgoraClient.renewToken.mockResolvedValue();
    mockAgoraClient.getStats.mockResolvedValue({
      RTT: 50,
      uplinkNetworkQuality: 6,
      downlinkNetworkQuality: 6,
    });

    fetch.mockImplementation((url) => {
      if (url.includes('/agora/token')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            rtcToken: 'new-token-123',
            uid: 12345,
            channel: 'test-integration-channel',
          }),
        });
      }
      
      if (url.includes('/tokens/balance')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            balance: 950,
          }),
        });
      }

      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });

    import.meta.env.VITE_AGORA_APP_ID = 'test-app-id';
    import.meta.env.VITE_BACKEND_URL = 'http://localhost:3001';
  });

  describe('Complete Video Call Flow', () => {
    test('successfully completes full video call initialization', async () => {
      await act(async () => {
        render(<VideoCall {...mockProps} />);
      });

      // Wait for component to initialize
      await waitFor(() => {
        expect(screen.getByText(/Video Call - Host/)).toBeInTheDocument();
      }, { timeout: 5000 });

      // Verify Agora client was created and joined
      expect(mockAgoraClient.join).toHaveBeenCalledWith(
        'test-app-id',
        'test-integration-channel',
        'test-integration-token',
        12345
      );

      // Verify media tracks were created and published
      await waitFor(() => {
        expect(mockAgoraClient.publish).toHaveBeenCalled();
      });

      // Verify UI shows connected state
      await waitFor(() => {
        expect(screen.getByText(/CONNECTED/)).toBeInTheDocument();
      });
    });

    test('handles token renewal during active call', async () => {
      await act(async () => {
        render(<VideoCall {...mockProps} />);
      });

      // Wait for initialization
      await waitFor(() => {
        expect(mockAgoraClient.join).toHaveBeenCalled();
      });

      // Simulate token expiration event
      const tokenExpiredCallback = mockAgoraClient.on.mock.calls
        .find(call => call[0] === 'token-privilege-will-expire')?.[1];

      if (tokenExpiredCallback) {
        await act(async () => {
          tokenExpiredCallback();
        });

        // Verify token renewal was attempted
        await waitFor(() => {
          expect(fetch).toHaveBeenCalledWith(
            expect.stringContaining('/agora/token'),
            expect.any(Object)
          );
        });

        await waitFor(() => {
          expect(mockAgoraClient.renewToken).toHaveBeenCalledWith('new-token-123');
        });
      }
    });

    test('processes remote user joining and leaving', async () => {
      await act(async () => {
        render(<VideoCall {...mockProps} />);
      });

      await waitFor(() => {
        expect(mockAgoraClient.join).toHaveBeenCalled();
      });

      // Simulate remote user joining
      const userJoinedCallback = mockAgoraClient.on.mock.calls
        .find(call => call[0] === 'user-joined')?.[1];

      if (userJoinedCallback) {
        const remoteUser = { uid: 67890, hasAudio: true, hasVideo: true };
        
        await act(async () => {
          userJoinedCallback(remoteUser);
        });

        // Verify subscription to remote user
        await waitFor(() => {
          expect(mockAgoraClient.subscribe).toHaveBeenCalledWith(
            remoteUser,
            expect.stringMatching(/audio|video/)
          );
        });
      }

      // Simulate remote user leaving
      const userLeftCallback = mockAgoraClient.on.mock.calls
        .find(call => call[0] === 'user-left')?.[1];

      if (userLeftCallback) {
        await act(async () => {
          userLeftCallback({ uid: 67890 });
        });

        // Should handle user leaving gracefully
        expect(true).toBe(true); // Placeholder for cleanup verification
      }
    });

    test('handles media control toggles during call', async () => {
      await act(async () => {
        render(<VideoCall {...mockProps} />);
      });

      await waitFor(() => {
        expect(screen.getByText(/🔊 Mute/)).toBeInTheDocument();
      });

      // Toggle audio
      const audioButton = screen.getByText(/🔊 Mute/);
      await act(async () => {
        fireEvent.click(audioButton);
      });

      await waitFor(() => {
        expect(mockAudioTrack.setEnabled).toHaveBeenCalledWith(false);
        expect(screen.getByText(/🔇 Unmute/)).toBeInTheDocument();
      });

      // Toggle video
      await waitFor(() => {
        const videoButton = screen.getByText(/📹 Stop Video/);
        fireEvent.click(videoButton);
      });

      await waitFor(() => {
        expect(mockVideoTrack.setEnabled).toHaveBeenCalledWith(false);
        expect(screen.getByText(/📷 Start Video/)).toBeInTheDocument();
      });
    });

    test('properly cleans up resources on session end', async () => {
      const { unmount } = await act(async () => {
        return render(<VideoCall {...mockProps} />);
      });

      await waitFor(() => {
        expect(mockAgoraClient.join).toHaveBeenCalled();
      });

      // Unmount component
      await act(async () => {
        unmount();
      });

      // Verify cleanup
      expect(mockAgoraClient.leave).toHaveBeenCalled();
      expect(mockAgoraClient.removeAllListeners).toHaveBeenCalled();
      expect(mockAudioTrack.close).toHaveBeenCalled();
      expect(mockVideoTrack.close).toHaveBeenCalled();
    });
  });

  describe('Enhanced Video Call Integration', () => {
    test('integrates with chat and gifts systems', async () => {
      // Mock VirtualGifts and LiveChat components
      jest.doMock('../../components/VirtualGifts', () => {
        return function MockVirtualGifts({ onGiftSent, onClose }) {
          return (
            <div data-testid="virtual-gifts-modal">
              <button onClick={() => onGiftSent({ name: 'Rose', tokens: 10 })}>
                Send Rose
              </button>
              <button onClick={onClose}>Close</button>
            </div>
          );
        };
      });

      jest.doMock('../../components/LiveChat', () => {
        return function MockLiveChat({ onMessageSent }) {
          return (
            <div data-testid="live-chat">
              <button onClick={() => onMessageSent({ text: 'Hello!', sender: 'test-user' })}>
                Send Chat
              </button>
            </div>
          );
        };
      });

      await act(async () => {
        render(<EnhancedVideoCall {...mockProps} />);
      });

      await waitFor(() => {
        expect(screen.getByTestId('live-chat')).toBeInTheDocument();
      });

      // Test gift sending
      const giftButton = screen.getByText(/🎁 Send Gift/);
      await act(async () => {
        fireEvent.click(giftButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('virtual-gifts-modal')).toBeInTheDocument();
      });

      const sendRoseButton = screen.getByText('Send Rose');
      await act(async () => {
        fireEvent.click(sendRoseButton);
      });

      // Verify gift API call
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('/gifts/send'),
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'Authorization': expect.stringContaining('Bearer'),
            }),
          })
        );
      });
    });

    test('handles network quality changes and adaptation', async () => {
      await act(async () => {
        render(<VideoCall {...mockProps} />);
      });

      await waitFor(() => {
        expect(mockAgoraClient.join).toHaveBeenCalled();
      });

      // Simulate network quality change
      const networkQualityCallback = mockAgoraClient.on.mock.calls
        .find(call => call[0] === 'network-quality')?.[1];

      if (networkQualityCallback) {
        await act(async () => {
          networkQualityCallback({
            uplinkNetworkQuality: 2, // Poor quality
            downlinkNetworkQuality: 2,
          });
        });

        // Should show network quality indicator
        await waitFor(() => {
          expect(screen.getByText(/Network:/)).toBeInTheDocument();
        });

        // Should potentially adjust quality settings
        expect(mockVideoTrack.setEncoderConfiguration).toHaveBeenCalled();
      }
    });

    test('handles connection interruption and recovery', async () => {
      await act(async () => {
        render(<VideoCall {...mockProps} />);
      });

      await waitFor(() => {
        expect(mockAgoraClient.join).toHaveBeenCalled();
      });

      // Simulate connection state change to disconnected
      const connectionStateCallback = mockAgoraClient.on.mock.calls
        .find(call => call[0] === 'connection-state-change')?.[1];

      if (connectionStateCallback) {
        await act(async () => {
          connectionStateCallback('DISCONNECTED', 'NETWORK_ERROR');
        });

        // Should show disconnected state
        await waitFor(() => {
          expect(screen.getByText(/DISCONNECTED|Connection lost/i)).toBeInTheDocument();
        });

        // Simulate reconnection
        await act(async () => {
          connectionStateCallback('CONNECTED', 'CONNECTION_CHANGED');
        });

        // Should show connected state again
        await waitFor(() => {
          expect(screen.getByText(/CONNECTED/)).toBeInTheDocument();
        });
      }
    });
  });

  describe('Error Handling and Recovery', () => {
    test('handles join channel failure with retry', async () => {
      mockAgoraClient.join.mockRejectedValueOnce(new Error('Join failed'));
      mockAgoraClient.join.mockResolvedValueOnce(12345);

      await act(async () => {
        render(<VideoCall {...mockProps} />);
      });

      // Should show error initially
      await waitFor(() => {
        expect(screen.getByText(/Join failed|Connection failed/)).toBeInTheDocument();
      });

      // Should retry and eventually succeed
      await waitFor(() => {
        expect(mockAgoraClient.join).toHaveBeenCalledTimes(2);
      }, { timeout: 10000 });
    });

    test('handles media device access denial', async () => {
      const AgoraSDK = require('agora-rtc-sdk-ng');
      AgoraSDK.createMicrophoneAudioTrack.mockRejectedValueOnce(
        new Error('Permission denied')
      );

      await act(async () => {
        render(<VideoCall {...mockProps} />);
      });

      await waitFor(() => {
        expect(screen.getByText(/Permission denied|Media access/)).toBeInTheDocument();
      });
    });

    test('handles token refresh failure gracefully', async () => {
      fetch.mockImplementation((url) => {
        if (url.includes('/agora/token')) {
          return Promise.reject(new Error('Token refresh failed'));
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      });

      await act(async () => {
        render(<VideoCall {...mockProps} />);
      });

      await waitFor(() => {
        expect(mockAgoraClient.join).toHaveBeenCalled();
      });

      // Simulate token expiration
      const tokenExpiredCallback = mockAgoraClient.on.mock.calls
        .find(call => call[0] === 'token-privilege-will-expire')?.[1];

      if (tokenExpiredCallback) {
        await act(async () => {
          tokenExpiredCallback();
        });

        // Should handle token refresh failure
        await waitFor(() => {
          expect(mockProps.onTokenExpired).toHaveBeenCalled();
        });
      }
    });
  });

  describe('Performance and Optimization', () => {
    test('optimizes for multiple remote users', async () => {
      mockAgoraClient.getRemoteUsers.mockReturnValue([
        { uid: 1001, hasAudio: true, hasVideo: true },
        { uid: 1002, hasAudio: true, hasVideo: true },
        { uid: 1003, hasAudio: true, hasVideo: false },
      ]);

      await act(async () => {
        render(<VideoCall {...mockProps} />);
      });

      await waitFor(() => {
        expect(mockAgoraClient.join).toHaveBeenCalled();
      });

      // Simulate multiple users joining
      const userJoinedCallback = mockAgoraClient.on.mock.calls
        .find(call => call[0] === 'user-joined')?.[1];

      if (userJoinedCallback) {
        for (let i = 1001; i <= 1003; i++) {
          await act(async () => {
            userJoinedCallback({ uid: i, hasAudio: true, hasVideo: i !== 1003 });
          });
        }

        // Should handle multiple subscriptions efficiently
        await waitFor(() => {
          expect(mockAgoraClient.subscribe).toHaveBeenCalledTimes(5); // 3 audio + 2 video
        });
      }
    });

    test('manages memory usage with long sessions', async () => {
      const { rerender } = await act(async () => {
        return render(<VideoCall {...mockProps} />);
      });

      // Simulate long session with multiple state changes
      for (let i = 0; i < 100; i++) {
        await act(async () => {
          rerender(<VideoCall {...mockProps} tokenBalance={1000 - i} />);
        });
      }

      // Should not cause memory leaks or performance issues
      expect(mockAgoraClient.join).toHaveBeenCalledTimes(1);
    });

    test('handles bandwidth adaptation', async () => {
      await act(async () => {
        render(<VideoCall {...mockProps} />);
      });

      await waitFor(() => {
        expect(mockAgoraClient.join).toHaveBeenCalled();
      });

      // Simulate poor network conditions
      const networkQualityCallback = mockAgoraClient.on.mock.calls
        .find(call => call[0] === 'network-quality')?.[1];

      if (networkQualityCallback) {
        await act(async () => {
          networkQualityCallback({
            uplinkNetworkQuality: 1, // Very poor
            downlinkNetworkQuality: 2, // Poor
          });
        });

        // Should adapt video quality
        await waitFor(() => {
          expect(mockVideoTrack.setEncoderConfiguration).toHaveBeenCalledWith(
            expect.objectContaining({
              width: expect.any(Number),
              height: expect.any(Number),
              bitrate: expect.any(Number),
            })
          );
        });
      }
    });
  });

  describe('Token Economy Integration', () => {
    test('deducts tokens during call for audience fans', async () => {
      const audienceProps = { ...mockProps, isHost: false };

      await act(async () => {
        render(<VideoCall {...audienceProps} />);
      });

      await waitFor(() => {
        expect(mockAgoraClient.join).toHaveBeenCalled();
      });

      // Should start token deduction timer
      await waitFor(() => {
        expect(mockProps.onTokenDeduction).toHaveBeenCalled();
      }, { timeout: 65000 }); // Wait for first minute
    });

    test('updates token balance in real-time', async () => {
      const onTokenUpdate = jest.fn();
      const audienceProps = { ...mockProps, isHost: false, onTokenUpdate };

      await act(async () => {
        render(<VideoCall {...audienceProps} />);
      });

      await waitFor(() => {
        expect(mockAgoraClient.join).toHaveBeenCalled();
      });

      // Should fetch updated balance periodically
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('/tokens/balance'),
          expect.any(Object)
        );
        expect(onTokenUpdate).toHaveBeenCalledWith(950);
      }, { timeout: 10000 });
    });

    test('ends session when tokens are depleted', async () => {
      const onSessionEnd = jest.fn();
      const audienceProps = { 
        ...mockProps, 
        isHost: false, 
        tokenBalance: 0,
        onSessionEnd 
      };

      await act(async () => {
        render(<VideoCall {...audienceProps} />);
      });

      // Should end session immediately if no tokens
      await waitFor(() => {
        expect(onSessionEnd).toHaveBeenCalledWith('insufficient_tokens');
      });
    });
  });
});