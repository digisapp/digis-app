/**
 * Network Quality Monitor Tests
 */

import NetworkQualityMonitor from '../../utils/NetworkQualityMonitor';

// Mock Agora client
const mockAgoraClient = {
  on: jest.fn(),
  off: jest.fn(),
  getStats: jest.fn(),
  getLocalVideoStats: jest.fn(),
  getLocalAudioStats: jest.fn(),
};

describe('NetworkQualityMonitor', () => {
  let monitor;

  beforeEach(() => {
    jest.clearAllMocks();
    monitor = new NetworkQualityMonitor(mockAgoraClient);
  });

  afterEach(() => {
    if (monitor) {
      monitor.stop();
    }
  });

  describe('Initialization', () => {
    test('creates monitor with default options', () => {
      expect(monitor.options.monitorInterval).toBe(2000);
      expect(monitor.isMonitoring).toBe(false);
    });

    test('accepts custom options', () => {
      const customMonitor = new NetworkQualityMonitor(mockAgoraClient, {
        monitorInterval: 5000,
      });
      
      expect(customMonitor.options.monitorInterval).toBe(5000);
    });
  });

  describe('Monitoring Control', () => {
    test('starts monitoring successfully', () => {
      monitor.start();
      
      expect(monitor.isMonitoring).toBe(true);
      expect(mockAgoraClient.on).toHaveBeenCalledWith('network-quality', expect.any(Function));
      expect(mockAgoraClient.on).toHaveBeenCalledWith('connection-state-change', expect.any(Function));
    });

    test('stops monitoring successfully', () => {
      monitor.start();
      monitor.stop();
      
      expect(monitor.isMonitoring).toBe(false);
      expect(mockAgoraClient.off).toHaveBeenCalled();
    });

    test('does not start if already monitoring', () => {
      monitor.start();
      const firstInterval = monitor.monitoringInterval;
      
      monitor.start();
      expect(monitor.monitoringInterval).toBe(firstInterval);
    });
  });

  describe('Metrics Collection', () => {
    beforeEach(() => {
      mockAgoraClient.getStats.mockResolvedValue({
        RTT: 100,
        uplinkNetworkQuality: 5,
        downlinkNetworkQuality: 4,
      });
      
      mockAgoraClient.getLocalVideoStats.mockResolvedValue({
        sendBitrate: 1000,
        sendPacketsLost: 5,
        sendPackets: 1000,
      });
      
      mockAgoraClient.getLocalAudioStats.mockResolvedValue({
        sendBitrate: 64,
        sendPacketsLost: 2,
        sendPackets: 500,
      });
    });

    test('collects comprehensive metrics', async () => {
      await monitor.collectMetrics();
      
      expect(monitor.currentMetrics.rtt).toBe(100);
      expect(monitor.currentMetrics.uplinkQuality).toBe(5);
      expect(monitor.currentMetrics.downlinkQuality).toBe(4);
      expect(monitor.currentMetrics.packetLoss).toBeCloseTo(0.47, 2);
    });

    test('handles API errors gracefully', async () => {
      mockAgoraClient.getStats.mockRejectedValue(new Error('API Error'));
      
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      await monitor.collectMetrics();
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to collect'),
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('Quality Level Determination', () => {
    test('determines excellent quality correctly', () => {
      const metrics = {
        rtt: 30,
        packetLoss: 0.2,
        uplinkQuality: 6,
        downlinkQuality: 6,
      };
      
      const level = monitor.determineQualityLevel(metrics);
      expect(level).toBe('excellent');
    });

    test('determines poor quality correctly', () => {
      const metrics = {
        rtt: 350,
        packetLoss: 8.0,
        uplinkQuality: 2,
        downlinkQuality: 2,
      };
      
      const level = monitor.determineQualityLevel(metrics);
      expect(level).toBe('poor');
    });

    test('determines very bad quality correctly', () => {
      const metrics = {
        rtt: 1200,
        packetLoss: 25.0,
        uplinkQuality: 1,
        downlinkQuality: 1,
      };
      
      const level = monitor.determineQualityLevel(metrics);
      expect(level).toBe('veryBad');
    });
  });

  describe('Trend Analysis', () => {
    test('detects improving trend', () => {
      // Add history with improving quality
      const baseTime = Date.now();
      monitor.qualityHistory = [
        { rtt: 300, packetLoss: 5, uplinkQuality: 2, downlinkQuality: 2, timestamp: baseTime - 4000 },
        { rtt: 250, packetLoss: 3, uplinkQuality: 3, downlinkQuality: 3, timestamp: baseTime - 3000 },
        { rtt: 200, packetLoss: 2, uplinkQuality: 4, downlinkQuality: 4, timestamp: baseTime - 2000 },
        { rtt: 150, packetLoss: 1, uplinkQuality: 5, downlinkQuality: 5, timestamp: baseTime - 1000 },
        { rtt: 100, packetLoss: 0.5, uplinkQuality: 6, downlinkQuality: 6, timestamp: baseTime },
      ];
      
      const trend = monitor.calculateTrend();
      expect(trend).toBe('improving');
    });

    test('detects degrading trend', () => {
      const baseTime = Date.now();
      monitor.qualityHistory = [
        { rtt: 50, packetLoss: 0.5, uplinkQuality: 6, downlinkQuality: 6, timestamp: baseTime - 4000 },
        { rtt: 100, packetLoss: 1, uplinkQuality: 5, downlinkQuality: 5, timestamp: baseTime - 3000 },
        { rtt: 200, packetLoss: 3, uplinkQuality: 4, downlinkQuality: 4, timestamp: baseTime - 2000 },
        { rtt: 300, packetLoss: 5, uplinkQuality: 3, downlinkQuality: 3, timestamp: baseTime - 1000 },
        { rtt: 400, packetLoss: 8, uplinkQuality: 2, downlinkQuality: 2, timestamp: baseTime },
      ];
      
      const trend = monitor.calculateTrend();
      expect(trend).toBe('degrading');
    });

    test('detects stable trend', () => {
      const baseTime = Date.now();
      monitor.qualityHistory = [
        { rtt: 100, packetLoss: 1, uplinkQuality: 5, downlinkQuality: 5, timestamp: baseTime - 4000 },
        { rtt: 105, packetLoss: 1.2, uplinkQuality: 5, downlinkQuality: 4, timestamp: baseTime - 3000 },
        { rtt: 95, packetLoss: 0.8, uplinkQuality: 5, downlinkQuality: 5, timestamp: baseTime - 2000 },
        { rtt: 110, packetLoss: 1.1, uplinkQuality: 4, downlinkQuality: 5, timestamp: baseTime - 1000 },
        { rtt: 100, packetLoss: 1, uplinkQuality: 5, downlinkQuality: 5, timestamp: baseTime },
      ];
      
      const trend = monitor.calculateTrend();
      expect(trend).toBe('stable');
    });
  });

  describe('Quality Recommendations', () => {
    test('recommends maintaining excellent quality', () => {
      const recommendation = monitor.getQualityRecommendation('excellent', 'stable');
      
      expect(recommendation.profile).toBe('high');
      expect(recommendation.action).toBe('maintain');
    });

    test('recommends reducing for poor quality', () => {
      const recommendation = monitor.getQualityRecommendation('poor', 'degrading');
      
      expect(recommendation.profile).toBe('low');
      expect(recommendation.action).toBe('reduce_preemptive');
    });

    test('recommends waiting during improvement', () => {
      const recommendation = monitor.getQualityRecommendation('poor', 'improving');
      
      expect(recommendation.action).toBe('wait');
    });

    test('recommends emergency reduction for very bad quality', () => {
      const recommendation = monitor.getQualityRecommendation('veryBad', 'stable');
      
      expect(recommendation.profile).toBe('minimal');
      expect(recommendation.action).toBe('emergency_reduce');
    });
  });

  describe('Event Handling', () => {
    test('handles network quality events', () => {
      const stats = {
        uplinkNetworkQuality: 4,
        downlinkNetworkQuality: 3,
      };
      
      monitor.handleNetworkQuality(stats);
      
      expect(monitor.currentMetrics.uplinkQuality).toBe(4);
      expect(monitor.currentMetrics.downlinkQuality).toBe(3);
    });

    test('handles connection state changes', () => {
      const mockCallback = jest.fn();
      monitor.on('connection-change', mockCallback);
      
      monitor.handleConnectionChange('DISCONNECTED', 'NETWORK_ERROR');
      
      expect(mockCallback).toHaveBeenCalledWith({
        state: 'DISCONNECTED',
        reason: 'NETWORK_ERROR',
        timestamp: expect.any(Number),
      });
    });

    test('resets metrics on disconnection', () => {
      monitor.currentMetrics = {
        rtt: 100,
        packetLoss: 2,
        uplinkQuality: 5,
        downlinkQuality: 4,
        bandwidth: 1000,
        timestamp: Date.now(),
      };
      
      monitor.handleConnectionChange('DISCONNECTED', 'NETWORK_ERROR');
      
      expect(monitor.currentMetrics.uplinkQuality).toBe(1);
      expect(monitor.currentMetrics.downlinkQuality).toBe(1);
      expect(monitor.currentMetrics.rtt).toBe(0);
    });
  });

  describe('Stability Detection', () => {
    test('detects stable quality', () => {
      const baseTime = Date.now();
      // Create 10 readings with consistent quality
      monitor.qualityHistory = Array.from({ length: 10 }, (_, i) => ({
        rtt: 100 + (i % 2) * 10, // Small variations
        packetLoss: 1 + (i % 2) * 0.5,
        uplinkQuality: 5,
        downlinkQuality: 5,
        timestamp: baseTime - (10 - i) * 1000,
      }));
      
      const isStable = monitor.isQualityStable();
      expect(isStable).toBe(true);
    });

    test('detects unstable quality', () => {
      const baseTime = Date.now();
      // Create readings with varying quality levels
      monitor.qualityHistory = [
        { rtt: 50, packetLoss: 0.5, uplinkQuality: 6, downlinkQuality: 6, timestamp: baseTime - 9000 },
        { rtt: 200, packetLoss: 3, uplinkQuality: 4, downlinkQuality: 4, timestamp: baseTime - 8000 },
        { rtt: 400, packetLoss: 8, uplinkQuality: 2, downlinkQuality: 2, timestamp: baseTime - 7000 },
        { rtt: 100, packetLoss: 1, uplinkQuality: 5, downlinkQuality: 5, timestamp: baseTime - 6000 },
        { rtt: 300, packetLoss: 5, uplinkQuality: 3, downlinkQuality: 3, timestamp: baseTime - 5000 },
        { rtt: 150, packetLoss: 2, uplinkQuality: 4, downlinkQuality: 4, timestamp: baseTime - 4000 },
        { rtt: 500, packetLoss: 10, uplinkQuality: 2, downlinkQuality: 2, timestamp: baseTime - 3000 },
        { rtt: 80, packetLoss: 0.8, uplinkQuality: 6, downlinkQuality: 6, timestamp: baseTime - 2000 },
        { rtt: 350, packetLoss: 6, uplinkQuality: 3, downlinkQuality: 3, timestamp: baseTime - 1000 },
        { rtt: 120, packetLoss: 1.5, uplinkQuality: 4, downlinkQuality: 4, timestamp: baseTime },
      ];
      
      const isStable = monitor.isQualityStable();
      expect(isStable).toBe(false);
    });
  });

  describe('Event Listeners', () => {
    test('adds and removes event listeners', () => {
      const callback = jest.fn();
      
      monitor.on('quality-change', callback);
      monitor.notifyListeners('quality-change', { test: 'data' });
      
      expect(callback).toHaveBeenCalledWith({ test: 'data' });
      
      monitor.off('quality-change', callback);
      monitor.notifyListeners('quality-change', { test: 'data2' });
      
      expect(callback).toHaveBeenCalledTimes(1);
    });

    test('handles listener errors gracefully', () => {
      const errorCallback = jest.fn(() => {
        throw new Error('Listener error');
      });
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      monitor.on('test-event', errorCallback);
      monitor.notifyListeners('test-event', {});
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error in network quality listener'),
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('Quality Summary', () => {
    test('provides comprehensive quality summary', () => {
      monitor.currentMetrics = {
        rtt: 100,
        packetLoss: 1.5,
        uplinkQuality: 5,
        downlinkQuality: 4,
        bandwidth: 1200,
        timestamp: Date.now(),
      };
      
      const summary = monitor.getQualitySummary();
      
      expect(summary).toMatchObject({
        metrics: expect.objectContaining({
          rtt: 100,
          packetLoss: 1.5,
        }),
        qualityLevel: expect.any(String),
        trend: expect.any(String),
        isStable: expect.any(Boolean),
        recommendation: expect.objectContaining({
          profile: expect.any(String),
          action: expect.any(String),
        }),
        history: expect.any(Array),
      });
    });
  });

  describe('Average Metrics', () => {
    test('calculates average metrics over time window', () => {
      const baseTime = Date.now();
      monitor.qualityHistory = [
        { rtt: 100, packetLoss: 1, uplinkQuality: 5, downlinkQuality: 4, bandwidth: 1000, timestamp: baseTime - 20000 },
        { rtt: 200, packetLoss: 2, uplinkQuality: 4, downlinkQuality: 3, bandwidth: 800, timestamp: baseTime - 15000 },
        { rtt: 150, packetLoss: 1.5, uplinkQuality: 4, downlinkQuality: 4, bandwidth: 900, timestamp: baseTime - 10000 },
      ];
      
      const avgMetrics = monitor.getAverageMetrics(25000);
      
      expect(avgMetrics.rtt).toBe(150);
      expect(avgMetrics.packetLoss).toBe(1.5);
      expect(avgMetrics.uplinkQuality).toBe(4);
      expect(avgMetrics.bandwidth).toBe(900);
    });

    test('returns current metrics when no history available', () => {
      monitor.currentMetrics = {
        rtt: 50,
        packetLoss: 0.5,
        uplinkQuality: 6,
        downlinkQuality: 6,
        bandwidth: 1500,
        timestamp: Date.now(),
      };
      
      const avgMetrics = monitor.getAverageMetrics(30000);
      
      expect(avgMetrics).toEqual(monitor.currentMetrics);
    });
  });

  describe('Data Export', () => {
    test('exports monitoring data correctly', () => {
      monitor.currentMetrics = { rtt: 100, timestamp: Date.now() };
      monitor.qualityHistory = [{ rtt: 90, timestamp: Date.now() - 1000 }];
      
      const exportData = monitor.exportData();
      
      expect(exportData).toMatchObject({
        currentMetrics: expect.any(Object),
        qualityHistory: expect.any(Array),
        qualitySummary: expect.any(Object),
        options: expect.any(Object),
      });
    });
  });
});