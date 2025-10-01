/**
 * VideoCall component stories
 * @module stories/VideoCallRefactored
 */

import type { Meta, StoryObj } from '@storybook/react';
import { within, userEvent, expect, waitFor } from '@storybook/test';
import VideoCallRefactored from './VideoCallRefactored';
import { MockedProvider } from './mocks/MockedProvider';

const meta = {
  title: 'Features/VideoCall',
  component: VideoCallRefactored,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Video call component with Agora WebRTC integration'
      }
    }
  },
  decorators: [
    (Story) => (
      <MockedProvider>
        <div className="h-screen">
          <Story />
        </div>
      </MockedProvider>
    )
  ],
  tags: ['autodocs']
} satisfies Meta<typeof VideoCallRefactored>;

export default meta;
type Story = StoryObj<typeof meta>;

// Default user and creator data
const defaultUser = {
  id: 'user-123',
  email: 'user@example.com',
  username: 'testuser',
  name: 'Test User',
  is_creator: false,
  token_balance: 1000,
  supabase_id: 'supabase-123',
  created_at: '2024-01-01',
  updated_at: '2024-01-01',
  is_verified: true
};

const defaultCreator = {
  id: 'creator-123',
  name: 'Jane Creator',
  per_minute_rate: 20,
  hourly_rate: 1000,
  avatar: 'https://i.pravatar.cc/150?img=1'
};

// Basic video call
export const Default: Story = {
  args: {
    channel: 'test-channel',
    token: 'test-token',
    uid: 'test-uid',
    user: defaultUser,
    creator: defaultCreator,
    onEndCall: () => console.log('Call ended')
  }
};

// Creator view
export const CreatorView: Story = {
  args: {
    channel: 'creator-channel',
    token: 'creator-token',
    uid: 'creator-uid',
    user: { ...defaultUser, is_creator: true },
    creator: defaultCreator,
    onEndCall: () => console.log('Call ended')
  }
};

// Low balance warning
export const LowBalance: Story = {
  args: {
    channel: 'test-channel',
    token: 'test-token',
    uid: 'test-uid',
    user: { ...defaultUser, token_balance: 50 },
    creator: defaultCreator,
    onEndCall: () => console.log('Call ended')
  }
};

// With remote participant
export const WithRemoteParticipant: Story = {
  args: {
    channel: 'test-channel',
    token: 'test-token',
    uid: 'test-uid',
    user: defaultUser,
    creator: defaultCreator,
    onEndCall: () => console.log('Call ended')
  },
  parameters: {
    mockData: {
      hasRemoteUser: true
    }
  }
};

// Connection states
export const ConnectionStates: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-4 p-4">
      <div>
        <h3 className="text-white mb-2">Connecting</h3>
        <div className="h-64 bg-gray-800 rounded-lg">
          <VideoCallRefactored
            channel="test"
            token="test"
            uid="test"
            user={defaultUser}
            creator={defaultCreator}
            connectionState="CONNECTING"
          />
        </div>
      </div>
      
      <div>
        <h3 className="text-white mb-2">Connected</h3>
        <div className="h-64 bg-gray-800 rounded-lg">
          <VideoCallRefactored
            channel="test"
            token="test"
            uid="test"
            user={defaultUser}
            creator={defaultCreator}
            connectionState="CONNECTED"
          />
        </div>
      </div>
      
      <div>
        <h3 className="text-white mb-2">Reconnecting</h3>
        <div className="h-64 bg-gray-800 rounded-lg">
          <VideoCallRefactored
            channel="test"
            token="test"
            uid="test"
            user={defaultUser}
            creator={defaultCreator}
            connectionState="RECONNECTING"
          />
        </div>
      </div>
      
      <div>
        <h3 className="text-white mb-2">Disconnected</h3>
        <div className="h-64 bg-gray-800 rounded-lg">
          <VideoCallRefactored
            channel="test"
            token="test"
            uid="test"
            user={defaultUser}
            creator={defaultCreator}
            connectionState="DISCONNECTED"
          />
        </div>
      </div>
    </div>
  )
};

// Interactive test
export const InteractiveControls: Story = {
  args: {
    channel: 'test-channel',
    token: 'test-token',
    uid: 'test-uid',
    user: defaultUser,
    creator: defaultCreator,
    onEndCall: () => console.log('Call ended')
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Test audio toggle
    const audioButton = await canvas.findByTestId('toggle-audio');
    await userEvent.click(audioButton);
    await expect(audioButton).toHaveAttribute('aria-pressed', 'true');
    
    // Test video toggle
    const videoButton = await canvas.findByTestId('toggle-video');
    await userEvent.click(videoButton);
    await expect(videoButton).toHaveAttribute('aria-pressed', 'true');
    
    // Test chat toggle
    const chatButton = await canvas.findByTestId('toggle-chat');
    await userEvent.click(chatButton);
    await waitFor(() => {
      expect(canvas.getByTestId('call-chat-panel')).toBeInTheDocument();
    });
    
    // Test settings modal
    const settingsButton = await canvas.findByTestId('open-settings');
    await userEvent.click(settingsButton);
    await waitFor(() => {
      expect(canvas.getByTestId('call-settings-modal')).toBeInTheDocument();
    });
  }
};

// Mobile view
export const MobileView: Story = {
  args: {
    channel: 'mobile-channel',
    token: 'mobile-token',
    uid: 'mobile-uid',
    user: defaultUser,
    creator: defaultCreator,
    onEndCall: () => console.log('Call ended')
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile'
    }
  }
};

// Recording state
export const Recording: Story = {
  args: {
    channel: 'recording-channel',
    token: 'recording-token',
    uid: 'recording-uid',
    user: { ...defaultUser, is_creator: true },
    creator: defaultCreator,
    onEndCall: () => console.log('Call ended')
  },
  parameters: {
    mockData: {
      isRecording: true
    }
  }
};

// Screen sharing
export const ScreenSharing: Story = {
  args: {
    channel: 'screen-channel',
    token: 'screen-token',
    uid: 'screen-uid',
    user: defaultUser,
    creator: defaultCreator,
    onEndCall: () => console.log('Call ended')
  },
  parameters: {
    mockData: {
      isScreenSharing: true
    }
  }
};

// Error state
export const ErrorState: Story = {
  args: {
    channel: 'error-channel',
    token: 'error-token',
    uid: 'error-uid',
    user: defaultUser,
    creator: defaultCreator,
    onEndCall: () => console.log('Call ended')
  },
  parameters: {
    mockData: {
      error: new Error('Failed to connect to call')
    }
  }
};