import React, { memo } from 'react';
import { BellAlertIcon } from '@heroicons/react/24/outline';
import MobileComingSoon from '../MobileComingSoon';

const MobileNotificationsPage = memo(({ navigateTo }) => {
  return (
    <MobileComingSoon
      title="Notifications"
      description="Never miss an update from your favorite creators with our smart notification system."
      icon={BellAlertIcon}
      releaseDate="Coming Soon"
      features={[
        'Real-time push notifications',
        'Creator live stream alerts',
        'Message and mention notifications',
        'Customizable notification preferences',
        'Notification history and archive',
        'Smart notification grouping'
      ]}
      primaryAction={() => navigateTo('home')}
      primaryActionLabel="Back to Home"
    />
  );
});

MobileNotificationsPage.displayName = 'MobileNotificationsPage';

export default MobileNotificationsPage;
