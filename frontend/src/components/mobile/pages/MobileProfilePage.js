import React, { memo } from 'react';
import MobileProfile from '../MobileProfile';

const MobileProfilePage = memo(({ user, logout, navigateTo }) => {
  // Check multiple fields to determine if user is a creator
  const isCreator = user?.is_creator || 
                   user?.role === 'creator' || 
                   user?.creator_type || 
                   user?.creator_profile || 
                   false;
  
  // Ensure user has proper display name
  const userWithName = {
    ...user,
    displayName: user?.display_name || user?.displayName || user?.username || user?.email?.split('@')[0] || 'User'
  };
  
  return <MobileProfile 
    user={userWithName} 
    isCreator={isCreator} 
    onSignOut={logout}
    onEditProfile={() => navigateTo('settings')}
    onBecomeCreator={() => navigateTo('creator-application')}
  />;
});

MobileProfilePage.displayName = 'MobileProfilePage';

export default MobileProfilePage;