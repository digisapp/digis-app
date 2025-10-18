import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ImprovedProfile from '../ImprovedProfile';
import PrivacySettings from '../PrivacySettings';
import CreatorApplication from '../CreatorApplication';
import CreatorAnalytics from '../CreatorAnalytics';
import { useUsername } from '../../hooks/useUsername';
import { 
  UserCircleIcon,
  CogIcon,
  ShieldCheckIcon,
  StarIcon,
  ArrowRightOnRectangleIcon,
  BellIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';
import { supabase } from '../../utils/supabase-auth';
import toast from 'react-hot-toast';
import { getAuthToken } from '../../utils/auth-helpers';

const ProfilePage = ({ user, isCreator, onLogout }) => {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('profile');
  const { username, loading } = useUsername(user);
  const [showTokenBalance, setShowTokenBalance] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  
  // Check URL params on mount and when they change
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const section = params.get('section');
    if (section) {
      setActiveSection(section);
    }
  }, [window.location.search]);

  useEffect(() => {
    loadUserSettings();
  }, [user]);

  const loadUserSettings = async () => {
    if (!user) return;
    
    setSettingsLoading(true);
    try {
      const token = await getAuthToken();
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/users/profile?uid=${user.id}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setShowTokenBalance(data.show_token_balance || false);
      }
    } catch (error) {
      console.error('Error loading user settings:', error);
    } finally {
      setSettingsLoading(false);
    }
  };

  const saveTokenBalanceSetting = async (newValue) => {
    if (!user) return;
    
    setSettingsSaving(true);
    try {
      const token = await getAuthToken();
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/users/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          show_token_balance: newValue
        })
      });

      if (response.ok) {
        setShowTokenBalance(newValue);
        // toast.success('Token balance visibility updated');
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to update setting');
      }
    } catch (error) {
      console.error('Error saving token balance setting:', error);
      toast.error('Failed to update setting');
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      onLogout?.();
      // Navigate to home page
      window.location.href = '/';
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const sections = [
    { id: 'profile', label: 'My Profile', icon: UserCircleIcon },
    { id: 'settings', label: 'Settings', icon: CogIcon },
    ...(isCreator ? [
      { id: 'analytics', label: 'Analytics', icon: ChartBarIcon }
    ] : []),
    { id: 'notifications', label: 'Notifications', icon: BellIcon },
    { id: 'privacy', label: 'Privacy & Security', icon: ShieldCheckIcon },
    ...(!isCreator ? [
      { id: 'become-creator', label: 'Become a Creator', icon: StarIcon }
    ] : [])
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 dark:from-indigo-600 dark:to-purple-700 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold mb-2">
              @{username || 'Loading...'}
            </h1>
            <div className="flex items-center gap-4">
              <span className="bg-white/20 px-3 py-1 rounded-full text-sm">
                {isCreator ? 'Creator' : 'Fan'}
              </span>
            </div>
          </div>
          
          <button
            onClick={handleLogout}
            className="bg-white/20 hover:bg-white/30 p-3 rounded-xl transition-colors"
            title="Sign Out"
          >
            <ArrowRightOnRectangleIcon className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Section Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-8">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`flex items-center gap-2 py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                activeSection === section.id
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              <section.icon className="w-5 h-5" />
              {section.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="min-h-96">
        {activeSection === 'profile' && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <ImprovedProfile user={user} isCreator={isCreator} />
          </div>
        )}

        {activeSection === 'settings' && (
          <div className="space-y-6">
            {/* Privacy Settings */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-xl font-semibold mb-6 text-gray-900 dark:text-white">Privacy Settings</h2>
              
              <div className="space-y-4">
                <div className="flex items-start justify-between py-4 border-b border-gray-100 dark:border-gray-700">
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900 dark:text-white">Show Token Balance</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Allow other users to see your token balance on your profile</p>
                  </div>
                  <label className="inline-flex relative items-center cursor-pointer ml-4">
                    <input
                      type="checkbox"
                      checked={showTokenBalance}
                      onChange={(e) => saveTokenBalanceSetting(e.target.checked)}
                      disabled={settingsSaving}
                      className="sr-only peer"
                    />
                    <div className={`relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600 ${settingsSaving ? 'opacity-50 cursor-not-allowed' : ''}`}></div>
                  </label>
                </div>
              </div>
            </div>

            {/* General Settings */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-xl font-semibold mb-6 text-gray-900 dark:text-white">General Settings</h2>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between py-4 border-b border-gray-100 dark:border-gray-700">
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">Notifications</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Manage your notification preferences</p>
                  </div>
                  <button 
                    onClick={() => setActiveSection('notifications')}
                    className="text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-medium">
                    Configure
                  </button>
                </div>
                
                <div className="flex items-center justify-between py-4 border-b border-gray-100 dark:border-gray-700">
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">Theme</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Choose your preferred theme</p>
                  </div>
                  <select className="h-10 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3">
                    <option>Light</option>
                    <option>Dark</option>
                    <option>System</option>
                  </select>
                </div>
                
                <div className="flex items-center justify-between py-4">
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">Language</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Select your preferred language</p>
                  </div>
                  <select className="h-10 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3">
                    <option>English</option>
                    <option>Spanish</option>
                    <option>French</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Account Actions */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-xl font-semibold mb-6 text-gray-900 dark:text-white">Account</h2>
              
              <div className="space-y-4">
                <button className="w-full text-left p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  <h3 className="font-medium text-gray-900 dark:text-white">Download My Data</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Export your account data and activity</p>
                </button>
                
                <button className="w-full text-left p-4 border border-red-200 dark:border-red-900 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 transition-colors text-red-600 dark:text-red-400">
                  <h3 className="font-medium text-red-600 dark:text-red-400">Delete Account</h3>
                  <p className="text-sm text-red-500 dark:text-red-400">Permanently delete your account and all data</p>
                </button>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'notifications' && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-xl font-semibold mb-6 text-gray-900 dark:text-white">Notification Preferences</h2>
            
            <div className="space-y-6">
              <div className="space-y-4">
                <h3 className="font-medium text-gray-900 dark:text-white">Email Notifications</h3>
                <label className="flex items-center justify-between">
                  <span className="text-gray-700 dark:text-gray-300">New messages</span>
                  <input type="checkbox" defaultChecked className="toggle" />
                </label>
                <label className="flex items-center justify-between">
                  <span className="text-gray-700 dark:text-gray-300">Call requests</span>
                  <input type="checkbox" defaultChecked className="toggle" />
                </label>
                <label className="flex items-center justify-between">
                  <span className="text-gray-700 dark:text-gray-300">Tips and gifts</span>
                  <input type="checkbox" defaultChecked className="toggle" />
                </label>
              </div>
              
              <div className="space-y-4">
                <h3 className="font-medium text-gray-900 dark:text-white">Push Notifications</h3>
                <label className="flex items-center justify-between">
                  <span className="text-gray-700 dark:text-gray-300">Live streams</span>
                  <input type="checkbox" defaultChecked className="toggle" />
                </label>
                <label className="flex items-center justify-between">
                  <span className="text-gray-700 dark:text-gray-300">Upcoming sessions</span>
                  <input type="checkbox" defaultChecked className="toggle" />
                </label>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'analytics' && isCreator && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <CreatorAnalytics user={user} />
          </div>
        )}

        {activeSection === 'privacy' && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-xl font-semibold mb-6 text-gray-900 dark:text-white">Privacy & Security</h2>
            
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-start justify-between py-4 border-b border-gray-100 dark:border-gray-700">
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900 dark:text-white">Profile Visibility</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Control who can see your profile</p>
                  </div>
                  <select className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2">
                    <option>Public</option>
                    <option>Followers Only</option>
                    <option>Private</option>
                  </select>
                </div>
                
                <div className="flex items-start justify-between py-4 border-b border-gray-100 dark:border-gray-700">
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900 dark:text-white">Two-Factor Authentication</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Add an extra layer of security</p>
                  </div>
                  <button className="text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-medium">
                    Enable
                  </button>
                </div>
                
                <div className="flex items-start justify-between py-4">
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900 dark:text-white">Blocked Users</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Manage your blocked users list</p>
                  </div>
                  <button className="text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-medium">
                    Manage
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'become-creator' && !isCreator && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <CreatorApplication 
              user={user}
              onClose={() => setActiveSection('profile')}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfilePage;