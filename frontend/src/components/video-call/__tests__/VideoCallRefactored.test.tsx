/**
 * Unit tests for VideoCallRefactored component
 * @module tests/VideoCallRefactored
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import VideoCallRefactored from '../VideoCallRefactored';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

// Mock Agora SDK
vi.mock('agora-rtc-sdk-ng', () => ({
  default: {
    createClient: vi.fn(() => ({
      on: vi.fn(),
      off: vi.fn(),
      join: vi.fn(),
      leave: vi.fn(),
      publish: vi.fn(),
      unpublish: vi.fn(),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
      setClientRole: vi.fn(),
      connectionState: 'DISCONNECTED',
      remoteUsers: []
    })),
    createMicrophoneAudioTrack: vi.fn(() => ({
      play: vi.fn(),
      stop: vi.fn(),
      close: vi.fn(),
      setEnabled: vi.fn(),
      enabled: true
    })),
    createCameraVideoTrack: vi.fn(() => ({
      play: vi.fn(),
      stop: vi.fn(),
      close: vi.fn(),
      setEnabled: vi.fn(),
      enabled: true
    })),
    getCameras: vi.fn(() => Promise.resolve([
      { deviceId: '1', label: 'Camera 1' },
      { deviceId: '2', label: 'Camera 2' }
    ])),
    getMicrophones: vi.fn(() => Promise.resolve([
      { deviceId: '1', label: 'Mic 1' }
    ]))
  }
}));

// Mock hooks
vi.mock('../hooks/useAgoraClient', () => ({
  useAgoraClient: vi.fn(() => ({
    client: {},
    localTracks: { audio: null, video: null },
    remoteTracks: new Map(),
    connectionState: 'CONNECTED',
    isJoined: false,
    error: null,
    joinChannel: vi.fn(),
    leaveChannel: vi.fn(),
    toggleAudio: vi.fn(),
    toggleVideo: vi.fn(),
    switchCamera: vi.fn(),
    setVideoQuality: vi.fn(),
    getStats: vi.fn()
  }))
}));

vi.mock('../hooks/useCallBilling', () => ({
  useCallBilling: vi.fn(() => ({
    sessionCost: 100,
    callDuration: 300,
    billingStatus: 'active',
    startBilling: vi.fn(),
    stopBilling: vi.fn(),
    pauseBilling: vi.fn(),
    getSessionSummary: vi.fn(() => ({
      duration: 300,
      cost: 100,
      rate: 20
    }))
  }))
}));

vi.mock('../hooks/useCallRecording', () => ({
  useCallRecording: vi.fn(() => ({
    isRecording: false,
    recordingUrl: null,
    startRecording: vi.fn(),
    stopRecording: vi.fn(),
    pauseRecording: vi.fn(),
    downloadRecording: vi.fn()
  }))
}));

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <BrowserRouter>
    {children}
    <Toaster />
  </BrowserRouter>
);

describe('VideoCallRefactored', () => {
  const mockProps = {
    channel: 'test-channel',
    token: 'test-token',
    uid: 'test-uid',
    user: {
      id: 'user-1',
      name: 'Test User',
      email: 'test@example.com',
      username: 'testuser',
      is_creator: false,
      token_balance: 1000,
      supabase_id: 'supabase-1',
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
      is_verified: true
    },
    creator: {
      id: 'creator-1',
      name: 'Test Creator',
      per_minute_rate: 20,
      hourly_rate: 1000
    },
    onEndCall: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders video call interface', () => {
    render(
      <TestWrapper>
        <VideoCallRefactored {...mockProps} />
      </TestWrapper>
    );

    expect(screen.getByTestId('video-call-container')).toBeInTheDocument();
    expect(screen.getByTestId('local-video')).toBeInTheDocument();
    expect(screen.getByTestId('call-controls')).toBeInTheDocument();
  });

  it('displays call header with correct information', () => {
    render(
      <TestWrapper>
        <VideoCallRefactored {...mockProps} />
      </TestWrapper>
    );

    expect(screen.getByText('Test Creator')).toBeInTheDocument();
    expect(screen.getByText(/\$20\/min/i)).toBeInTheDocument();
  });

  it('shows loading state initially', () => {
    render(
      <TestWrapper>
        <VideoCallRefactored {...mockProps} />
      </TestWrapper>
    );

    expect(screen.getByTestId('connecting-indicator')).toBeInTheDocument();
  });

  it('handles audio toggle correctly', async () => {
    const { toggleAudio } = require('../hooks/useAgoraClient').useAgoraClient();
    
    render(
      <TestWrapper>
        <VideoCallRefactored {...mockProps} />
      </TestWrapper>
    );

    const audioButton = screen.getByTestId('toggle-audio');
    fireEvent.click(audioButton);

    await waitFor(() => {
      expect(toggleAudio).toHaveBeenCalled();
    });
  });

  it('handles video toggle correctly', async () => {
    const { toggleVideo } = require('../hooks/useAgoraClient').useAgoraClient();
    
    render(
      <TestWrapper>
        <VideoCallRefactored {...mockProps} />
      </TestWrapper>
    );

    const videoButton = screen.getByTestId('toggle-video');
    fireEvent.click(videoButton);

    await waitFor(() => {
      expect(toggleVideo).toHaveBeenCalled();
    });
  });

  it('handles call end correctly', async () => {
    const { leaveChannel } = require('../hooks/useAgoraClient').useAgoraClient();
    
    render(
      <TestWrapper>
        <VideoCallRefactored {...mockProps} />
      </TestWrapper>
    );

    const endButton = screen.getByTestId('end-call');
    fireEvent.click(endButton);

    // Should show confirmation modal
    expect(screen.getByText(/Are you sure you want to end the call?/i)).toBeInTheDocument();

    const confirmButton = screen.getByText('End Call');
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(leaveChannel).toHaveBeenCalled();
      expect(mockProps.onEndCall).toHaveBeenCalled();
    });
  });

  it('displays token balance for non-creators', () => {
    render(
      <TestWrapper>
        <VideoCallRefactored {...mockProps} />
      </TestWrapper>
    );

    expect(screen.getByText(/1000 tokens/i)).toBeInTheDocument();
  });

  it('shows earnings for creators', () => {
    const creatorProps = {
      ...mockProps,
      user: { ...mockProps.user, is_creator: true }
    };

    render(
      <TestWrapper>
        <VideoCallRefactored {...creatorProps} />
      </TestWrapper>
    );

    expect(screen.getByTestId('earnings-display')).toBeInTheDocument();
  });

  it('handles screen share toggle', async () => {
    render(
      <TestWrapper>
        <VideoCallRefactored {...mockProps} />
      </TestWrapper>
    );

    const screenShareButton = screen.getByTestId('toggle-screen-share');
    fireEvent.click(screenShareButton);

    await waitFor(() => {
      expect(screen.getByTestId('screen-share-active')).toBeInTheDocument();
    });
  });

  it('shows chat panel when toggled', () => {
    render(
      <TestWrapper>
        <VideoCallRefactored {...mockProps} />
      </TestWrapper>
    );

    const chatButton = screen.getByTestId('toggle-chat');
    fireEvent.click(chatButton);

    expect(screen.getByTestId('call-chat-panel')).toBeInTheDocument();
  });

  it('handles recording start for creators', async () => {
    const { startRecording } = require('../hooks/useCallRecording').useCallRecording();
    
    const creatorProps = {
      ...mockProps,
      user: { ...mockProps.user, is_creator: true }
    };

    render(
      <TestWrapper>
        <VideoCallRefactored {...creatorProps} />
      </TestWrapper>
    );

    const recordButton = screen.getByTestId('toggle-recording');
    fireEvent.click(recordButton);

    await waitFor(() => {
      expect(startRecording).toHaveBeenCalled();
    });
  });

  it('shows settings modal when clicked', () => {
    render(
      <TestWrapper>
        <VideoCallRefactored {...mockProps} />
      </TestWrapper>
    );

    const settingsButton = screen.getByTestId('open-settings');
    fireEvent.click(settingsButton);

    expect(screen.getByTestId('call-settings-modal')).toBeInTheDocument();
  });

  it('handles network quality indicator', () => {
    render(
      <TestWrapper>
        <VideoCallRefactored {...mockProps} />
      </TestWrapper>
    );

    expect(screen.getByTestId('network-quality')).toBeInTheDocument();
  });

  it('displays remote participants when present', () => {
    const { useAgoraClient } = require('../hooks/useAgoraClient');
    
    const remoteTracks = new Map();
    remoteTracks.set('remote-1', {
      uid: 'remote-1',
      hasAudio: true,
      hasVideo: true,
      audioTrack: {},
      videoTrack: {}
    });

    useAgoraClient.mockReturnValue({
      ...useAgoraClient(),
      remoteTracks
    });

    render(
      <TestWrapper>
        <VideoCallRefactored {...mockProps} />
      </TestWrapper>
    );

    expect(screen.getByTestId('remote-video-remote-1')).toBeInTheDocument();
  });

  it('handles insufficient balance warning', () => {
    const lowBalanceProps = {
      ...mockProps,
      user: { ...mockProps.user, token_balance: 10 }
    };

    render(
      <TestWrapper>
        <VideoCallRefactored {...lowBalanceProps} />
      </TestWrapper>
    );

    expect(screen.getByText(/Low balance warning/i)).toBeInTheDocument();
  });

  it('handles camera switch for mobile', async () => {
    const { switchCamera } = require('../hooks/useAgoraClient').useAgoraClient();
    
    // Mock mobile device
    Object.defineProperty(window.navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
      configurable: true
    });

    render(
      <TestWrapper>
        <VideoCallRefactored {...mockProps} />
      </TestWrapper>
    );

    const switchButton = screen.getByTestId('switch-camera');
    fireEvent.click(switchButton);

    await waitFor(() => {
      expect(switchCamera).toHaveBeenCalled();
    });
  });

  it('shows call duration timer', async () => {
    render(
      <TestWrapper>
        <VideoCallRefactored {...mockProps} />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByTestId('call-duration')).toBeInTheDocument();
      expect(screen.getByText(/00:05:00/)).toBeInTheDocument(); // 5 minutes
    });
  });

  it('handles call quality selection', async () => {
    const { setVideoQuality } = require('../hooks/useAgoraClient').useAgoraClient();
    
    render(
      <TestWrapper>
        <VideoCallRefactored {...mockProps} />
      </TestWrapper>
    );

    const settingsButton = screen.getByTestId('open-settings');
    fireEvent.click(settingsButton);

    const qualitySelect = screen.getByTestId('quality-select');
    fireEvent.change(qualitySelect, { target: { value: '1080p' } });

    await waitFor(() => {
      expect(setVideoQuality).toHaveBeenCalledWith(
        expect.objectContaining({
          width: 1920,
          height: 1080
        })
      );
    });
  });

  it('handles connection error gracefully', () => {
    const { useAgoraClient } = require('../hooks/useAgoraClient');
    
    useAgoraClient.mockReturnValue({
      ...useAgoraClient(),
      error: new Error('Connection failed'),
      connectionState: 'DISCONNECTED'
    });

    render(
      <TestWrapper>
        <VideoCallRefactored {...mockProps} />
      </TestWrapper>
    );

    expect(screen.getByText(/Connection failed/i)).toBeInTheDocument();
    expect(screen.getByTestId('retry-connection')).toBeInTheDocument();
  });
});