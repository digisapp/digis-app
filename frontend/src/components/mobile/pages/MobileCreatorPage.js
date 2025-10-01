import React, { memo } from 'react';
import { UserCircleIcon } from '@heroicons/react/24/outline';
import MobileComingSoon from '../MobileComingSoon';

const MobileCreatorPage = memo(({ navigateTo }) => {
  return (
    <MobileComingSoon
      title="Creator Profile"
      description="Get an immersive view of your favorite creators with their complete profile, content, and exclusive offerings."
      icon={UserCircleIcon}
      releaseDate="Coming Soon"
      features={[
        'View creator bio and achievements',
        'Browse exclusive content gallery',
        'See live streaming schedule',
        'Access creator-specific offerings',
        'Direct messaging and tipping',
        'Subscribe to creator updates'
      ]}
      primaryAction={() => navigateTo('explore')}
      primaryActionLabel="Browse Creators"
    />
  );
});

MobileCreatorPage.displayName = 'MobileCreatorPage';

export default MobileCreatorPage;
