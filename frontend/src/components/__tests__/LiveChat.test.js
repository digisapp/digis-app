import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import LiveChat from '../LiveChat';

// Mock Socket.IO
const mockSocket = {
  on: jest.fn(),
  off: jest.fn(),
  emit: jest.fn(),
  disconnect: jest.fn(),
};

jest.mock('socket.io-client', () => {
  return jest.fn(() => mockSocket);
});

// Mock Supabase auth
jest.mock('../../utils/auth-helpers', () => ({
  auth: {
    currentUser: {
      getAuthToken: jest.fn().mockResolvedValue('mock-supabase-token'),
      uid: 'test-user-123',
      displayName: 'Test User',
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

// Mock fetch for API calls
global.fetch = jest.fn();

describe('LiveChat Component', () => {
  const defaultProps = {
    channel: 'test-chat-channel',
    user: {
      uid: 'test-user-123',
      displayName: 'Test User',
      getAuthToken: jest.fn().mockResolvedValue('mock-supabase-token'),
    },
    isHost: false,
    onMessageSent: jest.fn(),
    className: '',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    fetch.mockClear();
    mockSocket.on.mockClear();
    mockSocket.emit.mockClear();
    
    // Mock successful API responses
    fetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        success: true,
        messages: [],
      }),
    });

    // Mock environment variables
    import.meta.env.VITE_BACKEND_URL = 'http://localhost:3001';
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Component Rendering', () => {
    test('renders LiveChat component', async () => {
      await act(async () => {
        render(<LiveChat {...defaultProps} />);
      });

      expect(screen.getByText(/Chat|Messages/)).toBeInTheDocument();
    });

    test('shows message input field', async () => {
      await act(async () => {
        render(<LiveChat {...defaultProps} />);
      });

      const messageInput = screen.getByRole('textbox') || screen.getByPlaceholderText(/type.*message|send.*message/i);
      expect(messageInput).toBeInTheDocument();
    });

    test('displays send button', async () => {
      await act(async () => {
        render(<LiveChat {...defaultProps} />);
      });

      const sendButton = screen.getByRole('button', { name: /send/i }) || screen.getByText(/send/i);
      expect(sendButton).toBeInTheDocument();
    });
  });

  describe('Message Handling', () => {
    test('sends message when send button is clicked', async () => {
      await act(async () => {
        render(<LiveChat {...defaultProps} />);
      });

      const messageInput = screen.getByRole('textbox') || screen.getByPlaceholderText(/type.*message/i);
      const sendButton = screen.getByRole('button', { name: /send/i }) || screen.getByText(/send/i);

      await act(async () => {
        fireEvent.change(messageInput, { target: { value: 'Hello, world!' } });
        fireEvent.click(sendButton);
      });

      expect(mockSocket.emit).toHaveBeenCalled();
    });

    test('sends message on Enter key press', async () => {
      await act(async () => {
        render(<LiveChat {...defaultProps} />);
      });

      const messageInput = screen.getByRole('textbox') || screen.getByPlaceholderText(/type.*message/i);

      await act(async () => {
        fireEvent.change(messageInput, { target: { value: 'Hello via Enter!' } });
        fireEvent.keyPress(messageInput, { key: 'Enter', code: 'Enter' });
      });

      expect(mockSocket.emit).toHaveBeenCalled();
    });

    test('does not send empty messages', async () => {
      await act(async () => {
        render(<LiveChat {...defaultProps} />);
      });

      const sendButton = screen.getByRole('button', { name: /send/i }) || screen.getByText(/send/i);

      await act(async () => {
        fireEvent.click(sendButton);
      });

      // Should not emit empty messages
      expect(mockSocket.emit).not.toHaveBeenCalledWith('chat-message', expect.objectContaining({
        text: ''
      }));
    });

    test('clears input after sending message', async () => {
      await act(async () => {
        render(<LiveChat {...defaultProps} />);
      });

      const messageInput = screen.getByRole('textbox') || screen.getByPlaceholderText(/type.*message/i);
      const sendButton = screen.getByRole('button', { name: /send/i }) || screen.getByText(/send/i);

      await act(async () => {
        fireEvent.change(messageInput, { target: { value: 'Test message' } });
        fireEvent.click(sendButton);
      });

      await waitFor(() => {
        expect(messageInput.value).toBe('');
      });
    });
  });

  describe('Message Display', () => {
    test('displays received messages', async () => {
      await act(async () => {
        render(<LiveChat {...defaultProps} />);
      });

      // Simulate receiving a message
      const mockMessage = {
        id: '1',
        senderId: 'other-user',
        text: 'Hello from other user!',
        timestamp: new Date(),
        isOwn: false,
      };

      // Find the socket.on call for 'chat-message' and simulate receiving a message
      const onChatMessage = mockSocket.on.mock.calls.find(call => call[0] === 'chat-message');
      if (onChatMessage) {
        act(() => {
          onChatMessage[1](mockMessage);
        });
      }

      await waitFor(() => {
        expect(screen.getByText('Hello from other user!')).toBeInTheDocument();
      });
    });

    test('distinguishes own messages from others', async () => {
      await act(async () => {
        render(<LiveChat {...defaultProps} />);
      });

      // Simulate receiving own message
      const ownMessage = {
        id: '2',
        senderId: 'test-user-123',
        text: 'My own message',
        timestamp: new Date(),
        isOwn: true,
      };

      const onChatMessage = mockSocket.on.mock.calls.find(call => call[0] === 'chat-message');
      if (onChatMessage) {
        act(() => {
          onChatMessage[1](ownMessage);
        });
      }

      await waitFor(() => {
        expect(screen.getByText('My own message')).toBeInTheDocument();
      });
    });

    test('displays message timestamps', async () => {
      await act(async () => {
        render(<LiveChat {...defaultProps} />);
      });

      const messageWithTime = {
        id: '3',
        senderId: 'test-user',
        text: 'Message with timestamp',
        timestamp: new Date('2023-01-01T12:00:00Z'),
        isOwn: false,
      };

      const onChatMessage = mockSocket.on.mock.calls.find(call => call[0] === 'chat-message');
      if (onChatMessage) {
        act(() => {
          onChatMessage[1](messageWithTime);
        });
      }

      await waitFor(() => {
        expect(screen.getByText('Message with timestamp')).toBeInTheDocument();
        // Timestamp should be displayed (exact format may vary)
        expect(screen.getByText(/12:00|Jan|2023/)).toBeDefined();
      });
    });
  });

  describe('Socket Connection', () => {
    test('establishes socket connection on mount', async () => {
      await act(async () => {
        render(<LiveChat {...defaultProps} />);
      });

      expect(mockSocket.on).toHaveBeenCalledWith('chat-message', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('user-joined', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('user-left', expect.any(Function));
    });

    test('joins chat channel on connection', async () => {
      await act(async () => {
        render(<LiveChat {...defaultProps} />);
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('join-channel', {
        channel: 'test-chat-channel',
        userId: 'test-user-123',
        userInfo: expect.any(Object),
      });
    });

    test('cleans up socket on unmount', async () => {
      const { unmount } = await act(async () => {
        return render(<LiveChat {...defaultProps} />);
      });

      await act(async () => {
        unmount();
      });

      expect(mockSocket.off).toHaveBeenCalled();
      expect(mockSocket.disconnect).toHaveBeenCalled();
    });
  });

  describe('User Interactions', () => {
    test('handles user join notifications', async () => {
      await act(async () => {
        render(<LiveChat {...defaultProps} />);
      });

      const onUserJoined = mockSocket.on.mock.calls.find(call => call[0] === 'user-joined');
      if (onUserJoined) {
        act(() => {
          onUserJoined[1]({ userId: 'new-user', displayName: 'New User' });
        });
      }

      await waitFor(() => {
        expect(screen.getByText(/New User.*joined|joined.*chat/i)).toBeInTheDocument();
      });
    });

    test('handles user leave notifications', async () => {
      await act(async () => {
        render(<LiveChat {...defaultProps} />);
      });

      const onUserLeft = mockSocket.on.mock.calls.find(call => call[0] === 'user-left');
      if (onUserLeft) {
        act(() => {
          onUserLeft[1]({ userId: 'leaving-user', displayName: 'Leaving User' });
        });
      }

      await waitFor(() => {
        expect(screen.getByText(/Leaving User.*left|left.*chat/i)).toBeInTheDocument();
      });
    });

    test('shows typing indicators', async () => {
      await act(async () => {
        render(<LiveChat {...defaultProps} />);
      });

      const onTyping = mockSocket.on.mock.calls.find(call => call[0] === 'user-typing');
      if (onTyping) {
        act(() => {
          onTyping[1]({ userId: 'typing-user', displayName: 'Typing User' });
        });
      }

      await waitFor(() => {
        expect(screen.getByText(/Typing User.*typing|typing/i)).toBeInTheDocument();
      });
    });
  });

  describe('Message Features', () => {
    test('supports message reactions', async () => {
      await act(async () => {
        render(<LiveChat {...defaultProps} />);
      });

      const messageWithReactions = {
        id: '4',
        senderId: 'other-user',
        text: 'React to this message',
        timestamp: new Date(),
        isOwn: false,
        reactions: { '❤️': 2, '👍': 1 },
      };

      const onChatMessage = mockSocket.on.mock.calls.find(call => call[0] === 'chat-message');
      if (onChatMessage) {
        act(() => {
          onChatMessage[1](messageWithReactions);
        });
      }

      await waitFor(() => {
        expect(screen.getByText('React to this message')).toBeInTheDocument();
        expect(screen.getByText(/❤️.*2/)).toBeInTheDocument();
      });
    });

    test('handles message moderation for hosts', async () => {
      await act(async () => {
        render(<LiveChat {...defaultProps} isHost={true} />);
      });

      const messageToModerate = {
        id: '5',
        senderId: 'problematic-user',
        text: 'This message needs moderation',
        timestamp: new Date(),
        isOwn: false,
      };

      const onChatMessage = mockSocket.on.mock.calls.find(call => call[0] === 'chat-message');
      if (onChatMessage) {
        act(() => {
          onChatMessage[1](messageToModerate);
        });
      }

      await waitFor(() => {
        expect(screen.getByText('This message needs moderation')).toBeInTheDocument();
        // Host should see moderation options
        expect(screen.getByText(/delete|remove|moderate/i) || screen.getByRole('button', { name: /delete/i })).toBeDefined();
      });
    });
  });

  describe('Accessibility', () => {
    test('has proper ARIA labels', async () => {
      await act(async () => {
        render(<LiveChat {...defaultProps} />);
      });

      const messageInput = screen.getByRole('textbox');
      expect(messageInput).toHaveAttribute('aria-label', expect.stringMatching(/message|chat/i));
    });

    test('supports keyboard navigation', async () => {
      await act(async () => {
        render(<LiveChat {...defaultProps} />);
      });

      const messageInput = screen.getByRole('textbox');
      messageInput.focus();
      expect(document.activeElement).toBe(messageInput);
    });

    test('announces new messages to screen readers', async () => {
      await act(async () => {
        render(<LiveChat {...defaultProps} />);
      });

      // Should have live region for screen reader announcements
      expect(screen.getByRole('log') || screen.getByLabelText(/chat.*messages|message.*history/i)).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('handles connection errors gracefully', async () => {
      mockSocket.on.mockImplementation((event, callback) => {
        if (event === 'connect_error') {
          callback(new Error('Connection failed'));
        }
      });

      await act(async () => {
        render(<LiveChat {...defaultProps} />);
      });

      // Should handle connection errors without crashing
      expect(screen.getByText(/Chat|Messages/)).toBeInTheDocument();
    });

    test('retries failed message sends', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'));
      fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ success: true }),
      });

      await act(async () => {
        render(<LiveChat {...defaultProps} />);
      });

      const messageInput = screen.getByRole('textbox');
      const sendButton = screen.getByRole('button', { name: /send/i }) || screen.getByText(/send/i);

      await act(async () => {
        fireEvent.change(messageInput, { target: { value: 'Failed message' } });
        fireEvent.click(sendButton);
      });

      // Should attempt to retry
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Performance', () => {
    test('limits message history to prevent memory issues', async () => {
      await act(async () => {
        render(<LiveChat {...defaultProps} />);
      });

      // Simulate receiving many messages
      const onChatMessage = mockSocket.on.mock.calls.find(call => call[0] === 'chat-message');
      if (onChatMessage) {
        for (let i = 0; i < 1000; i++) {
          act(() => {
            onChatMessage[1]({
              id: i.toString(),
              senderId: 'test-user',
              text: `Message ${i}`,
              timestamp: new Date(),
              isOwn: false,
            });
          });
        }
      }

      // Should limit displayed messages
      const messages = screen.getAllByText(/Message \d+/);
      expect(messages.length).toBeLessThan(200); // Assuming reasonable limit
    });

    test('scrolls to bottom on new messages', async () => {
      await act(async () => {
        render(<LiveChat {...defaultProps} />);
      });

      const scrollContainer = document.querySelector('[data-testid="chat-messages"]') || 
                             document.querySelector('.chat-messages') ||
                             document.querySelector('[role="log"]');
      
      if (scrollContainer) {
        const scrollSpy = jest.spyOn(scrollContainer, 'scrollTo').mockImplementation();
        
        const onChatMessage = mockSocket.on.mock.calls.find(call => call[0] === 'chat-message');
        if (onChatMessage) {
          act(() => {
            onChatMessage[1]({
              id: 'new-message',
              senderId: 'test-user',
              text: 'New message should scroll',
              timestamp: new Date(),
              isOwn: false,
            });
          });
        }

        await waitFor(() => {
          expect(scrollSpy).toHaveBeenCalled();
        });
      }
    });
  });
});