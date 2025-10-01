import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PlayIcon,
  PauseIcon,
  StopIcon,
  VideoCameraIcon,
  CloudArrowUpIcon,
  ClockIcon,
  DocumentDuplicateIcon,
  ShareIcon,
  TrashIcon,
  EyeIcon,
  ArrowDownTrayIcon,
  Cog6ToothIcon
} from '@heroicons/react/24/outline';
import { PlayIcon as PlayIconSolid } from '@heroicons/react/24/solid';

const StreamRecordingManager = ({
  websocket,
  channelId,
  sessionId,
  isCreator = false,
  user,
  agoraClient
}) => {
  const [recordings, setRecordings] = useState([]);
  const [currentRecording, setCurrentRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingSettings, setRecordingSettings] = useState({
    quality: '720p',
    format: 'mp4',
    includeChat: true,
    includePolls: true,
    autoUpload: true,
    maxDuration: 7200 // 2 hours
  });
  const [selectedRecording, setSelectedRecording] = useState(null);
  const [showPlayer, setShowPlayer] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(new Map());
  const [playbackState, setPlaybackState] = useState({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 1
  });

  const recordingTimerRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const playerRef = useRef(null);

  useEffect(() => {
    if (websocket) {
      setupWebSocketListeners();
    }
    
    fetchRecordings();
  }, [websocket, sessionId]);

  useEffect(() => {
    return () => {
      stopRecording();
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, []);

  const setupWebSocketListeners = () => {
    websocket.addEventListener('message', handleWebSocketMessage);
  };

  const handleWebSocketMessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'recording_started':
          if (data.sessionId === sessionId) {
            handleRecordingStarted(data);
          }
          break;
        case 'recording_stopped':
          if (data.sessionId === sessionId) {
            handleRecordingStopped(data);
          }
          break;
        case 'recording_uploaded':
          if (data.sessionId === sessionId) {
            handleRecordingUploaded(data);
          }
          break;
        case 'recording_shared':
          if (data.sessionId === sessionId) {
            handleRecordingShared(data);
          }
          break;
        default:
          break;
      }
    } catch (error) {
      console.error('Error parsing recording WebSocket message:', error);
    }
  };

  const handleRecordingStarted = (data) => {
    setCurrentRecording(data.recording);
    setIsRecording(true);
    setRecordingDuration(0);
    
    // Start duration timer
    recordingTimerRef.current = setInterval(() => {
      setRecordingDuration(prev => {
        const newDuration = prev + 1;
        
        // Auto-stop at max duration
        if (newDuration >= recordingSettings.maxDuration) {
          stopRecording();
        }
        
        return newDuration;
      });
    }, 1000);
  };

  const handleRecordingStopped = (data) => {
    setIsRecording(false);
    setCurrentRecording(null);
    
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
    }
    
    // Add to recordings list
    setRecordings(prev => [data.recording, ...prev]);
  };

  const handleRecordingUploaded = (data) => {
    setRecordings(prev => prev.map(recording => 
      recording.id === data.recordingId 
        ? { ...recording, status: 'uploaded', downloadUrl: data.downloadUrl }
        : recording
    ));
    
    // Clear upload progress
    setUploadProgress(prev => {
      const updated = new Map(prev);
      updated.delete(data.recordingId);
      return updated;
    });
  };

  const handleRecordingShared = (data) => {
    setRecordings(prev => prev.map(recording => 
      recording.id === data.recordingId 
        ? { ...recording, isPublic: data.isPublic, shareUrl: data.shareUrl }
        : recording
    ));
  };

  const startRecording = async () => {
    if (!isCreator) {
      console.warn('Only creators can start recordings');
      return;
    }

    try {
      // Start server-side recording via WebSocket
      const recordingData = {
        type: 'start_recording',
        sessionId,
        channelId,
        settings: recordingSettings
      };

      websocket.send(JSON.stringify(recordingData));

      // Start local recording for backup/preview
      await startLocalRecording();

      console.log('✅ Recording started');
    } catch (error) {
      console.error('❌ Error starting recording:', error);
    }
  };

  const stopRecording = async () => {
    try {
      // Stop server-side recording
      const stopData = {
        type: 'stop_recording',
        sessionId,
        channelId
      };

      websocket.send(JSON.stringify(stopData));

      // Stop local recording
      await stopLocalRecording();

      console.log('✅ Recording stopped');
    } catch (error) {
      console.error('❌ Error stopping recording:', error);
    }
  };

  const startLocalRecording = async () => {
    try {
      // Get canvas stream from Agora
      const stream = await getAgoraCanvasStream();
      
      recordedChunksRef.current = [];
      
      const options = {
        mimeType: 'video/webm;codecs=vp8,opus',
        videoBitsPerSecond: getVideoBitrate()
      };

      mediaRecorderRef.current = new MediaRecorder(stream, options);

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        // Create blob from recorded chunks
        const recordedBlob = new Blob(recordedChunksRef.current, {
          type: 'video/webm'
        });
        
        // Auto-upload if enabled
        if (recordingSettings.autoUpload) {
          uploadRecording(recordedBlob);
        }
      };

      mediaRecorderRef.current.start(1000); // Collect data every second
    } catch (error) {
      console.error('Error starting local recording:', error);
    }
  };

  const stopLocalRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const getAgoraCanvasStream = async () => {
    // In a real implementation, you'd capture the Agora video stream
    // This is a simplified version using display capture
    return await navigator.mediaDevices.getDisplayMedia({
      video: {
        width: recordingSettings.quality === '1080p' ? 1920 : 1280,
        height: recordingSettings.quality === '1080p' ? 1080 : 720,
        frameRate: 30
      },
      audio: true
    });
  };

  const getVideoBitrate = () => {
    switch (recordingSettings.quality) {
      case '1080p': return 5000000; // 5 Mbps
      case '720p': return 2500000;  // 2.5 Mbps
      case '480p': return 1000000;  // 1 Mbps
      default: return 2500000;
    }
  };

  const uploadRecording = async (blob) => {
    try {
      const formData = new FormData();
      formData.append('recording', blob, `recording_${Date.now()}.webm`);
      formData.append('sessionId', sessionId);
      formData.append('channelId', channelId);
      formData.append('settings', JSON.stringify(recordingSettings));

      // Mock upload with progress
      const recordingId = `upload_${Date.now()}`;
      
      // Simulate upload progress
      let progress = 0;
      const progressInterval = setInterval(() => {
        progress += Math.random() * 15;
        if (progress >= 100) {
          progress = 100;
          clearInterval(progressInterval);
          
          // Simulate upload completion
          setTimeout(() => {
            handleRecordingUploaded({
              recordingId,
              downloadUrl: URL.createObjectURL(blob)
            });
          }, 500);
        }
        
        setUploadProgress(prev => {
          const updated = new Map(prev);
          updated.set(recordingId, progress);
          return updated;
        });
      }, 200);

    } catch (error) {
      console.error('Error uploading recording:', error);
    }
  };

  const fetchRecordings = async () => {
    try {
      // Mock recordings data
      const mockRecordings = [
        {
          id: 'rec_1',
          title: 'Live Stream Session',
          duration: 3600,
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          status: 'uploaded',
          quality: '720p',
          size: '450 MB',
          downloadUrl: '#',
          thumbnailUrl: '#',
          views: 234,
          isPublic: false
        },
        {
          id: 'rec_2',
          title: 'Creator Q&A Session',
          duration: 1800,
          createdAt: new Date(Date.now() - 172800000).toISOString(),
          status: 'uploaded',
          quality: '1080p',
          size: '680 MB',
          downloadUrl: '#',
          thumbnailUrl: '#',
          views: 156,
          isPublic: true,
          shareUrl: 'https://digis.com/share/rec_2'
        }
      ];
      
      setRecordings(mockRecordings);
    } catch (error) {
      console.error('Error fetching recordings:', error);
    }
  };

  const playRecording = (recording) => {
    setSelectedRecording(recording);
    setShowPlayer(true);
    setPlaybackState(prev => ({
      ...prev,
      isPlaying: false,
      currentTime: 0,
      duration: recording.duration
    }));
  };

  const togglePlayback = () => {
    if (playerRef.current) {
      if (playbackState.isPlaying) {
        playerRef.current.pause();
      } else {
        playerRef.current.play();
      }
      
      setPlaybackState(prev => ({
        ...prev,
        isPlaying: !prev.isPlaying
      }));
    }
  };

  const seekTo = (time) => {
    if (playerRef.current) {
      playerRef.current.currentTime = time;
      setPlaybackState(prev => ({
        ...prev,
        currentTime: time
      }));
    }
  };

  const shareRecording = async (recordingId) => {
    const shareData = {
      type: 'share_recording',
      recordingId,
      isPublic: true
    };

    websocket.send(JSON.stringify(shareData));
  };

  const deleteRecording = async (recordingId) => {
    if (confirm('Are you sure you want to delete this recording?')) {
      setRecordings(prev => prev.filter(rec => rec.id !== recordingId));
      
      // In a real implementation, send delete request to server
      console.log('🗑️ Recording deleted:', recordingId);
    }
  };

  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes) => {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'recording': return 'text-red-500';
      case 'processing': return 'text-yellow-500';
      case 'uploaded': return 'text-green-500';
      case 'failed': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  return (
    <motion.div
      className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-red-600 to-pink-600 text-white p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <VideoCameraIcon className="w-6 h-6" />
            <div>
              <h3 className="font-bold text-lg">Stream Recording</h3>
              <p className="text-white/80 text-sm">
                {isCreator ? 'Manage your recordings' : 'View stream recordings'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {isCreator && (
              <>
                <motion.button
                  onClick={() => setShowSettings(true)}
                  className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-all"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Cog6ToothIcon className="w-5 h-5" />
                </motion.button>
                
                {!isRecording ? (
                  <motion.button
                    onClick={startRecording}
                    className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-all"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <div className="w-3 h-3 bg-red-500 rounded-full" />
                    <span className="hidden sm:inline">Start Recording</span>
                  </motion.button>
                ) : (
                  <motion.button
                    onClick={stopRecording}
                    className="flex items-center gap-2 bg-red-500 hover:bg-red-600 px-4 py-2 rounded-lg transition-all"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <StopIcon className="w-5 h-5" />
                    <span className="hidden sm:inline">Stop ({formatDuration(recordingDuration)})</span>
                  </motion.button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Current Recording Status */}
        {isRecording && currentRecording && (
          <motion.div 
            className="mt-3 bg-white/20 rounded-lg p-3"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
          >
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
                <span>Recording in progress</span>
              </div>
              <div className="flex items-center gap-4">
                <span>Duration: {formatDuration(recordingDuration)}</span>
                <span>Quality: {recordingSettings.quality}</span>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Recordings List */}
      <div className="p-4">
        {recordings.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <VideoCameraIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-lg font-medium mb-1">No recordings yet</p>
            <p className="text-sm">
              {isCreator 
                ? 'Start recording your live streams to build a content library'
                : 'Recordings from this creator will appear here'
              }
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {recordings.map((recording) => (
              <motion.div
                key={recording.id}
                className="border border-gray-200 rounded-xl p-4 hover:border-gray-300 transition-all"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                layout
              >
                <div className="flex items-start gap-4">
                  {/* Thumbnail */}
                  <div className="w-24 h-16 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0 relative group cursor-pointer"
                       onClick={() => playRecording(recording)}>
                    {recording.thumbnailUrl ? (
                      <img 
                        src={recording.thumbnailUrl} 
                        alt={recording.title}
                        className="w-full h-full object-cover rounded-lg"
                      />
                    ) : (
                      <VideoCameraIcon className="w-8 h-8 text-gray-400" />
                    )}
                    
                    {/* Play Overlay */}
                    <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <PlayIconSolid className="w-6 h-6 text-white" />
                    </div>
                    
                    {/* Duration Badge */}
                    <div className="absolute bottom-1 right-1 bg-black/70 text-white px-1 py-0.5 rounded text-xs">
                      {formatDuration(recording.duration)}
                    </div>
                  </div>

                  {/* Recording Info */}
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium text-gray-900 mb-1">
                          {recording.title}
                        </h4>
                        
                        <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
                          <div className="flex items-center gap-1">
                            <ClockIcon className="w-4 h-4" />
                            <span>{new Date(recording.createdAt).toLocaleDateString()}</span>
                          </div>
                          
                          <div className="flex items-center gap-1">
                            <EyeIcon className="w-4 h-4" />
                            <span>{recording.views} views</span>
                          </div>
                          
                          <span className="text-gray-400">•</span>
                          <span>{recording.quality}</span>
                          <span className="text-gray-400">•</span>
                          <span>{recording.size}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            recording.status === 'uploaded' 
                              ? 'bg-green-100 text-green-800'
                              : recording.status === 'processing'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {recording.status}
                          </span>
                          
                          {recording.isPublic && (
                            <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded-full">
                              Public
                            </span>
                          )}
                          
                          {uploadProgress.has(recording.id) && (
                            <div className="flex items-center gap-2">
                              <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-blue-500 transition-all duration-300"
                                  style={{ width: `${uploadProgress.get(recording.id)}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-600">
                                {Math.round(uploadProgress.get(recording.id))}%
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <motion.button
                          onClick={() => playRecording(recording)}
                          className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          title="Play Recording"
                        >
                          <PlayIcon className="w-5 h-5" />
                        </motion.button>

                        {recording.downloadUrl && (
                          <motion.a
                            href={recording.downloadUrl}
                            download
                            className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-all"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            title="Download Recording"
                          >
                            <ArrowDownTrayIcon className="w-5 h-5" />
                          </motion.a>
                        )}

                        {isCreator && (
                          <>
                            <motion.button
                              onClick={() => shareRecording(recording.id)}
                              className="p-2 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-all"
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              title="Share Recording"
                            >
                              <ShareIcon className="w-5 h-5" />
                            </motion.button>

                            <motion.button
                              onClick={() => deleteRecording(recording.id)}
                              className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              title="Delete Recording"
                            >
                              <TrashIcon className="w-5 h-5" />
                            </motion.button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Video Player Modal */}
      <AnimatePresence>
        {showPlayer && selectedRecording && (
          <motion.div
            className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-black rounded-2xl overflow-hidden w-full max-w-4xl max-h-full"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
            >
              {/* Player Header */}
              <div className="bg-gray-900 text-white p-4 flex items-center justify-between">
                <h3 className="font-medium">{selectedRecording.title}</h3>
                <button
                  onClick={() => setShowPlayer(false)}
                  className="text-gray-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              {/* Video Player */}
              <div className="relative">
                <video
                  ref={playerRef}
                  className="w-full h-auto max-h-96"
                  controls
                  onTimeUpdate={(e) => {
                    setPlaybackState(prev => ({
                      ...prev,
                      currentTime: e.target.currentTime
                    }));
                  }}
                  onLoadedMetadata={(e) => {
                    setPlaybackState(prev => ({
                      ...prev,
                      duration: e.target.duration
                    }));
                  }}
                >
                  {/* In a real implementation, you'd have the actual video source */}
                  <source src={selectedRecording.downloadUrl} type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
              </div>

              {/* Player Controls */}
              <div className="bg-gray-900 text-white p-4">
                <div className="flex items-center gap-4">
                  <button
                    onClick={togglePlayback}
                    className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-all"
                  >
                    {playbackState.isPlaying ? (
                      <PauseIcon className="w-5 h-5" />
                    ) : (
                      <PlayIcon className="w-5 h-5" />
                    )}
                  </button>

                  <div className="flex-1">
                    <div className="flex items-center gap-2 text-sm">
                      <span>{formatDuration(Math.floor(playbackState.currentTime))}</span>
                      <div className="flex-1 h-1 bg-gray-600 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-red-500 transition-all"
                          style={{ 
                            width: `${(playbackState.currentTime / playbackState.duration) * 100}%` 
                          }}
                        />
                      </div>
                      <span>{formatDuration(Math.floor(playbackState.duration))}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-400">
                      {selectedRecording.views} views
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recording Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white rounded-2xl p-6 w-full max-w-md"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">Recording Settings</h3>
                <button
                  onClick={() => setShowSettings(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                {/* Quality */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Recording Quality
                  </label>
                  <select
                    value={recordingSettings.quality}
                    onChange={(e) => setRecordingSettings(prev => ({ ...prev, quality: e.target.value }))}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  >
                    <option value="480p">480p (Smaller file)</option>
                    <option value="720p">720p (Recommended)</option>
                    <option value="1080p">1080p (Best quality)</option>
                  </select>
                </div>

                {/* Format */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Format
                  </label>
                  <select
                    value={recordingSettings.format}
                    onChange={(e) => setRecordingSettings(prev => ({ ...prev, format: e.target.value }))}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  >
                    <option value="mp4">MP4 (Recommended)</option>
                    <option value="webm">WebM</option>
                    <option value="mov">MOV</option>
                  </select>
                </div>

                {/* Max Duration */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Max Duration (minutes)
                  </label>
                  <select
                    value={recordingSettings.maxDuration / 60}
                    onChange={(e) => setRecordingSettings(prev => ({ 
                      ...prev, 
                      maxDuration: parseInt(e.target.value) * 60 
                    }))}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  >
                    <option value={30}>30 minutes</option>
                    <option value={60}>1 hour</option>
                    <option value={120}>2 hours</option>
                    <option value={240}>4 hours</option>
                  </select>
                </div>

                {/* Include Chat */}
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">
                    Include Chat Messages
                  </label>
                  <button
                    onClick={() => setRecordingSettings(prev => ({ 
                      ...prev, 
                      includeChat: !prev.includeChat 
                    }))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      recordingSettings.includeChat ? 'bg-red-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        recordingSettings.includeChat ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Auto Upload */}
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">
                    Auto Upload to Cloud
                  </label>
                  <button
                    onClick={() => setRecordingSettings(prev => ({ 
                      ...prev, 
                      autoUpload: !prev.autoUpload 
                    }))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      recordingSettings.autoUpload ? 'bg-red-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        recordingSettings.autoUpload ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowSettings(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setShowSettings(false)}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all"
                >
                  Save Settings
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default StreamRecordingManager;