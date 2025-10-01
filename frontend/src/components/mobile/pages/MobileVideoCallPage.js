import React, { memo } from 'react';
import { PhoneIcon } from '@heroicons/react/24/outline';
import MobileComingSoon from '../MobileComingSoon';

const MobileVideoCallPage = memo(({ navigateTo }) => {
  return (
    <MobileComingSoon
      title="Video Calls"
      description="Connect face-to-face with your favorite creators through private video calls."
      icon={PhoneIcon}
      releaseDate="Coming Soon"
      features={[
        'HD video and crystal-clear audio',
        'Scheduled and instant calls',
        'Virtual backgrounds',
        'Call recording options',
        'Screen sharing capabilities',
        'In-call messaging'
      ]}
      primaryAction={() => navigateTo('explore')}
      primaryActionLabel="Find Creators"
    />
  );
});

MobileVideoCallPage.displayName = 'MobileVideoCallPage';

export default MobileVideoCallPage;
