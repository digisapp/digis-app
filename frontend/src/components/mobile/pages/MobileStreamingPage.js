import React, { memo } from 'react';
import { VideoCameraIcon } from '@heroicons/react/24/outline';
import MobileComingSoon from '../MobileComingSoon';

const MobileStreamingPage = memo(({ navigateTo }) => {
  return (
    <MobileComingSoon
      title="Live Streaming"
      description="Watch and interact with creators in real-time through high-quality live streams."
      icon={VideoCameraIcon}
      releaseDate="Coming Soon"
      features={[
        'HD quality streaming',
        'Interactive live chat',
        'Virtual gifts and reactions',
        'Screen sharing support',
        'Stream recording and replay',
        'Multi-camera support'
      ]}
      primaryAction={() => navigateTo('home')}
      primaryActionLabel="Explore Live Creators"
    />
  );
});

MobileStreamingPage.displayName = 'MobileStreamingPage';

export default MobileStreamingPage;
