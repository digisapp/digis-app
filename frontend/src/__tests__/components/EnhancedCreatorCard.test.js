import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { EnhancedCreatorCard } from '../../components/EnhancedCreatorCard';

// Mock framer-motion to avoid animation issues in tests
jest.mock('framer-motion', () => ({
  motion: {
    button: ({ children, ...props }) => <button {...props}>{children}</button>,
    div: ({ children, ...props }) => <div {...props}>{children}</div>,
  },
}));

describe('EnhancedCreatorCard', () => {
  const mockCreator = {
    id: 1,
    username: 'testcreator',
    bio: 'Test creator bio',
    profilePicUrl: 'https://example.com/pic.jpg',
    isOnline: true,
    video_price: 10,
    voice_price: 8,
    stream_price: 5,
    message_price: 2,
    followerCount: 100,
    isFollowing: false
  };

  const mockProps = {
    creator: mockCreator,
    onJoinSession: jest.fn(),
    onFollowToggle: jest.fn(),
    onTip: jest.fn(),
    onMessage: jest.fn(),
    isAuthenticated: true,
    currentUserId: 2
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders creator information correctly', () => {
    render(<EnhancedCreatorCard {...mockProps} />);
    
    expect(screen.getByText('@testcreator')).toBeInTheDocument();
    expect(screen.getByText('Test creator bio')).toBeInTheDocument();
    expect(screen.getByAltText('testcreator')).toHaveAttribute('src', 'https://example.com/pic.jpg');
  });

  it('displays online status when creator is online', () => {
    render(<EnhancedCreatorCard {...mockProps} />);
    
    expect(screen.getByText('Online')).toBeInTheDocument();
  });

  it('displays offline status when creator is offline', () => {
    const offlineCreator = { ...mockCreator, isOnline: false };
    render(<EnhancedCreatorCard {...mockProps} creator={offlineCreator} />);
    
    expect(screen.getByText('Offline')).toBeInTheDocument();
  });

  it('handles follow button click correctly', async () => {
    mockProps.onFollowToggle.mockResolvedValue(true);
    render(<EnhancedCreatorCard {...mockProps} />);
    
    const followButton = screen.getByLabelText('Follow creator');
    fireEvent.click(followButton);
    
    await waitFor(() => {
      expect(mockProps.onFollowToggle).toHaveBeenCalledWith(1, true);
    });
  });

  it('handles unfollow button click correctly', async () => {
    const followingCreator = { ...mockCreator, isFollowing: true };
    mockProps.onFollowToggle.mockResolvedValue(true);
    
    render(<EnhancedCreatorCard {...mockProps} creator={followingCreator} />);
    
    const unfollowButton = screen.getByLabelText('Unfollow creator');
    fireEvent.click(unfollowButton);
    
    await waitFor(() => {
      expect(mockProps.onFollowToggle).toHaveBeenCalledWith(1, false);
    });
  });

  it('displays service buttons with correct pricing', () => {
    render(<EnhancedCreatorCard {...mockProps} />);
    
    expect(screen.getByLabelText('Live Stream - 5 tokens per minute')).toBeInTheDocument();
    expect(screen.getByLabelText('Video Call - 10 tokens per minute')).toBeInTheDocument();
    expect(screen.getByLabelText('Voice Call - 8 tokens per minute')).toBeInTheDocument();
    expect(screen.getByLabelText('Message - 2 tokens per message')).toBeInTheDocument();
  });

  it('handles service button clicks', () => {
    render(<EnhancedCreatorCard {...mockProps} />);
    
    const videoButton = screen.getByLabelText('Video Call - 10 tokens per minute');
    fireEvent.click(videoButton);
    
    expect(mockProps.onJoinSession).toHaveBeenCalledWith(mockCreator, 'video', 10);
  });

  it('displays follower count only for current creator', () => {
    const ownCreator = { ...mockCreator, id: 2 };
    render(<EnhancedCreatorCard {...mockProps} creator={ownCreator} />);
    
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('followers')).toBeInTheDocument();
  });

  it('hides follower count for other creators', () => {
    render(<EnhancedCreatorCard {...mockProps} />);
    
    expect(screen.queryByText('followers')).not.toBeInTheDocument();
  });

  it('handles tip button click', () => {
    render(<EnhancedCreatorCard {...mockProps} />);
    
    const tipButton = screen.getByLabelText('Send tip to creator');
    fireEvent.click(tipButton);
    
    expect(mockProps.onTip).toHaveBeenCalledWith(mockCreator);
  });

  it('handles message button click', () => {
    render(<EnhancedCreatorCard {...mockProps} />);
    
    const messageButton = screen.getByLabelText('Send message to creator');
    fireEvent.click(messageButton);
    
    expect(mockProps.onMessage).toHaveBeenCalledWith(mockCreator);
  });

  it('does not call handlers when not authenticated', () => {
    render(<EnhancedCreatorCard {...mockProps} isAuthenticated={false} />);
    
    const followButton = screen.getByLabelText('Follow creator');
    fireEvent.click(followButton);
    
    expect(mockProps.onFollowToggle).not.toHaveBeenCalled();
  });

  it('handles optimistic updates for follow action', async () => {
    render(<EnhancedCreatorCard {...mockProps} />);
    
    const followButton = screen.getByLabelText('Follow creator');
    fireEvent.click(followButton);
    
    // Should immediately show unfollow state
    expect(screen.getByLabelText('Unfollow creator')).toBeInTheDocument();
  });

  it('reverts optimistic update on follow failure', async () => {
    mockProps.onFollowToggle.mockResolvedValue(false);
    render(<EnhancedCreatorCard {...mockProps} />);
    
    const followButton = screen.getByLabelText('Follow creator');
    fireEvent.click(followButton);
    
    await waitFor(() => {
      // Should revert to follow state
      expect(screen.getByLabelText('Follow creator')).toBeInTheDocument();
    });
  });

  it('displays premium badge when creator is premium', () => {
    const premiumCreator = { ...mockCreator, isPremium: true };
    render(<EnhancedCreatorCard {...mockProps} creator={premiumCreator} />);
    
    expect(screen.getByText('Premium')).toBeInTheDocument();
  });

  it('renders fallback avatar when no profile picture', () => {
    const noPicCreator = { ...mockCreator, profilePicUrl: null };
    render(<EnhancedCreatorCard {...mockProps} creator={noPicCreator} />);
    
    expect(screen.getByText('T')).toBeInTheDocument(); // First letter of username
  });
});