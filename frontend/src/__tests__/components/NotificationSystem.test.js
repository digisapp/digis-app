import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import NotificationSystem, { NotificationSettings, useNotifications } from '../../components/NotificationSystem';
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

// Mock WebSocket
global.WebSocket = jest.fn(() => ({
  send: jest.fn(),
  close: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
}));

// Mock Notification API
global.Notification = {
  requestPermission: jest.fn().mockResolvedValue('granted'),
  permission: 'granted'
};

describe('NotificationSystem', () => {
  const mockUser = {
    id: 1,
    username: 'testuser'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    getAuthToken.mockResolvedValue('mock-token');
    fetchWithRetry.mockResolvedValue({
      ok: true,
      json: async () => ({
        notifications: [
          {
            id: 1,
            type: 'call_request',
            title: 'Incoming Call',
            body: 'John wants to video call',
            read: false,
            createdAt: new Date().toISOString(),
            actionText: 'Accept'
          },
          {
            id: 2,
            type: 'token_earned',
            title: 'Tokens Earned',
            body: 'You earned 50 tokens',
            read: true,
            createdAt: new Date(Date.now() - 3600000).toISOString()
          }
        ],
        unreadCount: 1
      })
    });
    
    // Reset localStorage
    localStorage.clear();
  });

  it('renders notification bell with unread count', async () => {
    render(<NotificationSystem user={mockUser} isVisible={true} />);
    
    await waitFor(() => {
      const bellButton = screen.getByLabelText(/Notifications, 1 unread/);
      expect(bellButton).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument();
    });
  });

  it('does not render when isVisible is false', () => {
    render(<NotificationSystem user={mockUser} isVisible={false} />);
    
    expect(screen.queryByLabelText(/Notifications/)).not.toBeInTheDocument();
  });

  it('opens notification dropdown when bell is clicked', async () => {
    render(<NotificationSystem user={mockUser} isVisible={true} />);
    
    await waitFor(() => {
      const bellButton = screen.getByLabelText(/Notifications/);
      fireEvent.click(bellButton);
    });
    
    expect(screen.getByRole('region', { name: 'Notifications panel' })).toBeInTheDocument();
    expect(screen.getByText('Incoming Call')).toBeInTheDocument();
  });

  it('displays notifications with correct formatting', async () => {
    render(<NotificationSystem user={mockUser} isVisible={true} />);
    
    await waitFor(() => {
      fireEvent.click(screen.getByLabelText(/Notifications/));
    });
    
    expect(screen.getByText('Incoming Call')).toBeInTheDocument();
    expect(screen.getByText('John wants to video call')).toBeInTheDocument();
    expect(screen.getByText('Accept')).toBeInTheDocument();
    expect(screen.getByText('Just now')).toBeInTheDocument();
  });

  it('marks notification as read when clicked', async () => {
    render(<NotificationSystem user={mockUser} isVisible={true} />);
    
    await waitFor(() => {
      fireEvent.click(screen.getByLabelText(/Notifications/));
    });
    
    const notificationItem = screen.getByRole('listitem', { name: /Incoming Call/ });
    fireEvent.click(notificationItem);
    
    await waitFor(() => {
      expect(fetchWithRetry).toHaveBeenCalledWith(
        expect.stringContaining('/api/users/notifications/1/read'),
        expect.objectContaining({
          method: 'POST'
        })
      );
    });
  });

  it('marks all notifications as read', async () => {
    render(<NotificationSystem user={mockUser} isVisible={true} />);
    
    await waitFor(() => {
      fireEvent.click(screen.getByLabelText(/Notifications/));
    });
    
    const markAllButton = screen.getByLabelText('Mark all notifications as read');
    fireEvent.click(markAllButton);
    
    await waitFor(() => {
      expect(fetchWithRetry).toHaveBeenCalledWith(
        expect.stringContaining('/api/users/notifications/mark-all-read'),
        expect.objectContaining({
          method: 'POST'
        })
      );
      expect(toast.success).toHaveBeenCalledWith('All notifications marked as read');
    });
  });

  it('closes dropdown when clicking outside', async () => {
    render(<NotificationSystem user={mockUser} isVisible={true} />);
    
    await waitFor(() => {
      fireEvent.click(screen.getByLabelText(/Notifications/));
    });
    
    expect(screen.getByRole('region', { name: 'Notifications panel' })).toBeInTheDocument();
    
    // Click outside
    fireEvent.click(document.body);
    
    await waitFor(() => {
      expect(screen.queryByRole('region', { name: 'Notifications panel' })).not.toBeInTheDocument();
    });
  });

  it('closes dropdown when close button is clicked', async () => {
    render(<NotificationSystem user={mockUser} isVisible={true} />);
    
    await waitFor(() => {
      fireEvent.click(screen.getByLabelText(/Notifications/));
    });
    
    const closeButton = screen.getByLabelText('Close notifications panel');
    fireEvent.click(closeButton);
    
    await waitFor(() => {
      expect(screen.queryByRole('region', { name: 'Notifications panel' })).not.toBeInTheDocument();
    });
  });

  it('handles keyboard navigation', async () => {
    render(<NotificationSystem user={mockUser} isVisible={true} />);
    
    await waitFor(() => {
      fireEvent.click(screen.getByLabelText(/Notifications/));
    });
    
    const notificationsList = screen.getByRole('list', { name: 'Notifications list' });
    
    // Press ArrowDown
    fireEvent.keyDown(notificationsList, { key: 'ArrowDown' });
    
    // Press Escape to close
    fireEvent.keyDown(notificationsList, { key: 'Escape' });
    
    await waitFor(() => {
      expect(screen.queryByRole('region', { name: 'Notifications panel' })).not.toBeInTheDocument();
    });
  });

  it('handles WebSocket connection and reconnection', async () => {
    const mockWs = {
      send: jest.fn(),
      close: jest.fn(),
      onopen: null,
      onmessage: null,
      onclose: null
    };
    
    global.WebSocket = jest.fn(() => mockWs);
    
    render(<NotificationSystem user={mockUser} isVisible={true} />);
    
    // Simulate WebSocket open
    await act(async () => {
      mockWs.onopen();
    });
    
    expect(mockWs.send).toHaveBeenCalledWith(JSON.stringify({
      type: 'subscribe_notifications',
      userId: 1
    }));
    
    // Simulate WebSocket close and reconnection
    jest.useFakeTimers();
    await act(async () => {
      mockWs.onclose();
    });
    
    jest.advanceTimersByTime(3000);
    expect(global.WebSocket).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });

  it('handles incoming WebSocket notifications', async () => {
    const mockWs = {
      send: jest.fn(),
      close: jest.fn(),
      onopen: null,
      onmessage: null,
      onclose: null
    };
    
    global.WebSocket = jest.fn(() => mockWs);
    
    render(<NotificationSystem user={mockUser} isVisible={true} />);
    
    // Simulate incoming notification
    await act(async () => {
      mockWs.onmessage({
        data: JSON.stringify({
          type: 'notification',
          data: {
            id: 3,
            type: 'call_incoming',
            title: 'Video Call',
            body: 'Sarah is calling',
            read: false,
            createdAt: new Date().toISOString()
          }
        })
      });
    });
    
    expect(toast).toHaveBeenCalled();
  });

  it('requests notification permissions on mount', async () => {
    render(<NotificationSystem user={mockUser} isVisible={true} />);
    
    await waitFor(() => {
      expect(global.Notification.requestPermission).toHaveBeenCalled();
    });
  });

  it('handles API errors gracefully', async () => {
    fetchWithRetry.mockRejectedValueOnce(new Error('Network error'));
    
    render(<NotificationSystem user={mockUser} isVisible={true} />);
    
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to load notifications');
    });
  });
});

describe('NotificationSettings', () => {
  const mockUser = { id: 1 };
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  it('renders settings modal when open', () => {
    render(<NotificationSettings user={mockUser} isOpen={true} onClose={mockOnClose} />);
    
    expect(screen.getByRole('dialog', { name: 'Notification settings' })).toBeInTheDocument();
    expect(screen.getByText('Notification Settings')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(<NotificationSettings user={mockUser} isOpen={false} onClose={mockOnClose} />);
    
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('displays all setting toggles', () => {
    render(<NotificationSettings user={mockUser} isOpen={true} onClose={mockOnClose} />);
    
    expect(screen.getByLabelText(/Call requests/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Queue updates/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Token transactions/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Earnings notifications/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Fan interactions/)).toBeInTheDocument();
    expect(screen.getByLabelText(/System updates/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Sound notifications/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Desktop notifications/)).toBeInTheDocument();
  });

  it('toggles settings when clicked', async () => {
    render(<NotificationSettings user={mockUser} isOpen={true} onClose={mockOnClose} />);
    
    const callRequestsToggle = screen.getByRole('switch', { name: /Call requests enabled/ });
    expect(callRequestsToggle).toHaveAttribute('aria-checked', 'true');
    
    fireEvent.click(callRequestsToggle);
    
    expect(callRequestsToggle).toHaveAttribute('aria-checked', 'false');
  });

  it('saves settings to localStorage', () => {
    render(<NotificationSettings user={mockUser} isOpen={true} onClose={mockOnClose} />);
    
    const saveButton = screen.getByLabelText('Save notification settings');
    fireEvent.click(saveButton);
    
    const savedSettings = localStorage.getItem('notification-settings-1');
    expect(savedSettings).toBeTruthy();
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('loads saved settings from localStorage', () => {
    const savedSettings = {
      callRequests: false,
      queueUpdates: true,
      tokenUpdates: true,
      earnings: true,
      fanInteractions: true,
      systemUpdates: true,
      soundEnabled: false,
      desktopNotifications: true
    };
    
    localStorage.setItem('notification-settings-1', JSON.stringify(savedSettings));
    
    render(<NotificationSettings user={mockUser} isOpen={true} onClose={mockOnClose} />);
    
    const callRequestsToggle = screen.getByRole('switch', { name: /Call requests disabled/ });
    expect(callRequestsToggle).toHaveAttribute('aria-checked', 'false');
    
    const soundToggle = screen.getByRole('switch', { name: /Sound notifications disabled/ });
    expect(soundToggle).toHaveAttribute('aria-checked', 'false');
  });

  it('closes modal when Cancel is clicked', () => {
    render(<NotificationSettings user={mockUser} isOpen={true} onClose={mockOnClose} />);
    
    const cancelButton = screen.getByLabelText('Cancel notification settings changes');
    fireEvent.click(cancelButton);
    
    expect(mockOnClose).toHaveBeenCalled();
  });
});