import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import FollowingSystem from '../../components/FollowingSystem';
import toast from 'react-hot-toast';

// Mock dependencies
jest.mock('react-hot-toast');
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }) => children,
}));

// Mock API hooks
jest.mock('../../hooks/useApi', () => ({
  useApiCall: jest.fn((endpoint) => {
    if (endpoint === '/api/users/following') {
      return {
        data: { following: mockFollowing },
        loading: false,
        error: null,
        refetch: jest.fn()
      };
    } else if (endpoint === '/api/users/following/activity') {
      return {
        data: { activity: mockActivity },
        loading: false,
        error: null,
        refetch: jest.fn()
      };
    }
    return { data: null, loading: false, error: null, refetch: jest.fn() };
  }),
  useMutation: jest.fn(() => ({
    mutate: jest.fn().mockResolvedValue({}),
    loading: false
  }))
}));

const mockFollowing = [
  {
    id: 1,
    username: 'GamerGirl123',
    displayName: 'Sarah Gaming',
    avatar: null,
    isOnline: true,
    isLive: true,
    category: 'Gaming',
    currentStream: 'Minecraft Creative Build',
    followers: 15420,
    lastSeen: new Date(),
    followedAt: new Date(Date.now() - 86400000 * 5)
  },
  {
    id: 2,
    username: 'MusicMaster',
    displayName: 'Alex Melody',
    avatar: null,
    isOnline: true,
    isLive: false,
    category: 'Music',
    followers: 8930,
    lastSeen: new Date(Date.now() - 3600000),
    followedAt: new Date(Date.now() - 86400000 * 12)
  }
];

const mockActivity = [
  {
    id: 1,
    type: 'stream_started',
    creator: 'GamerGirl123',
    creatorName: 'Sarah Gaming',
    message: 'started streaming Minecraft Creative Build',
    timestamp: new Date(Date.now() - 1800000),
    thumbnail: null
  },
  {
    id: 2,
    type: 'new_video',
    creator: 'MusicMaster',
    creatorName: 'Alex Melody',
    message: 'uploaded a new song: "Midnight Dreams"',
    timestamp: new Date(Date.now() - 7200000),
    thumbnail: null
  }
];

describe('FollowingSystem', () => {
  const mockUser = { id: 1, name: 'Test User' };
  const mockOnCreatorSelect = jest.fn();
  
  const defaultProps = {
    user: mockUser,
    onCreatorSelect: mockOnCreatorSelect
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders following system with tabs', () => {
    render(<FollowingSystem {...defaultProps} />);
    
    expect(screen.getByText('Following')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Following \(2\)/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Activity \(2\)/ })).toBeInTheDocument();
  });

  it('displays following list by default', async () => {
    render(<FollowingSystem {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Sarah Gaming')).toBeInTheDocument();
      expect(screen.getByText('@GamerGirl123')).toBeInTheDocument();
      expect(screen.getByText('Alex Melody')).toBeInTheDocument();
      expect(screen.getByText('@MusicMaster')).toBeInTheDocument();
    });
  });

  it('shows live indicator for streaming creators', async () => {
    render(<FollowingSystem {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('🔴 LIVE')).toBeInTheDocument();
      expect(screen.getByText('Minecraft Creative Build')).toBeInTheDocument();
    });
  });

  it('switches between following and activity tabs', async () => {
    render(<FollowingSystem {...defaultProps} />);
    
    const activityTab = screen.getByRole('tab', { name: /Activity/ });
    fireEvent.click(activityTab);
    
    await waitFor(() => {
      expect(screen.getByText('started streaming Minecraft Creative Build')).toBeInTheDocument();
      expect(screen.getByText('uploaded a new song: "Midnight Dreams"')).toBeInTheDocument();
    });
  });

  it('handles keyboard navigation for tabs', async () => {
    render(<FollowingSystem {...defaultProps} />);
    
    const tabList = screen.getByRole('tablist');
    
    // Press ArrowRight to switch to activity tab
    fireEvent.keyDown(tabList, { key: 'ArrowRight' });
    
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /Activity/ })).toHaveAttribute('aria-selected', 'true');
    });
  });

  it('handles watch live button click', async () => {
    render(<FollowingSystem {...defaultProps} />);
    
    await waitFor(() => {
      const watchButton = screen.getByLabelText('Watch Sarah Gaming live stream');
      fireEvent.click(watchButton);
    });
    
    expect(mockOnCreatorSelect).toHaveBeenCalledWith(
      expect.objectContaining({ displayName: 'Sarah Gaming' })
    );
  });

  it('handles view profile button click', async () => {
    render(<FollowingSystem {...defaultProps} />);
    
    await waitFor(() => {
      const viewButton = screen.getByLabelText('View Alex Melody profile');
      fireEvent.click(viewButton);
    });
    
    expect(mockOnCreatorSelect).toHaveBeenCalledWith(
      expect.objectContaining({ displayName: 'Alex Melody' })
    );
  });

  it('handles unfollow action', async () => {
    const { useMutation } = require('../../hooks/useApi');
    const mockMutate = jest.fn().mockResolvedValue({});
    
    useMutation.mockReturnValue({
      mutate: mockMutate,
      loading: false
    });
    
    render(<FollowingSystem {...defaultProps} />);
    
    await waitFor(() => {
      const unfollowButtons = screen.getAllByText('Unfollow');
      fireEvent.click(unfollowButtons[0]);
    });
    
    expect(mockMutate).toHaveBeenCalledWith(1);
    expect(toast.success).toHaveBeenCalledWith('Unfollowed Sarah Gaming');
  });

  it('displays loading state', () => {
    const { useApiCall } = require('../../hooks/useApi');
    
    useApiCall.mockReturnValue({
      data: null,
      loading: true,
      error: null,
      refetch: jest.fn()
    });
    
    render(<FollowingSystem {...defaultProps} />);
    
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('Loading following...')).toBeInTheDocument();
  });

  it('displays empty state when no creators followed', async () => {
    const { useApiCall } = require('../../hooks/useApi');
    
    useApiCall.mockImplementation((endpoint) => {
      if (endpoint === '/api/users/following') {
        return {
          data: { following: [] },
          loading: false,
          error: null,
          refetch: jest.fn()
        };
      }
      return {
        data: { activity: [] },
        loading: false,
        error: null,
        refetch: jest.fn()
      };
    });
    
    render(<FollowingSystem {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('No creators followed yet')).toBeInTheDocument();
      expect(screen.getByText('Start following creators to see their updates here')).toBeInTheDocument();
    });
  });

  it('displays empty activity state', async () => {
    const { useApiCall } = require('../../hooks/useApi');
    
    useApiCall.mockImplementation((endpoint) => {
      if (endpoint === '/api/users/following') {
        return {
          data: { following: mockFollowing },
          loading: false,
          error: null,
          refetch: jest.fn()
        };
      }
      return {
        data: { activity: [] },
        loading: false,
        error: null,
        refetch: jest.fn()
      };
    });
    
    render(<FollowingSystem {...defaultProps} />);
    
    const activityTab = screen.getByRole('tab', { name: /Activity/ });
    fireEvent.click(activityTab);
    
    await waitFor(() => {
      expect(screen.getByText('No activity yet')).toBeInTheDocument();
      expect(screen.getByText('Follow more creators to see their latest updates')).toBeInTheDocument();
    });
  });

  it('handles API errors with fallback data', async () => {
    const { useApiCall } = require('../../hooks/useApi');
    
    useApiCall.mockImplementation((endpoint) => ({
      data: null,
      loading: false,
      error: new Error('API Error'),
      refetch: jest.fn()
    }));
    
    render(<FollowingSystem {...defaultProps} />);
    
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to load following data');
      // Should still show mock data
      expect(screen.getByText('Sarah Gaming')).toBeInTheDocument();
    });
  });

  it('handles refresh button click', async () => {
    const { useApiCall } = require('../../hooks/useApi');
    const mockRefetch = jest.fn();
    
    useApiCall.mockReturnValue({
      data: { following: mockFollowing },
      loading: false,
      error: null,
      refetch: mockRefetch
    });
    
    render(<FollowingSystem {...defaultProps} />);
    
    const refreshButton = screen.getByLabelText('Refresh following data');
    fireEvent.click(refreshButton);
    
    expect(mockRefetch).toHaveBeenCalled();
  });

  it('formats time ago correctly', async () => {
    render(<FollowingSystem {...defaultProps} />);
    
    const activityTab = screen.getByRole('tab', { name: /Activity/ });
    fireEvent.click(activityTab);
    
    await waitFor(() => {
      expect(screen.getByText('30m ago')).toBeInTheDocument();
      expect(screen.getByText('2h ago')).toBeInTheDocument();
    });
  });

  it('displays activity type badges correctly', async () => {
    render(<FollowingSystem {...defaultProps} />);
    
    const activityTab = screen.getByRole('tab', { name: /Activity/ });
    fireEvent.click(activityTab);
    
    await waitFor(() => {
      expect(screen.getByText('🔴 Live Stream')).toBeInTheDocument();
      expect(screen.getByText('🎥 New Content')).toBeInTheDocument();
    });
  });

  it('handles watch button in activity feed', async () => {
    render(<FollowingSystem {...defaultProps} />);
    
    const activityTab = screen.getByRole('tab', { name: /Activity/ });
    fireEvent.click(activityTab);
    
    await waitFor(() => {
      const watchButton = screen.getByLabelText('Watch Sarah Gaming stream');
      fireEvent.click(watchButton);
    });
    
    expect(mockOnCreatorSelect).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'stream_started' })
    );
  });

  it('handles keyboard navigation in following list', async () => {
    render(<FollowingSystem {...defaultProps} />);
    
    await waitFor(() => {
      const followingList = screen.getAllByRole('listitem')[0];
      
      // Navigate with arrow keys
      fireEvent.keyDown(followingList, { key: 'ArrowDown' });
      fireEvent.keyDown(followingList, { key: 'Enter' });
    });
    
    expect(mockOnCreatorSelect).toHaveBeenCalled();
  });

  it('disables unfollow button while loading', async () => {
    const { useMutation } = require('../../hooks/useApi');
    
    useMutation.mockReturnValue({
      mutate: jest.fn(),
      loading: true
    });
    
    render(<FollowingSystem {...defaultProps} />);
    
    await waitFor(() => {
      const unfollowButton = screen.getAllByText('Unfollowing...')[0];
      expect(unfollowButton).toBeDisabled();
    });
  });
});