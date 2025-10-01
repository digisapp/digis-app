import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import CreatorDirectory from '../../components/CreatorDirectory';
import { getAuthToken } from '../../utils/auth-helpers';
import { fetchWithRetry } from '../../utils/fetchWithRetry';
import toast from 'react-hot-toast';

// Mock dependencies
jest.mock('../../utils/auth-helpers');
jest.mock('../../utils/fetchWithRetry');
jest.mock('react-hot-toast');
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }) => children,
}));

// Mock API hooks
jest.mock('../../hooks/useApi', () => ({
  usePaginatedApi: jest.fn(() => ({
    items: mockCreators,
    loading: false,
    error: null,
    refetch: jest.fn(),
    page: 1,
    totalPages: 2,
    nextPage: jest.fn(),
    prevPage: jest.fn(),
    hasNextPage: true,
    hasPrevPage: false
  })),
  useSearchApi: jest.fn(() => ({
    results: [],
    loading: false,
    error: null
  })),
  useMutation: jest.fn(() => ({
    mutate: jest.fn().mockResolvedValue({ callRequestId: '123' }),
    loading: false
  }))
}));

const mockCreators = [
  {
    username: 'creator1',
    bio: 'Professional yoga instructor',
    profile_pic_url: 'https://example.com/creator1.jpg',
    price_per_min: 10.00,
    total_sessions: 50,
    total_earnings: 1000,
    follower_count: 100,
    created_at: '2024-01-01'
  },
  {
    username: 'creator2',
    bio: 'Fitness coach',
    profile_pic_url: null,
    price_per_min: 8.00,
    total_sessions: 30,
    total_earnings: 500,
    follower_count: 75,
    created_at: '2024-01-02'
  }
];

describe('CreatorDirectory', () => {
  const mockUser = {
    displayName: 'Test User',
    email: 'test@example.com',
    photoURL: 'https://example.com/user.jpg'
  };
  
  const mockOnClose = jest.fn();
  const mockOnSelectCreator = jest.fn();
  
  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    onSelectCreator: mockOnSelectCreator,
    sessionType: 'video',
    user: mockUser
  };

  beforeEach(() => {
    jest.clearAllMocks();
    getAuthToken.mockResolvedValue('mock-token');
  });

  it('renders modal when open', () => {
    render(<CreatorDirectory {...defaultProps} />);
    
    expect(screen.getByRole('dialog', { name: 'Creator directory' })).toBeInTheDocument();
    expect(screen.getByText('Creator Directory')).toBeInTheDocument();
    expect(screen.getByText('Choose a creator for your video call')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(<CreatorDirectory {...defaultProps} isOpen={false} />);
    
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('displays creators list', async () => {
    const { usePaginatedApi } = require('../../hooks/useApi');
    usePaginatedApi.mockReturnValue({
      items: mockCreators,
      loading: false,
      error: null,
      refetch: jest.fn(),
      page: 1,
      totalPages: 2,
      nextPage: jest.fn(),
      prevPage: jest.fn(),
      hasNextPage: true,
      hasPrevPage: false
    });
    
    render(<CreatorDirectory {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('@creator1')).toBeInTheDocument();
      expect(screen.getByText('Professional yoga instructor')).toBeInTheDocument();
      expect(screen.getByText('@creator2')).toBeInTheDocument();
      expect(screen.getByText('Fitness coach')).toBeInTheDocument();
    });
  });

  it('displays loading state', () => {
    const { usePaginatedApi } = require('../../hooks/useApi');
    usePaginatedApi.mockReturnValue({
      items: [],
      loading: true,
      error: null,
      refetch: jest.fn(),
      page: 1,
      totalPages: 1,
      nextPage: jest.fn(),
      prevPage: jest.fn(),
      hasNextPage: false,
      hasPrevPage: false
    });
    
    render(<CreatorDirectory {...defaultProps} />);
    
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('Loading creators...')).toBeInTheDocument();
  });

  it('displays empty state when no creators', () => {
    const { usePaginatedApi } = require('../../hooks/useApi');
    usePaginatedApi.mockReturnValue({
      items: [],
      loading: false,
      error: null,
      refetch: jest.fn(),
      page: 1,
      totalPages: 0,
      nextPage: jest.fn(),
      prevPage: jest.fn(),
      hasNextPage: false,
      hasPrevPage: false
    });
    
    render(<CreatorDirectory {...defaultProps} />);
    
    expect(screen.getByText('No Creators Found')).toBeInTheDocument();
    expect(screen.getByText('No creators available at the moment')).toBeInTheDocument();
  });

  it('searches creators with debouncing', async () => {
    const { useSearchApi } = require('../../hooks/useApi');
    const searchResults = [mockCreators[0]];
    
    useSearchApi.mockReturnValue({
      results: searchResults,
      loading: false,
      error: null
    });
    
    render(<CreatorDirectory {...defaultProps} />);
    
    const searchInput = screen.getByLabelText('Search creators');
    await userEvent.type(searchInput, 'yoga');
    
    await waitFor(() => {
      expect(useSearchApi).toHaveBeenCalledWith(
        '/api/users/creators/search',
        'yoga',
        expect.objectContaining({
          minLength: 2,
          debounceDelay: 300
        })
      );
    });
  });

  it('handles creator selection', async () => {
    render(<CreatorDirectory {...defaultProps} />);
    
    await waitFor(() => {
      const creatorCard = screen.getByRole('listitem', { name: /creator1/ });
      fireEvent.click(creatorCard);
    });
    
    expect(screen.getByText('Selected: @creator1 • Rate: $10.00/min')).toBeInTheDocument();
  });

  it('handles keyboard navigation', async () => {
    render(<CreatorDirectory {...defaultProps} />);
    
    await waitFor(() => {
      const creatorsList = screen.getByRole('list', { name: 'Creators list' });
      
      // Press ArrowRight to navigate
      fireEvent.keyDown(creatorsList, { key: 'ArrowRight' });
      
      // Press Enter to select
      fireEvent.keyDown(creatorsList, { key: 'Enter' });
    });
  });

  it('starts session with selected creator', async () => {
    const { useMutation } = require('../../hooks/useApi');
    const mockMutate = jest.fn().mockResolvedValue({ callRequestId: '123' });
    
    useMutation.mockReturnValue({
      mutate: mockMutate,
      loading: false
    });
    
    render(<CreatorDirectory {...defaultProps} />);
    
    // Select a creator
    await waitFor(() => {
      const creatorCard = screen.getByRole('listitem', { name: /creator1/ });
      fireEvent.click(creatorCard);
    });
    
    // Click start session
    const startButton = screen.getByLabelText('Start video call with creator1');
    fireEvent.click(startButton);
    
    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith('creator1');
      expect(toast.success).toHaveBeenCalledWith(
        expect.stringContaining('Call request sent to @creator1')
      );
      expect(mockOnSelectCreator).toHaveBeenCalledWith(
        expect.objectContaining({ username: 'creator1' }),
        'video',
        '123'
      );
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('disables start button when no creator selected', () => {
    render(<CreatorDirectory {...defaultProps} />);
    
    const startButton = screen.getByLabelText('Select a creator to start call');
    expect(startButton).toBeDisabled();
  });

  it('handles sort options', async () => {
    render(<CreatorDirectory {...defaultProps} />);
    
    // Click on Popular sort
    const popularButton = screen.getByLabelText('Sort creators by popularity');
    fireEvent.click(popularButton);
    
    expect(popularButton).toHaveAttribute('aria-pressed', 'true');
    
    // Click on Price sort
    const priceButton = screen.getByLabelText('Sort creators by price');
    fireEvent.click(priceButton);
    
    expect(priceButton).toHaveAttribute('aria-pressed', 'true');
    expect(popularButton).toHaveAttribute('aria-pressed', 'false');
  });

  it('displays correct pricing for different session types', () => {
    render(<CreatorDirectory {...defaultProps} sessionType="voice" />);
    
    expect(screen.getByText('Choose a creator for your voice call')).toBeInTheDocument();
    expect(screen.getAllByText(/Voice Call/)[0]).toBeInTheDocument();
  });

  it('handles pagination controls', async () => {
    const { usePaginatedApi } = require('../../hooks/useApi');
    const mockNextPage = jest.fn();
    const mockPrevPage = jest.fn();
    
    usePaginatedApi.mockReturnValue({
      items: mockCreators,
      loading: false,
      error: null,
      refetch: jest.fn(),
      page: 1,
      totalPages: 3,
      nextPage: mockNextPage,
      prevPage: mockPrevPage,
      hasNextPage: true,
      hasPrevPage: false
    });
    
    render(<CreatorDirectory {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    });
    
    const nextButton = screen.getByLabelText('Next page');
    expect(nextButton).not.toBeDisabled();
    fireEvent.click(nextButton);
    
    expect(mockNextPage).toHaveBeenCalled();
    
    const prevButton = screen.getByLabelText('Previous page');
    expect(prevButton).toBeDisabled();
  });

  it('handles API errors gracefully', async () => {
    const { usePaginatedApi } = require('../../hooks/useApi');
    
    usePaginatedApi.mockReturnValue({
      items: [],
      loading: false,
      error: new Error('API Error'),
      refetch: jest.fn(),
      page: 1,
      totalPages: 0,
      nextPage: jest.fn(),
      prevPage: jest.fn(),
      hasNextPage: false,
      hasPrevPage: false
    });
    
    render(<CreatorDirectory {...defaultProps} />);
    
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to load creators directory');
    });
  });

  it('closes modal when close button is clicked', () => {
    render(<CreatorDirectory {...defaultProps} />);
    
    const closeButton = screen.getByLabelText('Close creator directory');
    fireEvent.click(closeButton);
    
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('closes modal when clicking outside', () => {
    render(<CreatorDirectory {...defaultProps} />);
    
    const backdrop = screen.getByRole('dialog').parentElement;
    fireEvent.click(backdrop);
    
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('displays loading state for start button', async () => {
    const { useMutation } = require('../../hooks/useApi');
    
    useMutation.mockReturnValue({
      mutate: jest.fn(),
      loading: true
    });
    
    render(<CreatorDirectory {...defaultProps} />);
    
    // Select a creator
    await waitFor(() => {
      const creatorCard = screen.getByRole('listitem', { name: /creator1/ });
      fireEvent.click(creatorCard);
    });
    
    expect(screen.getByText('Sending Request...')).toBeInTheDocument();
  });

  it('handles creators with missing profile pictures', async () => {
    render(<CreatorDirectory {...defaultProps} />);
    
    await waitFor(() => {
      // creator2 has no profile pic
      const avatarFallback = screen.getByText('C');
      expect(avatarFallback).toBeInTheDocument();
    });
  });
});