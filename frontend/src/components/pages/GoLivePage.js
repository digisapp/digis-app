import React from 'react';
import { useNavigate } from 'react-router-dom';
import GoLiveSetup from '../GoLiveSetup';
import { apiPost } from '../../lib/api';
import toast from 'react-hot-toast';

const GoLivePage = ({ user }) => {
  const navigate = useNavigate();

  const handleGoLive = async (streamData) => {
    try {
      // Extract only serializable data (no Agora tracks/client)
      const streamConfig = {
        title: streamData.title,
        category: streamData.category,
        description: streamData.description,
        shoppingEnabled: streamData.shoppingEnabled,
        selectedProducts: streamData.selectedProducts || [],
        audienceControl: streamData.audienceControl,
        streamGoal: streamData.streamGoal,
        tags: streamData.tags || [],
        privacy: streamData.privacy || 'public',
        isTestStream: streamData.isTestStream || false,
      };

      // Create the stream on the backend
      const response = await apiPost('/streaming/create', streamConfig);

      if (response.stream) {
        // Clean up the preview tracks since we'll create fresh ones in StreamingLayout
        if (streamData.tracks?.video) {
          streamData.tracks.video.close();
        }
        if (streamData.tracks?.audio) {
          streamData.tracks.audio.close();
        }
        if (streamData.client) {
          streamData.client.leave();
        }

        // Navigate with only serializable data
        // StreamingLayout will create its own Agora client and tracks
        navigate(`/stream/${response.stream.channel_name}`, {
          state: {
            isHost: true,
            streamId: response.stream.id,
            channelName: response.stream.channel_name,
            title: streamConfig.title,
            category: streamConfig.category,
            description: streamConfig.description,
          }
        });
      }
    } catch (error) {
      console.error('Failed to create stream:', error);
      toast.error('Failed to start stream. Please try again.');
    }
  };

  const handleCancel = () => {
    // Go back to dashboard or TV page
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <GoLiveSetup
        user={user}
        onGoLive={handleGoLive}
        onCancel={handleCancel}
      />
    </div>
  );
};

export default GoLivePage;
