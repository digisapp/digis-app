import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Hook for managing local camera/mic preview with proper cleanup and error handling
 * @param {boolean} active - Whether the preview should be active
 * @param {Object} options - Configuration options
 * @returns {Object} - { videoRef, start, stop, error, loading, devices }
 */
export function useLocalPreview(active, options = {}) {
  const {
    facingMode = 'user',
    width = 1280,
    height = 720,
    audio = true,
  } = options;

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [devices, setDevices] = useState({ cameras: [], microphones: [] });
  const [selectedCamera, setSelectedCamera] = useState(null);
  const [selectedMicrophone, setSelectedMicrophone] = useState(null);

  // Enumerate available devices
  const enumerateDevices = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) return;
      
      const deviceList = await navigator.mediaDevices.enumerateDevices();
      const cameras = deviceList.filter(d => d.kind === 'videoinput');
      const microphones = deviceList.filter(d => d.kind === 'audioinput');
      
      setDevices({ cameras, microphones });
      
      // Set default devices if not selected
      if (!selectedCamera && cameras.length > 0) {
        setSelectedCamera(cameras[0].deviceId);
      }
      if (!selectedMicrophone && microphones.length > 0) {
        setSelectedMicrophone(microphones[0].deviceId);
      }
    } catch (err) {
      console.error('Failed to enumerate devices:', err);
    }
  }, [selectedCamera, selectedMicrophone]);

  // Start preview stream
  const start = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Check for HTTPS
      if (!window.isSecureContext) {
        throw new Error('Camera/microphone requires HTTPS. Please use a secure connection.');
      }

      // Check for getUserMedia support
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Your browser does not support camera/microphone access.');
      }

      // Enumerate devices first
      await enumerateDevices();

      // Build constraints
      const constraints = {
        video: selectedCamera 
          ? { deviceId: { exact: selectedCamera }, width: { ideal: width }, height: { ideal: height } }
          : { facingMode, width: { ideal: width }, height: { ideal: height } },
        audio: audio ? {
          deviceId: selectedMicrophone ? { exact: selectedMicrophone } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } : false
      };

      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      // Attach to video element
      if (videoRef.current) {
        const videoEl = videoRef.current;
        
        // iOS-specific attributes
        videoEl.setAttribute('playsinline', 'true');
        videoEl.setAttribute('webkit-playsinline', 'true');
        videoEl.muted = true;
        videoEl.srcObject = stream;
        
        // Wait for metadata before playing
        await new Promise((resolve) => {
          videoEl.onloadedmetadata = () => {
            videoEl.play()
              .then(resolve)
              .catch(err => {
                console.warn('Video autoplay failed:', err);
                resolve(); // Continue even if autoplay fails
              });
          };
        });
      }
    } catch (err) {
      console.error('Preview error:', err);
      setError(humanizeGetUserMediaError(err));
    } finally {
      setLoading(false);
    }
  }, [selectedCamera, selectedMicrophone, facingMode, width, height, audio, enumerateDevices]);

  // Stop preview stream
  const stop = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Switch camera (for mobile flip)
  const switchCamera = useCallback(async () => {
    const { cameras } = devices;
    if (cameras.length <= 1) return;
    
    const currentIndex = cameras.findIndex(c => c.deviceId === selectedCamera);
    const nextIndex = (currentIndex + 1) % cameras.length;
    const nextCamera = cameras[nextIndex];
    
    setSelectedCamera(nextCamera.deviceId);
    
    // Restart with new camera
    if (streamRef.current) {
      stop();
      await start();
    }
  }, [devices, selectedCamera, stop, start]);

  // Toggle audio track
  const toggleAudio = useCallback(() => {
    if (streamRef.current) {
      const audioTracks = streamRef.current.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      return audioTracks[0]?.enabled;
    }
    return false;
  }, []);

  // Toggle video track
  const toggleVideo = useCallback(() => {
    if (streamRef.current) {
      const videoTracks = streamRef.current.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      return videoTracks[0]?.enabled;
    }
    return false;
  }, []);

  // Auto start/stop based on active prop
  useEffect(() => {
    if (active) {
      start();
    } else {
      stop();
    }
    
    return () => {
      stop();
    };
  }, [active]); // Only depend on active, not start/stop to avoid loops

  // Listen for device changes
  useEffect(() => {
    const handleDeviceChange = () => {
      enumerateDevices();
    };
    
    navigator.mediaDevices?.addEventListener?.('devicechange', handleDeviceChange);
    
    return () => {
      navigator.mediaDevices?.removeEventListener?.('devicechange', handleDeviceChange);
    };
  }, [enumerateDevices]);

  return {
    videoRef,
    start,
    stop,
    error,
    loading,
    devices,
    selectedCamera,
    selectedMicrophone,
    setSelectedCamera,
    setSelectedMicrophone,
    switchCamera,
    toggleAudio,
    toggleVideo,
    stream: streamRef.current
  };
}

// Helper function to convert technical errors to user-friendly messages
function humanizeGetUserMediaError(err) {
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  
  switch (err?.name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      if (isIOS) {
        return 'Camera/mic access denied. Go to Settings > Safari > Camera & Microphone and allow access for this site.';
      }
      return 'Camera/mic blocked. Click the lock icon in your browser\'s address bar to allow access.';
    
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'No camera or microphone found. Please connect a device and refresh.';
    
    case 'NotReadableError':
    case 'TrackStartError':
      return 'Another app is using your camera. Close other apps and try again.';
    
    case 'OverconstrainedError':
      return 'Camera does not support the requested quality. Trying with default settings...';
    
    case 'TypeError':
      if (!window.isSecureContext) {
        return 'This site needs HTTPS to access camera/mic. Please use a secure connection.';
      }
      return 'Browser configuration error. Please try another browser.';
    
    default:
      if (isIOS && isSafari) {
        return 'Camera access failed. Check Settings > Safari > Camera & Microphone, or try closing and reopening Safari.';
      }
      return `Could not access camera/mic: ${err?.message || 'Unknown error'}. Please check browser permissions.`;
  }
}

export default useLocalPreview;