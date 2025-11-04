import React, { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import HybridStreamingLayout from '../HybridStreamingLayout';
import { apiGet } from '../../lib/api';
import LoadingSpinner from '../ui/LoadingSpinner';
import toast from 'react-hot-toast';

const StreamPage = ({ user }) => {
  const { streamId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [streamData, setStreamData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  console.log('📺 [StreamPage] Component mounted/updated:', {
    streamId,
    hasLocationState: !!location.state,
    isHost: location.state?.isHost,
    hasAgora: !!location.state?.agora,
    userId: user?.id
  });

  // Check if user is the host (from state or if it's their stream)
  const isHost = location.state?.isHost || false;

  useEffect(() => {
    console.log('📺 [StreamPage] useEffect - fetching stream data for:', streamId);
    fetchStreamData();
  }, [streamId]);

  const fetchStreamData = async () => {
    console.log('📺 [StreamPage] fetchStreamData called');
    try {
      setLoading(true);

      // If coming from go-live setup, use the state data (token already provided)
      if (location.state && location.state.isHost && location.state.channelName) {
        console.log('🎬 [StreamPage] Loading from go-live state:', {
          hasAgora: !!location.state.agora,
          hasToken: !!location.state.agoraToken,
          hasUid: !!location.state.agoraUid,
          channel: location.state.channelName,
          uid: location.state.agoraUid,
          agoraConfig: location.state.agora
        });

        const streamData = {
          channel: location.state.channelName,
          token: location.state.agoraToken, // Use token from go-live response
          chatToken: location.state.chatToken,
          uid: location.state.agoraUid, // Use UID from go-live response
          streamTitle: location.state.title,
          streamCategory: location.state.category,
          streamDescription: location.state.description,
          isHost: true,
          agora: location.state.agora // Pass through full agora config
        };

        console.log('✅ StreamPage: Built streamData:', streamData);
        setStreamData(streamData);
        setLoading(false);
        return;
      }

      // Otherwise, fetch stream data from API (viewer joining existing stream)
      console.log('📡 StreamPage: Fetching stream data from API for streamId:', streamId);
      const data = await apiGet(`/streaming/stream/${streamId}`);

      if (data.stream) {
        console.log('✅ StreamPage: Received stream data from API:', data);
        setStreamData({
          channel: data.stream.channel_name,
          token: data.agoraToken,
          chatToken: data.chatToken,
          uid: data.uid,
          streamTitle: data.stream.title,
          streamCategory: data.stream.category,
          streamDescription: data.stream.description,
          isHost: data.stream.creator_id === user?.id,
        });
      } else {
        console.warn('⚠️ StreamPage: No stream in API response');
        setError('Stream not found or is no longer live');
      }
    } catch (err) {
      console.error('❌ StreamPage: Error fetching stream data:', err);
      setError('Failed to load stream. Please try again.');
      // Don't navigate away - let user retry
    } finally {
      setLoading(false);
    }
  };

  const handleStreamEnd = () => {
    console.log('📺 [StreamPage] handleStreamEnd called - navigating to /tv');
    toast.success('Stream ended');
    navigate('/tv');
  };

  const handleLeaveStream = () => {
    navigate('/tv');
  };

  console.log('📺 [StreamPage] Render state:', { loading, error, hasStreamData: !!streamData });

  if (loading) {
    console.log('📺 [StreamPage] Rendering loading spinner');
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (error) {
    console.log('📺 [StreamPage] Rendering error state:', error);
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Stream Unavailable</h1>
          <p className="text-gray-400 mb-6">{error}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => {
                setError(null);
                fetchStreamData();
              }}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
            >
              Retry
            </button>
            <button
              onClick={() => navigate('/tv')}
              className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              Back to Digis TV
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!streamData) {
    console.log('📺 [StreamPage] No stream data - rendering not found');
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Stream Not Found</h1>
          <button
            onClick={() => navigate('/tv')}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
          >
            Back to Digis TV
          </button>
        </div>
      </div>
    );
  }

  console.log('📺 [StreamPage] Rendering HybridStreamingLayout with streamData:', {
    channel: streamData.channel,
    hasToken: !!streamData.token,
    uid: streamData.uid,
    isHost: streamData.isHost
  });

  return (
    <HybridStreamingLayout
      user={user}
      channel={streamData.channel}
      token={streamData.token}
      chatToken={streamData.chatToken}
      uid={streamData.uid}
      isHost={streamData.isHost}
      isStreaming={true}
      streamConfig={{
        title: streamData.streamTitle,
        category: streamData.streamCategory,
        description: streamData.streamDescription
      }}
      onSessionEnd={handleStreamEnd}
    />
  );
};

export default StreamPage;
