import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ConnectionStatusPanel from '../../components/ConnectionStatusPanel';

// Mock framer-motion to avoid animation issues in tests
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }) => <>{children}</>,
}));

describe('ConnectionStatusPanel', () => {
  // Mock connectionResilience object
  const mockConnectionResilience = {
    getConnectionStatus: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    forceReconnection: jest.fn(),
  };

  // Mock fallbackManager object
  const mockFallbackManager = {
    getStatus: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default return values
    mockConnectionResilience.getConnectionStatus.mockReturnValue({
      state: 'CONNECTED',
      uptime: 60000,
      metrics: { totalDrops: 0, totalReconnects: 0 },
      mode: 'FULL_VIDEO',
      fallbackActive: false,
      isReconnecting: false,
      reconnectAttempts: 0,
      consecutiveFailures: 0,
    });

    mockFallbackManager.getStatus.mockReturnValue({
      currentMode: 'FULL_VIDEO',
      currentModeLabel: 'Full Video',
      availableModes: ['FULL_VIDEO', 'REDUCED_VIDEO', 'AUDIO_ONLY', 'CHAT_ONLY'],
      isFallbackActive: false,
      transitionInProgress: false,
      chatConnected: true,
    });
  });

  test('renders connection status panel with proper ARIA attributes', () => {
    render(
      <ConnectionStatusPanel
        connectionResilience={mockConnectionResilience}
        fallbackManager={mockFallbackManager}
        isVisible={true}
      />
    );

    // Check for proper ARIA region
    expect(screen.getByRole('region', { name: 'Connection status panel' })).toBeInTheDocument();
    
    // Check for header
    expect(screen.getByText('Connection Status')).toBeInTheDocument();
    
    // Check for connection status
    expect(screen.getByRole('status', { name: 'Connection status: CONNECTED' })).toBeInTheDocument();
    expect(screen.getByText('CONNECTED')).toBeInTheDocument();
  });

  test('does not render when isVisible is false', () => {
    const { container } = render(
      <ConnectionStatusPanel
        connectionResilience={mockConnectionResilience}
        fallbackManager={mockFallbackManager}
        isVisible={false}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  test('validates props and returns null for invalid connectionResilience', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    
    const { container } = render(
      <ConnectionStatusPanel
        connectionResilience={{ invalid: true }}
        fallbackManager={mockFallbackManager}
        isVisible={true}
      />
    );

    expect(container.firstChild).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith('Invalid connectionResilience prop: missing required methods');
    
    consoleSpy.mockRestore();
  });

  test('handles expand/collapse functionality', () => {
    render(
      <ConnectionStatusPanel
        connectionResilience={mockConnectionResilience}
        fallbackManager={mockFallbackManager}
        isVisible={true}
      />
    );

    const expandButton = screen.getByLabelText('Expand connection details');
    expect(expandButton).toHaveAttribute('aria-expanded', 'false');
    
    // Click to expand
    fireEvent.click(expandButton);
    
    expect(screen.getByLabelText('Collapse connection details')).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Connection Metrics')).toBeInTheDocument();
  });

  test('shows reconnect button for disconnected state', () => {
    mockConnectionResilience.getConnectionStatus.mockReturnValue({
      state: 'DISCONNECTED',
      uptime: 0,
      metrics: {},
      isReconnecting: false,
    });

    // Trigger the connection state change handler
    mockConnectionResilience.on.mockImplementation((event, handler) => {
      if (event === 'connection-state-change') {
        handler();
      }
    });

    render(
      <ConnectionStatusPanel
        connectionResilience={mockConnectionResilience}
        fallbackManager={mockFallbackManager}
        isVisible={true}
      />
    );

    expect(screen.getByLabelText('Force reconnect to session')).toBeInTheDocument();
  });

  test('handles force reconnect', async () => {
    mockConnectionResilience.getConnectionStatus.mockReturnValue({
      state: 'DISCONNECTED',
      uptime: 0,
      metrics: {},
    });

    mockConnectionResilience.on.mockImplementation((event, handler) => {
      if (event === 'connection-state-change') {
        handler();
      }
    });

    render(
      <ConnectionStatusPanel
        connectionResilience={mockConnectionResilience}
        fallbackManager={mockFallbackManager}
        isVisible={true}
      />
    );

    const reconnectButton = screen.getByLabelText('Force reconnect to session');
    fireEvent.click(reconnectButton);

    expect(mockConnectionResilience.forceReconnection).toHaveBeenCalledTimes(1);
  });

  test('displays fallback status correctly', () => {
    mockFallbackManager.getStatus.mockReturnValue({
      currentMode: 'AUDIO_ONLY',
      currentModeLabel: 'Audio Only',
      isFallbackActive: true,
      fallbackReason: 'POOR_NETWORK_QUALITY',
    });

    render(
      <ConnectionStatusPanel
        connectionResilience={mockConnectionResilience}
        fallbackManager={mockFallbackManager}
        isVisible={true}
      />
    );

    expect(screen.getByRole('status', { name: 'Current mode: Audio Only' })).toBeInTheDocument();
    expect(screen.getByText('(Fallback Active)')).toBeInTheDocument();
    expect(screen.getByText(/poor network quality/i)).toBeInTheDocument();
  });

  test('shows transition in progress indicator', () => {
    mockConnectionResilience.getConnectionStatus.mockReturnValue({
      state: 'RECONNECTING',
      isReconnecting: true,
      reconnectAttempts: 2,
    });

    render(
      <ConnectionStatusPanel
        connectionResilience={mockConnectionResilience}
        fallbackManager={mockFallbackManager}
        isVisible={true}
      />
    );

    expect(screen.getByText('Reconnecting...')).toBeInTheDocument();
    expect(screen.getByLabelText('Reconnection attempt 2')).toBeInTheDocument();
  });

  test('handles close button when onToggle is provided', () => {
    const mockOnToggle = jest.fn();

    render(
      <ConnectionStatusPanel
        connectionResilience={mockConnectionResilience}
        fallbackManager={mockFallbackManager}
        isVisible={true}
        onToggle={mockOnToggle}
      />
    );

    const closeButton = screen.getByLabelText('Close connection status panel');
    fireEvent.click(closeButton);

    expect(mockOnToggle).toHaveBeenCalledTimes(1);
  });

  test('displays connection metrics in expanded view', () => {
    render(
      <ConnectionStatusPanel
        connectionResilience={mockConnectionResilience}
        fallbackManager={mockFallbackManager}
        isVisible={true}
      />
    );

    // Expand the panel
    fireEvent.click(screen.getByLabelText('Expand connection details'));

    expect(screen.getByText('Connection Metrics')).toBeInTheDocument();
    expect(screen.getByText('Total Drops:')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  test('handles error states gracefully', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    
    // Make getConnectionStatus throw an error
    mockConnectionResilience.getConnectionStatus.mockImplementation(() => {
      throw new Error('Test error');
    });

    render(
      <ConnectionStatusPanel
        connectionResilience={mockConnectionResilience}
        fallbackManager={mockFallbackManager}
        isVisible={true}
      />
    );

    // Component should still render
    expect(screen.getByRole('region', { name: 'Connection status panel' })).toBeInTheDocument();
    
    // Error should be logged
    expect(consoleSpy).toHaveBeenCalledWith('Error updating connection status:', expect.any(Error));
    
    consoleSpy.mockRestore();
  });

  test('handles unknown states with fallback styling', () => {
    mockConnectionResilience.getConnectionStatus.mockReturnValue({
      state: 'UNKNOWN_STATE',
      metrics: {},
    });

    render(
      <ConnectionStatusPanel
        connectionResilience={mockConnectionResilience}
        fallbackManager={mockFallbackManager}
        isVisible={true}
      />
    );

    // Should render with unknown/default styling
    expect(screen.getByText('UNKNOWN STATE')).toBeInTheDocument();
  });

  test('properly cleans up event listeners on unmount', () => {
    const { unmount } = render(
      <ConnectionStatusPanel
        connectionResilience={mockConnectionResilience}
        fallbackManager={mockFallbackManager}
        isVisible={true}
      />
    );

    // Verify event listeners were registered
    expect(mockConnectionResilience.on).toHaveBeenCalled();
    expect(mockFallbackManager.on).toHaveBeenCalled();

    unmount();

    // Verify event listeners were removed
    expect(mockConnectionResilience.off).toHaveBeenCalled();
    expect(mockFallbackManager.off).toHaveBeenCalled();
  });

  test('updates status at throttled intervals', async () => {
    jest.useFakeTimers();

    render(
      <ConnectionStatusPanel
        connectionResilience={mockConnectionResilience}
        fallbackManager={mockFallbackManager}
        isVisible={true}
      />
    );

    // Initial call
    expect(mockConnectionResilience.getConnectionStatus).toHaveBeenCalledTimes(1);

    // Fast forward 3 seconds (less than throttle interval of 5 seconds)
    jest.advanceTimersByTime(3000);
    expect(mockConnectionResilience.getConnectionStatus).toHaveBeenCalledTimes(1);

    // Fast forward to 5 seconds total
    jest.advanceTimersByTime(2000);
    expect(mockConnectionResilience.getConnectionStatus).toHaveBeenCalledTimes(2);

    jest.useRealTimers();
  });
});