import React from 'react';
import { useNavigate } from 'react-router-dom';
import GoLiveSetup from '../GoLiveSetup';

const GoLivePage = ({ user }) => {
  const navigate = useNavigate();

  const handleGoLive = (streamData) => {
    // Navigate to the streaming page with the stream data
    navigate(`/stream/${streamData.channelName}`, {
      state: {
        isHost: true,
        ...streamData
      }
    });
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
