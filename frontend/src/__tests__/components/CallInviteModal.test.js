import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import CallInviteModal from '../../components/CallInviteModal';
import { getAuthToken } from '../../utils/supabase-auth';
import { fetchWithRetry } from '../../utils/fetchWithRetry';

// Mock dependencies
jest.mock('../../utils/supabase-auth');
jest.mock('../../utils/fetchWithRetry');
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }) => children,
}));

// Mock toast
jest.mock('../../components/ui/EnhancedToaster', () => ({
  customToast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

describe('CallInviteModal', () => {
  const mockOnClose = jest.fn();
  const mockOnInviteSent = jest.fn();

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    onInviteSent: mockOnInviteSent,
    creatorType: 'general'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    getAuthToken.mockResolvedValue('mock-token');
    fetchWithRetry.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true })
    });
  });

  it('renders modal when open', () => {
    render(<CallInviteModal {...defaultProps} />);
    
    expect(screen.getByRole('dialog', { name: 'Invite fan to session' })).toBeInTheDocument();
    expect(screen.getByText('Invite Fan to Session')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(<CallInviteModal {...defaultProps} isOpen={false} />);
    
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes modal when close button is clicked', () => {
    render(<CallInviteModal {...defaultProps} />);
    
    const closeButton = screen.getByLabelText('Close invite modal');
    fireEvent.click(closeButton);
    
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('closes modal when clicking outside', () => {
    render(<CallInviteModal {...defaultProps} />);
    
    const backdrop = screen.getByRole('dialog').parentElement;
    fireEvent.click(backdrop);
    
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('toggles between video and voice call types', () => {
    render(<CallInviteModal {...defaultProps} />);
    
    const voiceButton = screen.getByLabelText('Select voice call option');
    expect(voiceButton).toHaveAttribute('aria-pressed', 'false');
    
    fireEvent.click(voiceButton);
    
    expect(voiceButton).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('Select video call option')).toHaveAttribute('aria-pressed', 'false');
  });

  it('searches for fans with debouncing', async () => {
    render(<CallInviteModal {...defaultProps} />);
    
    const searchInput = screen.getByLabelText('Search for fans');
    await userEvent.type(searchInput, 'alice');
    
    await waitFor(() => {
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    }, { timeout: 1000 });
  });

  it('selects a fan from search results', async () => {
    render(<CallInviteModal {...defaultProps} />);
    
    const searchInput = screen.getByLabelText('Search for fans');
    await userEvent.type(searchInput, 'alice');
    
    await waitFor(() => {
      const fanResult = screen.getByText('Alice Johnson');
      fireEvent.click(fanResult.closest('button'));
    });
    
    expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    expect(screen.getByText('VIP Member')).toBeInTheDocument();
  });

  it('validates required fields before sending invite', async () => {
    const { customToast } = require('../../components/ui/EnhancedToaster');
    render(<CallInviteModal {...defaultProps} />);
    
    const sendButton = screen.getByLabelText('Send session invite');
    fireEvent.click(sendButton);
    
    expect(customToast.error).toHaveBeenCalledWith('Please select a fan to invite');
  });

  it('sends invite successfully', async () => {
    const { customToast } = require('../../components/ui/EnhancedToaster');
    render(<CallInviteModal {...defaultProps} />);
    
    // Select a fan
    const searchInput = screen.getByLabelText('Search for fans');
    await userEvent.type(searchInput, 'alice');
    
    await waitFor(() => {
      const fanResult = screen.getByText('Alice Johnson');
      fireEvent.click(fanResult.closest('button'));
    });
    
    // Send invite
    const sendButton = screen.getByLabelText('Send session invite');
    fireEvent.click(sendButton);
    
    await waitFor(() => {
      expect(fetchWithRetry).toHaveBeenCalledWith(
        expect.stringContaining('/api/sessions/invite'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer mock-token'
          })
        })
      );
      
      expect(customToast.success).toHaveBeenCalledWith(
        expect.stringContaining('Video call invite sent'),
        expect.any(Object)
      );
      
      expect(mockOnInviteSent).toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('handles scheduled sessions', async () => {
    render(<CallInviteModal {...defaultProps} />);
    
    // Select scheduled option
    const scheduledRadio = screen.getByLabelText('Schedule for later');
    fireEvent.click(scheduledRadio);
    
    // Date and time inputs should appear
    expect(screen.getByLabelText('Select date')).toBeInTheDocument();
    expect(screen.getByLabelText('Select time')).toBeInTheDocument();
  });

  it('handles recurring sessions', () => {
    render(<CallInviteModal {...defaultProps} />);
    
    // Enable recurring
    const recurringCheckbox = screen.getByRole('checkbox', { name: /make this a recurring session/i });
    fireEvent.click(recurringCheckbox);
    
    // Recurring options should appear
    expect(screen.getByLabelText('Frequency')).toBeInTheDocument();
    expect(screen.getByLabelText('Number of sessions')).toBeInTheDocument();
  });

  it('calculates cost correctly', () => {
    render(<CallInviteModal {...defaultProps} />);
    
    // Default: 30 min video call at 8 tokens/min = 240 tokens
    expect(screen.getByText('240 tokens')).toBeInTheDocument();
    expect(screen.getByText('$12.00 USD')).toBeInTheDocument();
    
    // Change duration
    const durationInput = screen.getByLabelText('Duration');
    fireEvent.change(durationInput, { target: { value: '60' } });
    
    expect(screen.getByText('480 tokens')).toBeInTheDocument();
    expect(screen.getByText('$24.00 USD')).toBeInTheDocument();
  });

  it('displays creator-specific default message', () => {
    render(<CallInviteModal {...defaultProps} creatorType="yoga" />);
    
    const messageInput = screen.getByLabelText('Add a message (optional)');
    expect(messageInput.value).toContain('personal yoga session');
  });

  it('handles API errors gracefully', async () => {
    const { customToast } = require('../../components/ui/EnhancedToaster');
    fetchWithRetry.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Server error' })
    });
    
    render(<CallInviteModal {...defaultProps} />);
    
    // Select a fan
    const searchInput = screen.getByLabelText('Search for fans');
    await userEvent.type(searchInput, 'alice');
    
    await waitFor(() => {
      const fanResult = screen.getByText('Alice Johnson');
      fireEvent.click(fanResult.closest('button'));
    });
    
    // Send invite
    const sendButton = screen.getByLabelText('Send session invite');
    fireEvent.click(sendButton);
    
    await waitFor(() => {
      expect(customToast.error).toHaveBeenCalledWith('Failed to send invite');
    });
  });

  it('disables send button while sending', async () => {
    render(<CallInviteModal {...defaultProps} />);
    
    // Select a fan
    const searchInput = screen.getByLabelText('Search for fans');
    await userEvent.type(searchInput, 'alice');
    
    await waitFor(() => {
      const fanResult = screen.getByText('Alice Johnson');
      fireEvent.click(fanResult.closest('button'));
    });
    
    const sendButton = screen.getByLabelText('Send session invite');
    fireEvent.click(sendButton);
    
    expect(sendButton).toBeDisabled();
    expect(sendButton).toHaveTextContent('Sending...');
  });

  it('handles ESC key to close modal', () => {
    render(<CallInviteModal {...defaultProps} />);
    
    fireEvent.keyDown(document, { key: 'Escape' });
    
    expect(mockOnClose).toHaveBeenCalled();
  });
});