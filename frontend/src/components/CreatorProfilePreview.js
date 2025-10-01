import React from 'react';
import PublicCreatorProfile from './PublicCreatorProfile';

// Mock creator data for preview
const mockCreator = {
  username: 'miriam',
  bio: '✨ Digital Content Creator | 🎨 Artist | 💫 Making your day brighter one stream at a time! Based in California, spreading positive vibes worldwide.',
  profilePicUrl: null, // Will show initials
  streamPrice: 10.00,
  videoPrice: 15.00,
  voicePrice: 12.00,
  messagePrice: 5.00,
  totalSessions: 156,
  totalEarnings: 2500.00,
  followerCount: 1250,
  state: 'California',
  country: 'USA',
  isOnline: true,
  supabaseId: 'mock-creator-123'
};

const mockFollowers = [
  { username: 'fan123', profile_pic_url: null, is_online: true },
  { username: 'supporter99', profile_pic_url: null, is_online: false },
  { username: 'viewer2024', profile_pic_url: null, is_online: true },
  { username: 'digitallover', profile_pic_url: null, is_online: false },
  { username: 'streamwatcher', profile_pic_url: null, is_online: true }
];

// This component shows exactly what a fan sees when visiting a creator profile
const CreatorProfilePreview = () => {
  // Store original fetch
  const originalFetch = window.fetch;
  
  // Override the fetch functions to use mock data
  React.useEffect(() => {
    // Mock the API responses
    window.fetch = (url, ...args) => {
      if (url.includes('/api/users/public/creator/')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ creator: mockCreator })
        });
      }
      if (url.includes('/api/users/creator/') && url.includes('/followers')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ followers: mockFollowers })
        });
      }
      // Return original fetch for other URLs
      return originalFetch(url, ...args);
    };

    return () => {
      // Restore original fetch
      window.fetch = originalFetch;
    };
  }, [originalFetch]);

  return (
    <div className="preview-wrapper">
      <div className="preview-header bg-gray-800 text-white p-4 text-center">
        <h1 className="text-xl font-bold">Creator Profile Preview - Fan Perspective</h1>
        <p className="text-sm opacity-75 mt-1">This is what fans see when they visit digis.cc/miriam</p>
      </div>
      
      <PublicCreatorProfile 
        username="miriam"
        user={null} // Fan is not logged in
        onBack={() => window.history.back()}
        onSignIn={() => alert('Sign in clicked - would redirect to auth')}
        onJoinPrivateSession={(type) => alert(`Join ${type} session clicked - would prompt sign in`)}
      />
    </div>
  );
};

export default CreatorProfilePreview;