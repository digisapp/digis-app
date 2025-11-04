import React from 'react';
import { useNavigate } from 'react-router-dom';
import GoLiveSetup from '../GoLiveSetup';
import { apiPost } from '../../lib/api';
import toast from 'react-hot-toast';

const GoLivePage = ({ user }) => {
  const navigate = useNavigate();

  const handleGoLive = async (streamData) => {
    try {
      console.log('🎬 Starting stream with config:', {
        title: streamData.title,
        category: streamData.category,
        privacy: streamData.privacy
      });

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
      const response = await apiPost('/streaming/go-live', streamConfig);

      console.log('✅ Stream created response:', response);

      if (response.stream && response.agora && response.agora.token && response.agora.uid) {
        console.log('📺 Navigating to stream:', response.stream.channel);
        console.log('🔑 Agora credentials:', {
          hasAppId: !!response.agora.appId,
          hasToken: !!response.agora.token,
          hasUid: !!response.agora.uid,
          uid: response.agora.uid,
          channel: response.stream.channel
        });

        // Clean up the preview tracks since we'll create fresh ones in StreamingLayout
        try {
          if (streamData.tracks?.video) {
            streamData.tracks.video.close();
          }
          if (streamData.tracks?.audio) {
            streamData.tracks.audio.close();
          }
          if (streamData.client) {
            await streamData.client.leave();
          }
        } catch (cleanupError) {
          console.warn('Track cleanup warning (non-critical):', cleanupError);
        }

        toast.success('Going live!');

        // Navigate with only serializable data
        // StreamingLayout will create its own Agora client and tracks
        navigate(`/stream/${response.stream.channel}`, {
          state: {
            isHost: true,
            streamId: response.stream.id,
            channelName: response.stream.channel,
            title: streamConfig.title,
            category: streamConfig.category,
            description: streamConfig.description,
            // Pass full Agora config for singleton
            agora: {
              appId: response.agora?.appId || import.meta.env.VITE_AGORA_APP_ID,
              token: response.agora?.token,
              channel: response.stream.channel,
              uid: response.agora?.uid, // CRITICAL: Backend's UID for UID-bound token
              role: response.agora?.role || 'host'
            },
            // Legacy support (remove after migration)
            agoraToken: response.agora?.token,
            agoraUid: response.agora?.uid,
          }
        });
      } else {
        console.error('❌ Response missing required data:', {
          hasStream: !!response.stream,
          hasAgora: !!response.agora,
          hasToken: !!response.agora?.token,
          hasUid: !!response.agora?.uid,
          response
        });
        toast.error('Failed to get streaming credentials. Please try again.');
      }
    } catch (error) {
      console.error('Failed to create stream:', error);
      toast.error(error.message || 'Failed to start stream. Please try again.');
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
