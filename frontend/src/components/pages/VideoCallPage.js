import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import VideoCall from '../VideoCall';

const VideoCallPage = ({ user, ...props }) => {
  const { type, channel } = useParams();
  const navigate = useNavigate();

  const handleSessionEnd = () => {
    navigate('/dashboard');
  };

  const callProps = {
    channel: channel,
    isVoiceOnly: type === 'voice',
    isStreaming: type === 'stream',
    onSessionEnd: handleSessionEnd,
    user: user,
    ...props
  };

  return (
    <div className="fixed inset-0 bg-black z-50">
      <VideoCall {...callProps} />
    </div>
  );
};

export default VideoCallPage;