import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PlayIcon,
  PauseIcon,
  StopIcon,
  MicrophoneIcon,
  VideoCameraIcon,
  DocumentIcon,
  TrashIcon,
  DownloadIcon,
  ShareIcon,
  LockClosedIcon,
  EyeIcon,
  CalendarIcon,
  ClockIcon,
  UserIcon
} from '@heroicons/react/24/outline';
import {
  PlayIcon as PlayIconSolid,
  PauseIcon as PauseIconSolid
} from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';
import { getAuthToken } from '../utils/auth-helpers';

const CallRecordingSystem = ({ user, isCreator = false }) => {
  const [recordings, setRecordings] = useState([]);
  const [activeRecording, setActiveRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingConsent, setRecordingConsent] = useState({});
  const [playbackState, setPlaybackState] = useState({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    recordingId: null
  });
  const [selectedRecording, setSelectedRecording] = useState(null);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all'); // all, video, voice
  
  const mediaRecorder = useRef(null);
  const recordedChunks = useRef([]);
  const audioRef = useRef(null);
  const videoRef = useRef(null);

  // Fetch recordings
  const fetchRecordings = useCallback(async () => {
    if (!user) return;

    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/users/recordings`, {
        headers: {
          'Authorization': `Bearer ${await getAuthToken()}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setRecordings(data.recordings || []);
      }
    } catch (error) {
      console.error('Error fetching recordings:', error);
      toast.error('Failed to load recordings');
    }
  }, [user]);

  // Initialize
  useEffect(() => {
    if (user) {
      fetchRecordings();
    }
  }, [user, fetchRecordings]);

  // Start recording
  const startRecording = useCallback(async (sessionId, sessionType, partnerConsent) => {
    if (!partnerConsent) {
      toast.error('Recording requires consent from both parties');
      return;
    }

    try {
      const constraints = {
        video: sessionType === 'video',
        audio: true
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      mediaRecorder.current = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp8,opus'
      });
      
      recordedChunks.current = [];

      mediaRecorder.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunks.current.push(event.data);
        }
      };

      mediaRecorder.current.onstop = async () => {
        const blob = new Blob(recordedChunks.current, {
          type: 'video/webm'
        });

        // Upload recording
        await uploadRecording(blob, sessionId, sessionType);
      };

      mediaRecorder.current.start(1000); // Record in 1-second intervals
      setIsRecording(true);
      setActiveRecording({ sessionId, sessionType, startTime: Date.now() });

      // toast.success('Recording started');
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('Failed to start recording');
    }
  }, []);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (mediaRecorder.current && isRecording) {
      mediaRecorder.current.stop();
      
      // Stop all tracks
      mediaRecorder.current.stream.getTracks().forEach(track => {
        track.stop();
      });

      setIsRecording(false);
      setActiveRecording(null);
      // toast.success('Recording saved');
    }
  }, [isRecording]);

  // Upload recording to backend
  const uploadRecording = async (blob, sessionId, sessionType) => {
    const formData = new FormData();
    formData.append('recording', blob, `recording_${sessionId}_${Date.now()}.webm`);
    formData.append('sessionId', sessionId);
    formData.append('sessionType', sessionType);

    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/users/upload-recording`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${await getAuthToken()}`
        },
        body: formData
      });

      if (response.ok) {
        fetchRecordings(); // Refresh recordings list
        // toast.success('Recording uploaded successfully');
      } else {
        throw new Error('Upload failed');
      }
    } catch (error) {
      console.error('Error uploading recording:', error);
      toast.error('Failed to upload recording');
    }
  };

  // Play recording
  const playRecording = useCallback((recording) => {
    const audioElement = audioRef.current;
    const videoElement = videoRef.current;
    
    if (playbackState.isPlaying && playbackState.recordingId === recording.id) {
      // Pause current playback
      if (recording.sessionType === 'video' && videoElement) {
        videoElement.pause();
      } else if (audioElement) {
        audioElement.pause();
      }
      
      setPlaybackState(prev => ({ ...prev, isPlaying: false }));
    } else {
      // Start new playback
      const element = recording.sessionType === 'video' ? videoElement : audioElement;
      
      if (element) {
        element.src = recording.fileUrl;
        element.currentTime = playbackState.recordingId === recording.id ? playbackState.currentTime : 0;
        element.play();
        
        setPlaybackState({
          isPlaying: true,
          recordingId: recording.id,
          currentTime: element.currentTime,
          duration: element.duration || recording.duration
        });
      }
    }
  }, [playbackState]);

  // Handle playback time update
  const handleTimeUpdate = useCallback((element) => {
    setPlaybackState(prev => ({
      ...prev,
      currentTime: element.currentTime,
      duration: element.duration
    }));
  }, []);

  // Delete recording
  const deleteRecording = async (recordingId) => {
    if (!window.confirm('Are you sure you want to delete this recording? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/users/recordings/${recordingId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${await getAuthToken()}`
        }
      });

      if (response.ok) {
        setRecordings(prev => prev.filter(r => r.id !== recordingId));
        // toast.success('Recording deleted');
      } else {
        throw new Error('Delete failed');
      }
    } catch (error) {
      console.error('Error deleting recording:', error);
      toast.error('Failed to delete recording');
    }
  };

  // Download recording
  const downloadRecording = (recording) => {
    const link = document.createElement('a');
    link.href = recording.fileUrl;
    link.download = `${recording.sessionType}_call_${recording.createdAt}.webm`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    // toast.success('Download started');
  };

  // Format duration
  const formatDuration = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Filter recordings
  const filteredRecordings = recordings.filter(recording => {
    if (filter === 'all') return true;
    return recording.sessionType === filter;
  });

  const RecordingCard = ({ recording }) => {
    const isCurrentlyPlaying = playbackState.isPlaying && playbackState.recordingId === recording.id;
    
    return (
      <motion.div
        className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -2 }}
      >
        <div className="flex items-start gap-4">
          {/* Thumbnail/Icon */}
          <div className="flex-shrink-0">
            {recording.sessionType === 'video' ? (
              <div className="w-16 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <VideoCameraIcon className="w-6 h-6 text-blue-600" />
              </div>
            ) : (
              <div className="w-16 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <MicrophoneIcon className="w-6 h-6 text-green-600" />
              </div>
            )}
          </div>

          {/* Recording Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-gray-900 truncate">
                {recording.sessionType === 'video' ? 'Video' : 'Voice'} Call
              </h4>
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <CalendarIcon className="w-3 h-3" />
                {new Date(recording.createdAt).toLocaleDateString()}
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs text-gray-600 mb-3">
              <span className="flex items-center gap-1">
                <UserIcon className="w-3 h-3" />
                @{recording.partnerUsername}
              </span>
              <span className="flex items-center gap-1">
                <ClockIcon className="w-3 h-3" />
                {formatDuration(recording.duration)}
              </span>
              <span>{formatFileSize(recording.fileSize)}</span>
            </div>

            {/* Progress Bar (if playing) */}
            {isCurrentlyPlaying && (
              <div className="mb-3">
                <div className="w-full bg-gray-200 rounded-full h-1">
                  <div
                    className="bg-blue-600 h-1 rounded-full transition-all duration-100"
                    style={{
                      width: `${(playbackState.currentTime / playbackState.duration) * 100}%`
                    }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>{formatDuration(playbackState.currentTime)}</span>
                  <span>{formatDuration(playbackState.duration)}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          <div className="flex items-center gap-2">
            <button
              onClick={() => playRecording(recording)}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors group"
              title={isCurrentlyPlaying ? 'Pause' : 'Play'}
            >
              {isCurrentlyPlaying ? (
                <PauseIconSolid className="w-5 h-5 text-gray-700 group-hover:text-blue-600" />
              ) : (
                <PlayIconSolid className="w-5 h-5 text-gray-700 group-hover:text-blue-600" />
              )}
            </button>

            <button
              onClick={() => setSelectedRecording(recording)}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors group"
              title="View details"
            >
              <EyeIcon className="w-5 h-5 text-gray-700 group-hover:text-blue-600" />
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => downloadRecording(recording)}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors group"
              title="Download"
            >
              <DownloadIcon className="w-4 h-4 text-gray-700 group-hover:text-green-600" />
            </button>

            {isCreator && (
              <button
                onClick={() => {/* Share functionality */}}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors group"
                title="Share"
              >
                <ShareIcon className="w-4 h-4 text-gray-700 group-hover:text-blue-600" />
              </button>
            )}

            <button
              onClick={() => deleteRecording(recording.id)}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors group"
              title="Delete"
            >
              <TrashIcon className="w-4 h-4 text-gray-700 group-hover:text-red-600" />
            </button>
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Call Recordings</h2>
          <p className="text-gray-600">
            {isCreator ? 'Manage your call recordings' : 'Your recorded conversations'}
          </p>
        </div>

        {/* Recording Status */}
        {isRecording && (
          <div className="flex items-center gap-3 px-4 py-2 bg-red-50 border border-red-200 rounded-full">
            <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium text-red-900">Recording...</span>
            <button
              onClick={stopRecording}
              className="p-1 hover:bg-red-100 rounded-full transition-colors"
            >
              <StopIcon className="w-4 h-4 text-red-600" />
            </button>
          </div>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
        {[
          { key: 'all', label: 'All Recordings', icon: DocumentIcon },
          { key: 'video', label: 'Video Calls', icon: VideoCameraIcon },
          { key: 'voice', label: 'Voice Calls', icon: MicrophoneIcon }
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md font-medium transition-colors ${
              filter === key
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* Recordings Grid */}
      {filteredRecordings.length > 0 ? (
        <div className="grid gap-4">
          {filteredRecordings.map(recording => (
            <RecordingCard key={recording.id} recording={recording} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <DocumentIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-2">No recordings found</p>
          <p className="text-sm text-gray-500">
            {filter !== 'all' 
              ? `No ${filter} recordings available`
              : 'Your call recordings will appear here'
            }
          </p>
        </div>
      )}

      {/* Hidden Audio/Video Elements for Playback */}
      <audio
        ref={audioRef}
        onTimeUpdate={(e) => handleTimeUpdate(e.target)}
        onEnded={() => setPlaybackState(prev => ({ ...prev, isPlaying: false }))}
        className="hidden"
      />
      
      <video
        ref={videoRef}
        onTimeUpdate={(e) => handleTimeUpdate(e.target)}
        onEnded={() => setPlaybackState(prev => ({ ...prev, isPlaying: false }))}
        className="hidden"
      />

      {/* Recording Detail Modal */}
      <AnimatePresence>
        {selectedRecording && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedRecording(null)}
          >
            <motion.div
              className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                  Recording Details
                </h3>
                
                {/* Recording Player */}
                {selectedRecording.sessionType === 'video' ? (
                  <video
                    controls
                    className="w-full h-64 bg-gray-900 rounded-lg mb-4"
                    src={selectedRecording.fileUrl}
                  />
                ) : (
                  <div className="w-full h-32 bg-gray-100 rounded-lg flex items-center justify-center mb-4">
                    <audio
                      controls
                      className="w-full max-w-md"
                      src={selectedRecording.fileUrl}
                    />
                  </div>
                )}

                {/* Recording Info */}
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-700">Type:</span>
                      <span className="ml-2 text-gray-900">{selectedRecording.sessionType} call</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Duration:</span>
                      <span className="ml-2 text-gray-900">{formatDuration(selectedRecording.duration)}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Date:</span>
                      <span className="ml-2 text-gray-900">
                        {new Date(selectedRecording.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">File size:</span>
                      <span className="ml-2 text-gray-900">{formatFileSize(selectedRecording.fileSize)}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Partner:</span>
                      <span className="ml-2 text-gray-900">@{selectedRecording.partnerUsername}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Privacy:</span>
                      <span className="ml-2 text-gray-900 flex items-center gap-1">
                        <LockClosedIcon className="w-3 h-3" />
                        Private
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3 pt-4 border-t">
                    <button
                      onClick={() => downloadRecording(selectedRecording)}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <DownloadIcon className="w-4 h-4" />
                      Download
                    </button>
                    
                    <button
                      onClick={() => setSelectedRecording(null)}
                      className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Recording consent component
export const RecordingConsent = ({ isOpen, onConsent, onDecline, sessionType, partnerName }) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="bg-white rounded-2xl w-full max-w-md shadow-2xl"
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
        >
          <div className="p-6">
            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <VideoCameraIcon className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Recording Request
              </h3>
              <p className="text-sm text-gray-600">
                @{partnerName} would like to record this {sessionType} call
              </p>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-yellow-800">
                <strong>Important:</strong> This call will be recorded and saved. 
                Both parties must consent to recording. You can request deletion at any time.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={onDecline}
                className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
              >
                Decline
              </button>
              <button
                onClick={onConsent}
                className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors"
              >
                Allow Recording
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// Hook for recording functionality
export const useCallRecording = (user) => {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorder = useRef(null);
  const recordedChunks = useRef([]);

  const startRecording = useCallback(async (sessionId, sessionType) => {
    try {
      const constraints = {
        video: sessionType === 'video',
        audio: true
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      mediaRecorder.current = new MediaRecorder(stream);
      recordedChunks.current = [];

      mediaRecorder.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunks.current.push(event.data);
        }
      };

      mediaRecorder.current.onstop = async () => {
        const blob = new Blob(recordedChunks.current, {
          type: sessionType === 'video' ? 'video/webm' : 'audio/webm'
        });

        // Upload to backend
        const formData = new FormData();
        formData.append('recording', blob);
        formData.append('sessionId', sessionId);
        formData.append('sessionType', sessionType);

        await fetch(`${import.meta.env.VITE_BACKEND_URL}/users/upload-recording`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${await getAuthToken()}`
          },
          body: formData
        });
      };

      mediaRecorder.current.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Recording failed:', error);
      toast.error('Failed to start recording');
    }
  }, [user]);

  const stopRecording = useCallback(() => {
    if (mediaRecorder.current && isRecording) {
      mediaRecorder.current.stop();
      mediaRecorder.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
    }
  }, [isRecording]);

  return { isRecording, startRecording, stopRecording };
};

export default CallRecordingSystem;