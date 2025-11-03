import React, { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import StreamingLayout from '../StreamingLayout';
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

  // Check if user is the host (from state or if it's their stream)
  const isHost = location.state?.isHost || false;

  useEffect(() => {
    fetchStreamData();
  }, [streamId]);

  const fetchStreamData = async () => {
    try {
      setLoading(true);

      // If coming from go-live setup, use the state data
      if (location.state && location.state.channelName) {
        setStreamData({
          channel: location.state.channelName,
          token: location.state.token,
          chatToken: location.state.chatToken,
          uid: location.state.uid,
          streamTitle: location.state.streamTitle,
          streamCategory: location.state.streamCategory,
          isHost: location.state.isHost,
        });
        setLoading(false);
        return;
      }

      // Otherwise, fetch stream data from API
      const data = await apiGet(`/streaming/stream/${streamId}`);

      if (data.stream) {
        setStreamData({
          channel: data.stream.channel_name,
          token: data.agoraToken,
          chatToken: data.chatToken,
          uid: data.uid,
          streamTitle: data.stream.title,
          streamCategory: data.stream.category,
          isHost: data.stream.creator_id === user?.id,
        });
      } else {
        setError('Stream not found or is no longer live');
      }
    } catch (err) {
      console.error('Error fetching stream data:', err);
      setError('Failed to load stream. The stream may have ended.');
      toast.error('Failed to load stream');
    } finally {
      setLoading(false);
    }
  };

  const handleStreamEnd = () => {
    toast.success('Stream ended');
    navigate('/tv');
  };

  const handleLeaveStream = () => {
    navigate('/tv');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Stream Unavailable</h1>
          <p className="text-gray-400 mb-6">{error}</p>
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

  if (!streamData) {
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

  return (
    <StreamingLayout
      user={user}
      channel={streamData.channel}
      token={streamData.token}
      chatToken={streamData.chatToken}
      uid={streamData.uid}
      isHost={streamData.isHost}
      streamTitle={streamData.streamTitle}
      streamCategory={streamData.streamCategory}
      onStreamEnd={handleStreamEnd}
      onLeave={handleLeaveStream}
    />
  );
};

export default StreamPage;
