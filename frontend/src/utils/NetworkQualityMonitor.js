/**
 * Network Quality Monitor
 * 
 * Monitors network conditions and provides real-time quality metrics
 * for adaptive video streaming.
 */

class NetworkQualityMonitor {
  constructor(agoraClient, options = {}) {
    this.client = agoraClient;
    this.options = {
      monitorInterval: options.monitorInterval || 2000, // 2 seconds
      qualityThresholds: {
        excellent: { rtt: 50, packetLoss: 0.5, quality: 6 },
        good: { rtt: 100, packetLoss: 1.0, quality: 5 },
        fair: { rtt: 200, packetLoss: 2.0, quality: 4 },
        poor: { rtt: 300, packetLoss: 5.0, quality: 3 },
        bad: { rtt: 500, packetLoss: 10.0, quality: 2 },
        veryBad: { rtt: 1000, packetLoss: 20.0, quality: 1 }
      },
      ...options
    };

    this.currentMetrics = {
      rtt: 0,
      packetLoss: 0,
      uplinkQuality: 6,
      downlinkQuality: 6,
      bandwidth: 0,
      timestamp: Date.now()
    };

    this.qualityHistory = [];
    this.listeners = new Set();
    this.monitoringInterval = null;
    this.isMonitoring = false;
  }

  /**
   * Start monitoring network quality
   */
  start() {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
    }, this.options.monitorInterval);

    // Listen to Agora network quality events
    this.client.on('network-quality', this.handleNetworkQuality.bind(this));
    this.client.on('connection-state-change', this.handleConnectionChange.bind(this));

    console.log('📡 Network Quality Monitor started');
  }

  /**
   * Stop monitoring
   */
  stop() {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    this.client.off('network-quality', this.handleNetworkQuality.bind(this));
    this.client.off('connection-state-change', this.handleConnectionChange.bind(this));

    console.log('📡 Network Quality Monitor stopped');
  }

  /**
   * Collect comprehensive network metrics
   */
  async collectMetrics() {
    try {
      const stats = await this.client.getStats();
      const localVideoStats = await this.client.getLocalVideoStats();
      const localAudioStats = await this.client.getLocalAudioStats();

      const newMetrics = {
        rtt: stats.RTT || 0,
        packetLoss: this.calculatePacketLoss(localVideoStats, localAudioStats),
        uplinkQuality: stats.uplinkNetworkQuality || 6,
        downlinkQuality: stats.downlinkNetworkQuality || 6,
        bandwidth: this.estimateBandwidth(localVideoStats),
        videoSendBitrate: localVideoStats?.sendBitrate || 0,
        videoSendPacketsLost: localVideoStats?.sendPacketsLost || 0,
        audioSendBitrate: localAudioStats?.sendBitrate || 0,
        timestamp: Date.now()
      };

      this.updateMetrics(newMetrics);
    } catch (error) {
      console.warn('Failed to collect network metrics:', error);
    }
  }

  /**
   * Calculate packet loss percentage
   */
  calculatePacketLoss(videoStats, audioStats) {
    const videoLoss = videoStats?.sendPacketsLost || 0;
    const audioLoss = audioStats?.sendPacketsLost || 0;
    const videoTotal = videoStats?.sendPackets || 1;
    const audioTotal = audioStats?.sendPackets || 1;

    const totalLoss = videoLoss + audioLoss;
    const totalPackets = videoTotal + audioTotal;

    return totalPackets > 0 ? (totalLoss / totalPackets) * 100 : 0;
  }

  /**
   * Estimate available bandwidth
   */
  estimateBandwidth(videoStats) {
    if (!videoStats) return 0;
    
    // Simple estimation based on current bitrate and quality
    const currentBitrate = videoStats.sendBitrate || 0;
    const targetBitrate = videoStats.targetBitrate || currentBitrate;
    
    // If we're achieving close to target bitrate, bandwidth is sufficient
    const efficiency = targetBitrate > 0 ? currentBitrate / targetBitrate : 1;
    
    return Math.floor(currentBitrate / efficiency);
  }

  /**
   * Update current metrics and notify listeners
   */
  updateMetrics(newMetrics) {
    const previousMetrics = { ...this.currentMetrics };
    this.currentMetrics = newMetrics;

    // Add to history (keep last 30 readings)
    this.qualityHistory.push(newMetrics);
    if (this.qualityHistory.length > 30) {
      this.qualityHistory.shift();
    }

    // Determine quality level
    const qualityLevel = this.determineQualityLevel(newMetrics);
    const trend = this.calculateTrend();

    const qualityInfo = {
      ...newMetrics,
      qualityLevel,
      trend,
      isStable: this.isQualityStable(),
      recommendation: this.getQualityRecommendation(qualityLevel, trend)
    };

    // Notify listeners
    this.notifyListeners('quality-change', qualityInfo);

    // Check for significant quality changes
    const previousLevel = this.determineQualityLevel(previousMetrics);
    if (qualityLevel !== previousLevel) {
      this.notifyListeners('quality-level-change', {
        from: previousLevel,
        to: qualityLevel,
        metrics: qualityInfo
      });
    }
  }

  /**
   * Determine quality level based on metrics
   */
  determineQualityLevel(metrics) {
    const { rtt, packetLoss, uplinkQuality, downlinkQuality } = metrics;
    const avgNetworkQuality = (uplinkQuality + downlinkQuality) / 2;

    // Use a weighted scoring system
    let score = 0;

    // RTT scoring (40% weight)
    if (rtt <= this.options.qualityThresholds.excellent.rtt) score += 40;
    else if (rtt <= this.options.qualityThresholds.good.rtt) score += 32;
    else if (rtt <= this.options.qualityThresholds.fair.rtt) score += 24;
    else if (rtt <= this.options.qualityThresholds.poor.rtt) score += 16;
    else if (rtt <= this.options.qualityThresholds.bad.rtt) score += 8;
    else score += 0;

    // Packet loss scoring (30% weight)
    if (packetLoss <= this.options.qualityThresholds.excellent.packetLoss) score += 30;
    else if (packetLoss <= this.options.qualityThresholds.good.packetLoss) score += 24;
    else if (packetLoss <= this.options.qualityThresholds.fair.packetLoss) score += 18;
    else if (packetLoss <= this.options.qualityThresholds.poor.packetLoss) score += 12;
    else if (packetLoss <= this.options.qualityThresholds.bad.packetLoss) score += 6;
    else score += 0;

    // Network quality scoring (30% weight)
    score += (avgNetworkQuality / 6) * 30;

    // Determine level based on total score
    if (score >= 90) return 'excellent';
    if (score >= 75) return 'good';
    if (score >= 60) return 'fair';
    if (score >= 45) return 'poor';
    if (score >= 30) return 'bad';
    return 'veryBad';
  }

  /**
   * Calculate quality trend over recent history
   */
  calculateTrend() {
    if (this.qualityHistory.length < 5) {
      return 'stable';
    }

    const recent = this.qualityHistory.slice(-5);
    const scores = recent.map(metrics => {
      const level = this.determineQualityLevel(metrics);
      const levels = ['veryBad', 'bad', 'poor', 'fair', 'good', 'excellent'];
      return levels.indexOf(level);
    });

    const firstScore = scores[0];
    const lastScore = scores[scores.length - 1];
    const diff = lastScore - firstScore;

    if (diff > 1) return 'improving';
    if (diff < -1) return 'degrading';
    return 'stable';
  }

  /**
   * Check if quality has been stable recently
   */
  isQualityStable() {
    if (this.qualityHistory.length < 10) {
      return false;
    }

    const recent = this.qualityHistory.slice(-10);
    const levels = recent.map(m => this.determineQualityLevel(m));
    const uniqueLevels = new Set(levels);

    // Stable if quality hasn't changed much in recent readings
    return uniqueLevels.size <= 2;
  }

  /**
   * Get quality recommendation based on current conditions
   */
  getQualityRecommendation(qualityLevel, trend) {
    const recommendations = {
      excellent: { profile: '2k', action: 'maintain' },
      good: { profile: '2k', action: 'maintain' },
      fair: { profile: 'ultra', action: 'reduce' },
      poor: { profile: 'high', action: 'reduce' },
      bad: { profile: 'medium', action: 'reduce_aggressive' },
      veryBad: { profile: 'low', action: 'emergency_reduce' }
    };

    const baseRecommendation = recommendations[qualityLevel] || recommendations.poor;

    // Adjust based on trend
    if (trend === 'improving' && ['poor', 'bad'].includes(qualityLevel)) {
      return { ...baseRecommendation, action: 'wait' };
    }

    if (trend === 'degrading') {
      const profiles = ['minimal', 'low', 'medium', 'high', 'ultra', '2k'];
      const currentIndex = profiles.indexOf(baseRecommendation.profile);
      const lowerProfile = profiles[Math.max(0, currentIndex - 1)];
      
      return { 
        profile: lowerProfile, 
        action: 'reduce_preemptive' 
      };
    }

    return baseRecommendation;
  }

  /**
   * Handle Agora network quality events
   */
  handleNetworkQuality(stats) {
    this.updateMetrics({
      ...this.currentMetrics,
      uplinkQuality: stats.uplinkNetworkQuality,
      downlinkQuality: stats.downlinkNetworkQuality,
      timestamp: Date.now()
    });
  }

  /**
   * Handle connection state changes
   */
  handleConnectionChange(newState, reason) {
    console.log(`📡 Connection state changed: ${newState} (${reason})`);
    
    this.notifyListeners('connection-change', {
      state: newState,
      reason,
      timestamp: Date.now()
    });

    // Reset metrics on disconnection
    if (newState === 'DISCONNECTED') {
      this.currentMetrics = {
        rtt: 0,
        packetLoss: 0,
        uplinkQuality: 1,
        downlinkQuality: 1,
        bandwidth: 0,
        timestamp: Date.now()
      };
    }
  }

  /**
   * Add event listener
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
  }

  /**
   * Remove event listener
   */
  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  /**
   * Notify all listeners of an event
   */
  notifyListeners(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in network quality listener:`, error);
        }
      });
    }
  }

  /**
   * Get current quality summary
   */
  getQualitySummary() {
    const qualityLevel = this.determineQualityLevel(this.currentMetrics);
    const trend = this.calculateTrend();
    const recommendation = this.getQualityRecommendation(qualityLevel, trend);

    return {
      metrics: this.currentMetrics,
      qualityLevel,
      trend,
      isStable: this.isQualityStable(),
      recommendation,
      history: this.qualityHistory.slice(-10) // Last 10 readings
    };
  }

  /**
   * Get average metrics over a time period
   */
  getAverageMetrics(timeWindowMs = 30000) {
    const cutoffTime = Date.now() - timeWindowMs;
    const recentMetrics = this.qualityHistory.filter(m => m.timestamp > cutoffTime);

    if (recentMetrics.length === 0) {
      return this.currentMetrics;
    }

    const sum = recentMetrics.reduce((acc, metrics) => ({
      rtt: acc.rtt + metrics.rtt,
      packetLoss: acc.packetLoss + metrics.packetLoss,
      uplinkQuality: acc.uplinkQuality + metrics.uplinkQuality,
      downlinkQuality: acc.downlinkQuality + metrics.downlinkQuality,
      bandwidth: acc.bandwidth + metrics.bandwidth
    }), { rtt: 0, packetLoss: 0, uplinkQuality: 0, downlinkQuality: 0, bandwidth: 0 });

    const count = recentMetrics.length;
    return {
      rtt: Math.round(sum.rtt / count),
      packetLoss: parseFloat((sum.packetLoss / count).toFixed(2)),
      uplinkQuality: Math.round(sum.uplinkQuality / count),
      downlinkQuality: Math.round(sum.downlinkQuality / count),
      bandwidth: Math.round(sum.bandwidth / count),
      timestamp: Date.now()
    };
  }

  /**
   * Export monitoring data for analysis
   */
  exportData() {
    return {
      currentMetrics: this.currentMetrics,
      qualityHistory: this.qualityHistory,
      qualitySummary: this.getQualitySummary(),
      options: this.options
    };
  }
}

export default NetworkQualityMonitor;