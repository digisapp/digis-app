import React, { memo, useState, useCallback } from 'react';
import MobileEditProfile from '../MobileEditProfile';
import { supabase } from '../../../utils/supabase-auth';
import toast from 'react-hot-toast';

const MobileSettingsPage = memo(({ user, navigateTo }) => {
  const [isLoading, setIsLoading] = useState(false);

  console.log('📱 MobileSettingsPage rendered with user:', user?.email);

  // Check if user is creator
  const isCreator = user?.is_creator ||
                   user?.role === 'creator' ||
                   user?.creator_type ||
                   false;

  const handleSave = useCallback(async (profileData) => {
    setIsLoading(true);
    try {
      // Here you would save the profile data
      // For now, we'll just show a success message
      const { formData, creatorSettings, privacySettings } = profileData;

      // Make API call to save profile
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/users/update-profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          ...formData,
          ...(isCreator ? creatorSettings : {}),
          privacy_settings: privacySettings
        })
      });

      if (!response.ok) throw new Error('Failed to update profile');

      toast.success('Profile updated successfully!');
      navigateTo('profile');
    } catch (error) {
      console.error('Error saving profile:', error);
      toast.error('Failed to save profile. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [isCreator, navigateTo]);

  return (
    <MobileEditProfile
      user={user}
      isCreator={isCreator}
      onSave={handleSave}
      onNavigate={navigateTo}
    />
  );
});

MobileSettingsPage.displayName = 'MobileSettingsPage';

export default MobileSettingsPage;
