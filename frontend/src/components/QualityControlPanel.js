import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CogIcon,
  SignalIcon,
  WifiIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon
} from '@heroicons/react/24/outline';

const QualityControlPanel = ({ 
  qualityController, 
  isVisible = false, 
  onToggle,
  className = '' 
}) => {
  const [qualityStatus, setQualityStatus] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [networkMetrics, setNetworkMetrics] = useState({});
  const [adaptationHistory, setAdaptationHistory] = useState([]);

  // Update quality status
  const updateQualityStatus = useCallback(() => {
    if (!qualityController) return;
    
    const status = qualityController.getQualityStatus();
    setQualityStatus(status);
    setNetworkMetrics(status.networkMetrics);
  }, [qualityController]);

  useEffect(() => {
    if (!qualityController) return;

    // Initial status
    updateQualityStatus();

    // Listen for quality changes
    const handleQualityAdapted = (data) => {
      setAdaptationHistory(prev => [...prev.slice(-9), {
        timestamp: Date.now(),
        from: data.fromProfile,
        to: data.toProfile,
        reason: data.reason,
        networkQuality: data.networkQuality
      }]);
      updateQualityStatus();
    };

    const handleNetworkChange = (data) => {
      setNetworkMetrics(data.metrics);
    };

    const handleProfileApplied = () => {
      updateQualityStatus();
    };

    qualityController.on('quality-adapted', handleQualityAdapted);
    qualityController.on('network-quality-change', handleNetworkChange);
    qualityController.on('profile-applied', handleProfileApplied);

    // Update interval
    const interval = setInterval(updateQualityStatus, 3000);

    return () => {
      qualityController.off('quality-adapted', handleQualityAdapted);
      qualityController.off('network-quality-change', handleNetworkChange);
      qualityController.off('profile-applied', handleProfileApplied);
      clearInterval(interval);
    };
  }, [qualityController, updateQualityStatus]);

  const getQualityIcon = (level) => {
    const icons = {
      excellent: <SignalIcon className="w-4 h-4 text-green-500" />,
      good: <SignalIcon className="w-4 h-4 text-blue-500" />,
      fair: <WifiIcon className="w-4 h-4 text-yellow-500" />,
      poor: <ExclamationTriangleIcon className="w-4 h-4 text-orange-500" />,
      bad: <ExclamationTriangleIcon className="w-4 h-4 text-red-500" />,
      veryBad: <ExclamationTriangleIcon className="w-4 h-4 text-red-600" />
    };
    return icons[level] || icons.fair;
  };

  const getQualityColor = (level) => {
    const colors = {
      excellent: 'text-green-600 bg-green-50 border-green-200',
      good: 'text-blue-600 bg-blue-50 border-blue-200',
      fair: 'text-yellow-600 bg-yellow-50 border-yellow-200',
      poor: 'text-orange-600 bg-orange-50 border-orange-200',
      bad: 'text-red-600 bg-red-50 border-red-200',
      veryBad: 'text-red-700 bg-red-100 border-red-300'
    };
    return colors[level] || colors.fair;
  };

  const getProfileBadgeColor = (profile) => {
    const colors = {
      'minimal': 'bg-red-100 text-red-800',
      'low': 'bg-orange-100 text-orange-800',
      'medium': 'bg-yellow-100 text-yellow-800',
      'high': 'bg-green-100 text-green-800',
      'ultra': 'bg-blue-100 text-blue-800',
      '2k': 'bg-purple-100 text-purple-800'
    };
    return colors[profile] || colors.medium;
  };

  const handleUserPreferenceChange = async (preference) => {
    if (qualityController) {
      await qualityController.setUserPreference(preference);
    }
  };

  const formatMetric = (value, unit) => {
    if (typeof value !== 'number') return 'N/A';
    return `${Math.round(value)}${unit}`;
  };

  if (!isVisible || !qualityStatus) {
    return (
      <motion.button
        onClick={onToggle}
        className="fixed bottom-20 right-4 bg-white dark:bg-neutral-800 rounded-full p-3 shadow-lg border border-neutral-200 dark:border-neutral-700 hover:shadow-xl transition-shadow"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <CogIcon className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
      </motion.button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 300 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 300 }}
      className={`fixed bottom-20 right-4 bg-white dark:bg-neutral-800 rounded-lg shadow-xl border border-neutral-200 dark:border-neutral-700 ${className}`}
      style={{ width: '320px', maxHeight: '80vh', overflowY: 'auto' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-neutral-700">
        <div className="flex items-center gap-2">
          <CogIcon className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
          <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">
            Quality Control
          </h3>
        </div>
        <button
          onClick={onToggle}
          className="text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
        >
          ×
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Current Quality Status */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Current Quality
            </span>
            <div className="flex items-center gap-2">
              {getQualityIcon(qualityStatus.networkQuality)}
              <span className={`px-2 py-1 rounded text-xs font-medium border ${getQualityColor(qualityStatus.networkQuality)}`}>
                {qualityStatus.currentProfile === '2k' ? '2K (1440p)' : 
                 qualityStatus.currentProfile === 'ultra' ? '1080p' :
                 qualityStatus.currentProfile === 'high' ? '720p' :
                 qualityStatus.currentProfile === 'medium' ? '480p' :
                 qualityStatus.currentProfile === 'low' ? '360p' :
                 qualityStatus.currentProfile === 'minimal' ? '180p' :
                 qualityStatus.currentProfile}
              </span>
            </div>
          </div>

          {/* Network Metrics */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-neutral-50 dark:bg-neutral-700 rounded p-2">
              <div className="text-neutral-500 dark:text-neutral-400">RTT</div>
              <div className="font-semibold">{formatMetric(networkMetrics.rtt, 'ms')}</div>
            </div>
            <div className="bg-neutral-50 dark:bg-neutral-700 rounded p-2">
              <div className="text-neutral-500 dark:text-neutral-400">Loss</div>
              <div className="font-semibold">{formatMetric(networkMetrics.packetLoss, '%')}</div>
            </div>
          </div>
        </div>

        {/* User Preference Controls */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Quality Preference
          </label>
          <select
            value={qualityStatus.userPreference}
            onChange={(e) => handleUserPreferenceChange(e.target.value)}
            className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 text-sm"
          >
            <option value="auto">Auto (Adaptive)</option>
            <option value="2k">2K (1440p)</option>
            <option value="ultra">Ultra (1080p)</option>
            <option value="high">High (720p)</option>
            <option value="medium">Medium (480p)</option>
            <option value="low">Low (240p)</option>
            <option value="minimal">Minimal (160p)</option>
          </select>
        </div>

        {/* Network Quality Indicator */}
        <div className={`p-3 rounded-lg border ${getQualityColor(qualityStatus.networkQuality)}`}>
          <div className="flex items-center gap-2 mb-2">
            {getQualityIcon(qualityStatus.networkQuality)}
            <span className="font-medium text-sm capitalize">
              {qualityStatus.networkQuality} Network Quality
            </span>
          </div>
          {qualityStatus.recommendation && (
            <p className="text-xs opacity-80">
              {qualityStatus.recommendation.action === 'maintain' && 'Quality is stable'}
              {qualityStatus.recommendation.action === 'reduce' && 'Consider reducing quality'}
              {qualityStatus.recommendation.action === 'wait' && 'Monitoring for improvements'}
              {qualityStatus.recommendation.action === 'emergency_reduce' && 'Emergency quality reduction active'}
            </p>
          )}
        </div>

        {/* Expandable Advanced Info */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center justify-between w-full py-2 text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200"
        >
          <span>Advanced Information</span>
          {isExpanded ? (
            <ChevronUpIcon className="w-4 h-4" />
          ) : (
            <ChevronDownIcon className="w-4 h-4" />
          )}
        </button>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-3"
            >
              {/* Device Info */}
              <div className="bg-neutral-50 dark:bg-neutral-700 rounded p-3">
                <h4 className="text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  Device Information
                </h4>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-neutral-500 dark:text-neutral-400">Type:</span>
                    <span className="font-medium capitalize">{qualityStatus.deviceType}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-500 dark:text-neutral-400">Adaptation:</span>
                    <span className="font-medium">
                      {qualityStatus.adaptationEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-500 dark:text-neutral-400">Adaptations:</span>
                    <span className="font-medium">{qualityStatus.adaptationCount}</span>
                  </div>
                </div>
              </div>

              {/* Detailed Network Metrics */}
              <div className="bg-neutral-50 dark:bg-neutral-700 rounded p-3">
                <h4 className="text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  Network Details
                </h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-neutral-500 dark:text-neutral-400">Uplink:</span>
                    <span className="font-medium">{networkMetrics.uplinkQuality}/6</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-500 dark:text-neutral-400">Downlink:</span>
                    <span className="font-medium">{networkMetrics.downlinkQuality}/6</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-500 dark:text-neutral-400">Bandwidth:</span>
                    <span className="font-medium">{formatMetric(networkMetrics.bandwidth, ' kbps')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-500 dark:text-neutral-400">Video Bitrate:</span>
                    <span className="font-medium">{formatMetric(networkMetrics.videoSendBitrate, ' kbps')}</span>
                  </div>
                </div>
              </div>

              {/* Recent Adaptations */}
              {adaptationHistory.length > 0 && (
                <div className="bg-neutral-50 dark:bg-neutral-700 rounded p-3">
                  <h4 className="text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                    Recent Adaptations
                  </h4>
                  <div className="space-y-1">
                    {adaptationHistory.slice(-3).reverse().map((adaptation, index) => (
                      <div key={adaptation.timestamp} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          {adaptation.reason === 'network_adaptation' ? (
                            adaptation.from > adaptation.to ? (
                              <ArrowTrendingDownIcon className="w-3 h-3 text-orange-500" />
                            ) : (
                              <ArrowTrendingUpIcon className="w-3 h-3 text-green-500" />
                            )
                          ) : (
                            <InformationCircleIcon className="w-3 h-3 text-blue-500" />
                          )}
                          <span className="text-neutral-600 dark:text-neutral-400">
                            {adaptation.from} → {adaptation.to}
                          </span>
                        </div>
                        <span className="text-neutral-500 dark:text-neutral-500">
                          {new Date(adaptation.timestamp).toLocaleTimeString().slice(0, 5)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Available Quality Profiles */}
              <div className="bg-neutral-50 dark:bg-neutral-700 rounded p-3">
                <h4 className="text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  Available Profiles
                </h4>
                <div className="flex flex-wrap gap-1">
                  {qualityStatus.availableProfiles.map(profile => (
                    <span 
                      key={profile}
                      className={`px-2 py-1 rounded text-xs font-medium ${getProfileBadgeColor(profile)}`}
                    >
                      {profile}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default QualityControlPanel;