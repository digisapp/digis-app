/**
 * Analytics Dashboard Tests
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AnalyticsDashboard from '../../components/AnalyticsDashboard';
import analyticsCollector from '../../utils/AnalyticsCollector';

// Mock analytics collector
jest.mock('../../utils/AnalyticsCollector', () => ({
  on: jest.fn(),
  off: jest.fn(),
  trackPageView: jest.fn(),
  trackInteraction: jest.fn()
}));

// Mock Recharts components
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }) => <div data-testid="responsive-container">{children}</div>,
  AreaChart: ({ children }) => <div data-testid="area-chart">{children}</div>,
  ComposedChart: ({ children }) => <div data-testid="composed-chart">{children}</div>,
  LineChart: ({ children }) => <div data-testid="line-chart">{children}</div>,
  BarChart: ({ children }) => <div data-testid="bar-chart">{children}</div>,
  PieChart: ({ children }) => <div data-testid="pie-chart">{children}</div>,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Area: () => <div data-testid="area" />,
  Line: () => <div data-testid="line" />,
  Bar: () => <div data-testid="bar" />,
  Pie: () => <div data-testid="pie" />,
  Cell: () => <div data-testid="cell" />
}));

// Mock WebSocket
global.WebSocket = jest.fn(() => ({
  send: jest.fn(),
  close: jest.fn(),
  readyState: WebSocket.OPEN,
  onopen: null,
  onmessage: null,
  onerror: null,
  onclose: null
}));

// Mock fetch
global.fetch = jest.fn();

const mockUser = {
  uid: 'creator123',
  getIdToken: jest.fn().mockResolvedValue('mock-token')
};

const mockAnalyticsData = {
  analytics: {
    creator: {
      username: 'testcreator',
      totalEarnings: 1250.50,
      totalSessions: 85,
      followerCount: 1205,
      avgRating: 4.7
    },
    growth: {
      revenue: 12.5,
      sessions: 8.3,
      uniqueFans: 15.2
    },
    earnings: {
      totalPeriod: 1250.50,
      dailyData: [
        { date: '2024-01-01', earnings: 45.50, sessions: 3 },
        { date: '2024-01-02', earnings: 67.25, sessions: 4 },
        { date: '2024-01-03', earnings: 89.75, sessions: 6 }
      ]
    },
    sessions: {
      typeBreakdown: [
        { type: 'video_call', count: 45, revenue: 750.25, avgDuration: 22.5 },
        { type: 'voice_call', count: 30, revenue: 350.15, avgDuration: 18.2 },
        { type: 'live_stream', count: 10, revenue: 150.10, avgDuration: 45.8 }
      ],
      hourlyActivity: [
        { hour: '0', sessions: 2 },
        { hour: '1', sessions: 1 },
        { hour: '2', sessions: 0 }
      ]
    },
    fans: {
      retention: {
        oneTimeFans: 45,
        casualFans: 32,
        loyalFans: 18,
        avgSessionsPerFan: 2.8
      },
      topFans: [
        {
          username: 'fan1',
          sessionCount: 12,
          totalSpent: 156.75,
          lastSession: '2024-01-03T10:30:00Z'
        },
        {
          username: 'fan2',
          sessionCount: 8,
          totalSpent: 89.50,
          lastSession: '2024-01-02T15:45:00Z'
        }
      ]
    },
    tips: {
      dailyData: [
        { date: '2024-01-01', tokens: 50 },
        { date: '2024-01-02', tokens: 75 }
      ]
    },
    period: {
      days: 30
    }
  }
};

const mockRealtimeData = {
  realtime: {
    activeSessions: [
      {
        id: 'session1',
        fan_username: 'activefan1',
        type: 'video_call',
        price_per_min: 2.5,
        start_time: '2024-01-03T14:30:00Z'
      }
    ],
    today: {
      earnings_today: 125.75,
      sessions_today: 8
    },
    onlineFollowers: 42
  }
};

describe('AnalyticsDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock successful API responses
    fetch.mockImplementation((url) => {
      if (url.includes('/api/analytics/creator/')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockAnalyticsData)
        });
      }
      if (url.includes('/api/analytics/realtime/')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockRealtimeData)
        });
      }
      return Promise.reject(new Error('Unknown URL'));
    });
  });

  describe('Initialization', () => {
    test('renders loading state initially', async () => {
      render(<AnalyticsDashboard user={mockUser} />);
      
      expect(screen.getByText('Analytics Dashboard')).toBeInTheDocument();
      expect(screen.getByTestId('loading-skeleton')).toBeInTheDocument();
    });

    test('loads analytics data on mount', async () => {
      render(<AnalyticsDashboard user={mockUser} />);
      
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/analytics/creator/creator123'),
          expect.objectContaining({
            headers: expect.objectContaining({
              'Authorization': 'Bearer mock-token'
            })
          })
        );
      });
    });

    test('sets up analytics collector listeners', async () => {
      render(<AnalyticsDashboard user={mockUser} />);
      
      expect(analyticsCollector.on).toHaveBeenCalledWith('event_tracked', expect.any(Function));
      expect(analyticsCollector.on).toHaveBeenCalledWith('events_flushed', expect.any(Function));
      expect(analyticsCollector.trackPageView).toHaveBeenCalledWith('analytics_dashboard', {
        period: '30',
        tab: 'overview'
      });
    });

    test('establishes WebSocket connection', async () => {
      render(<AnalyticsDashboard user={mockUser} />);
      
      await waitFor(() => {
        expect(WebSocket).toHaveBeenCalledWith(
          expect.stringContaining('/ws/analytics/creator123')
        );
      });
    });
  });

  describe('Real-time Features', () => {
    test('renders real-time toggle button', async () => {
      render(<AnalyticsDashboard user={mockUser} />);
      
      await waitFor(() => {
        expect(screen.getByText('Live')).toBeInTheDocument();
      });
    });

    test('toggles real-time tracking', async () => {
      const user = userEvent.setup();
      render(<AnalyticsDashboard user={mockUser} />);
      
      await waitFor(() => {
        expect(screen.getByText('Live')).toBeInTheDocument();
      });
      
      const toggleButton = screen.getByRole('button', { name: /live/i });
      await user.click(toggleButton);
      
      expect(analyticsCollector.trackInteraction).toHaveBeenCalledWith('toggle_realtime_tracking', {
        enabled: false
      });
    });

    test('displays real-time status indicators', async () => {
      render(<AnalyticsDashboard user={mockUser} />);
      
      await waitFor(() => {
        expect(screen.getByText('Live Status')).toBeInTheDocument();
        expect(screen.getByText('1')).toBeInTheDocument(); // Active sessions
        expect(screen.getByText('$125.75')).toBeInTheDocument(); // Today's earnings
      });
    });

    test('shows live events stream when active', async () => {
      render(<AnalyticsDashboard user={mockUser} />);
      
      // Simulate analytics event
      await act(async () => {
        const eventHandler = analyticsCollector.on.mock.calls.find(
          call => call[0] === 'event_tracked'
        )[1];
        
        eventHandler({
          eventType: 'session_started',
          timestamp: Date.now()
        });
      });
      
      await waitFor(() => {
        expect(screen.getByText('Live Events')).toBeInTheDocument();
        expect(screen.getByText('Session started')).toBeInTheDocument();
      });
    });
  });

  describe('Dashboard Tabs', () => {
    beforeEach(async () => {
      render(<AnalyticsDashboard user={mockUser} />);
      await waitFor(() => {
        expect(screen.getByText('testcreator')).toBeInTheDocument();
      });
    });

    test('renders all tab buttons', () => {
      expect(screen.getByText('Overview')).toBeInTheDocument();
      expect(screen.getByText('Earnings')).toBeInTheDocument();
      expect(screen.getByText('Sessions')).toBeInTheDocument();
      expect(screen.getByText('Fans')).toBeInTheDocument();
      expect(screen.getByText('Performance')).toBeInTheDocument();
    });

    test('switches tabs and tracks interaction', async () => {
      const user = userEvent.setup();
      
      const earningsTab = screen.getByText('Earnings');
      await user.click(earningsTab);
      
      expect(analyticsCollector.trackInteraction).toHaveBeenCalledWith('tab_changed', {
        tab: 'earnings',
        previousTab: 'overview'
      });
    });

    test('shows earnings tab content', async () => {
      const user = userEvent.setup();
      
      const earningsTab = screen.getByText('Earnings');
      await user.click(earningsTab);
      
      await waitFor(() => {
        expect(screen.getByText('Period Total')).toBeInTheDocument();
        expect(screen.getByText('Revenue by Type')).toBeInTheDocument();
      });
    });

    test('shows sessions tab content', async () => {
      const user = userEvent.setup();
      
      const sessionsTab = screen.getByText('Sessions');
      await user.click(sessionsTab);
      
      await waitFor(() => {
        expect(screen.getByText('Video call Sessions')).toBeInTheDocument();
        expect(screen.getByText('Voice call Sessions')).toBeInTheDocument();
        expect(screen.getByText('Hourly Activity Pattern')).toBeInTheDocument();
      });
    });

    test('shows fans tab content', async () => {
      const user = userEvent.setup();
      
      const fansTab = screen.getByText('Fans');
      await user.click(fansTab);
      
      await waitFor(() => {
        expect(screen.getByText('One-time Fans')).toBeInTheDocument();
        expect(screen.getByText('Top Fans')).toBeInTheDocument();
        expect(screen.getByText('fan1')).toBeInTheDocument();
      });
    });

    test('shows performance tab content', async () => {
      const user = userEvent.setup();
      
      const performanceTab = screen.getByText('Performance');
      await user.click(performanceTab);
      
      await waitFor(() => {
        expect(screen.getByText('Growth Metrics')).toBeInTheDocument();
        expect(screen.getByText('Performance Score')).toBeInTheDocument();
      });
    });
  });

  describe('Period Selection', () => {
    test('changes analytics period', async () => {
      const user = userEvent.setup();
      render(<AnalyticsDashboard user={mockUser} />);
      
      await waitFor(() => {
        expect(screen.getByDisplayValue('30 Days')).toBeInTheDocument();
      });
      
      const periodSelect = screen.getByDisplayValue('30 Days');
      await user.selectOptions(periodSelect, '7');
      
      expect(analyticsCollector.trackInteraction).toHaveBeenCalledWith('period_changed', {
        period: '7'
      });
    });

    test('refetches data when period changes', async () => {
      const user = userEvent.setup();
      render(<AnalyticsDashboard user={mockUser} />);
      
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledTimes(2); // Initial load
      });
      
      const periodSelect = screen.getByDisplayValue('30 Days');
      await user.selectOptions(periodSelect, '7');
      
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('period=7'),
          expect.any(Object)
        );
      });
    });
  });

  describe('Key Metrics Display', () => {
    beforeEach(async () => {
      render(<AnalyticsDashboard user={mockUser} />);
      await waitFor(() => {
        expect(screen.getByText('testcreator')).toBeInTheDocument();
      });
    });

    test('displays total earnings correctly', () => {
      expect(screen.getByText('$1,250.50')).toBeInTheDocument();
      expect(screen.getByText('+12.5% vs previous period')).toBeInTheDocument();
    });

    test('displays session metrics', () => {
      expect(screen.getByText('85')).toBeInTheDocument(); // Total sessions
      expect(screen.getByText('+8.3% vs previous period')).toBeInTheDocument();
    });

    test('displays follower count', () => {
      expect(screen.getByText('1,205')).toBeInTheDocument(); // Follower count
    });

    test('displays average rating', () => {
      expect(screen.getByText('4.7')).toBeInTheDocument(); // Average rating
      expect(screen.getByText('⭐⭐⭐⭐⭐')).toBeInTheDocument(); // Star rating
    });
  });

  describe('Charts and Visualizations', () => {
    beforeEach(async () => {
      render(<AnalyticsDashboard user={mockUser} />);
      await waitFor(() => {
        expect(screen.getByText('testcreator')).toBeInTheDocument();
      });
    });

    test('renders earnings chart', () => {
      expect(screen.getByText('Earnings Over Time')).toBeInTheDocument();
      expect(screen.getByTestId('composed-chart')).toBeInTheDocument();
    });

    test('shows live earnings indicator', () => {
      expect(screen.getByText('Live: $125.75')).toBeInTheDocument();
    });

    test('renders session type breakdown charts', async () => {
      const user = userEvent.setup();
      
      const earningsTab = screen.getByText('Earnings');
      await user.click(earningsTab);
      
      await waitFor(() => {
        expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
      });
    });
  });

  describe('WebSocket Message Handling', () => {
    test('handles session started message', async () => {
      render(<AnalyticsDashboard user={mockUser} />);
      
      await waitFor(() => {
        expect(WebSocket).toHaveBeenCalled();
      });
      
      // Simulate WebSocket message
      const wsInstance = WebSocket.mock.results[0].value;
      
      act(() => {
        wsInstance.onmessage({
          data: JSON.stringify({
            type: 'session_started',
            data: {
              id: 'new-session',
              fan_username: 'newfan',
              type: 'video_call'
            }
          })
        });
      });
      
      // Should update active sessions count
      await waitFor(() => {
        expect(screen.getByText('2')).toBeInTheDocument(); // Updated count
      });
    });

    test('handles revenue update message', async () => {
      render(<AnalyticsDashboard user={mockUser} />);
      
      await waitFor(() => {
        expect(WebSocket).toHaveBeenCalled();
      });
      
      const wsInstance = WebSocket.mock.results[0].value;
      
      act(() => {
        wsInstance.onmessage({
          data: JSON.stringify({
            type: 'revenue_update',
            data: {
              totalEarnings: 150.25
            }
          })
        });
      });
      
      await waitFor(() => {
        expect(screen.getByText('$150.25')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    test('handles API fetch errors gracefully', async () => {
      fetch.mockRejectedValueOnce(new Error('API Error'));
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      render(<AnalyticsDashboard user={mockUser} />);
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          'Failed to fetch analytics:',
          expect.any(Error)
        );
      });
      
      consoleSpy.mockRestore();
    });

    test('shows no data message when analytics is empty', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ analytics: null })
      });
      
      render(<AnalyticsDashboard user={mockUser} />);
      
      await waitFor(() => {
        expect(screen.getByText('No analytics data available')).toBeInTheDocument();
      });
    });

    test('handles WebSocket connection errors', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      render(<AnalyticsDashboard user={mockUser} />);
      
      await waitFor(() => {
        expect(WebSocket).toHaveBeenCalled();
      });
      
      const wsInstance = WebSocket.mock.results[0].value;
      
      act(() => {
        wsInstance.onerror(new Error('WebSocket error'));
      });
      
      expect(consoleSpy).toHaveBeenCalledWith(
        'Analytics WebSocket error:',
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('Cleanup', () => {
    test('cleans up resources on unmount', async () => {
      const { unmount } = render(<AnalyticsDashboard user={mockUser} />);
      
      await waitFor(() => {
        expect(WebSocket).toHaveBeenCalled();
      });
      
      unmount();
      
      expect(analyticsCollector.off).toHaveBeenCalledWith('event_tracked', expect.any(Function));
      expect(analyticsCollector.off).toHaveBeenCalledWith('events_flushed', expect.any(Function));
    });

    test('closes WebSocket on unmount', async () => {
      const { unmount } = render(<AnalyticsDashboard user={mockUser} />);
      
      await waitFor(() => {
        expect(WebSocket).toHaveBeenCalled();
      });
      
      const wsInstance = WebSocket.mock.results[0].value;
      
      unmount();
      
      expect(wsInstance.close).toHaveBeenCalled();
    });
  });
});