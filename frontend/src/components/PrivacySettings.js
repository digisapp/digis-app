import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getAuthToken } from '../utils/auth-helpers';

const PrivacySettings = ({ user, onClose }) => {
  const [activeTab, setActiveTab] = useState('privacy');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState(null);
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [securityActivity, setSecurityActivity] = useState([]);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);

  // Privacy tabs
  const privacyTabs = [
    { id: 'privacy', label: 'Privacy', icon: '🔒' },
    { id: 'security', label: 'Security', icon: '🛡️' },
    { id: 'blocked', label: 'Blocked Users', icon: '🚫' },
    { id: 'activity', label: 'Activity Log', icon: '📋' },
    { id: 'data', label: 'Data & Privacy', icon: '📊' }
  ];

  useEffect(() => {
    loadPrivacyData();
  }, []);

  const loadPrivacyData = async () => {
    setLoading(true);
    try {
      const authToken = await getAuthToken();
      
      // Load all privacy data in parallel
      const [settingsRes, blockedRes, activityRes] = await Promise.all([
        fetch(`${import.meta.env.VITE_BACKEND_URL}/api/privacy/settings`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        }),
        fetch(`${import.meta.env.VITE_BACKEND_URL}/api/privacy/blocked`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        }),
        fetch(`${import.meta.env.VITE_BACKEND_URL}/api/privacy/activity?limit=10`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        })
      ]);

      if (settingsRes.ok) {
        const data = await settingsRes.json();
        setSettings(data.settings);
        setTwoFactorEnabled(data.settings.twoFactorAuth?.enabled || false);
      }

      if (blockedRes.ok) {
        const data = await blockedRes.json();
        setBlockedUsers(data.blockedUsers);
      }

      if (activityRes.ok) {
        const data = await activityRes.json();
        setSecurityActivity(data.activities);
      }

    } catch (error) {
      console.error('❌ Error loading privacy data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSettingChange = (category, key, value) => {
    setSettings(prev => ({
      ...prev,
      [category]: typeof prev[category] === 'object' 
        ? { ...prev[category], [key]: value }
        : value
    }));
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const authToken = await getAuthToken();
      
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/privacy/settings`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ settings })
      });

      if (response.ok) {
        // Show success message
        console.log('✅ Privacy settings saved successfully');
      }
    } catch (error) {
      console.error('❌ Error saving privacy settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const unblockUser = async (userId) => {
    try {
      const authToken = await getAuthToken();
      
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/privacy/unblock`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ targetUserId: userId })
      });

      if (response.ok) {
        setBlockedUsers(prev => prev.filter(user => user.id !== userId));
      }
    } catch (error) {
      console.error('❌ Error unblocking user:', error);
    }
  };

  const toggle2FA = async () => {
    try {
      const authToken = await getAuthToken();
      const endpoint = twoFactorEnabled ? 'disable' : 'enable';
      
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/privacy/2fa/${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ method: 'sms', phoneNumber: '+1234567890' })
      });

      if (response.ok) {
        setTwoFactorEnabled(!twoFactorEnabled);
        loadPrivacyData(); // Reload data
      }
    } catch (error) {
      console.error('❌ Error toggling 2FA:', error);
    }
  };

  const PrivacyTab = () => (
    <div style={{ padding: '24px' }}>
      <h3 style={{ margin: '0 0 24px 0', fontSize: '20px', fontWeight: 'bold' }}>
        Privacy Settings
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Profile Visibility */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            backgroundColor: '#fff',
            padding: '24px',
            borderRadius: '16px',
            border: '1px solid #e1e5e9'
          }}
        >
          <h4 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 'bold' }}>
            Profile Visibility
          </h4>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[
              { value: 'public', label: 'Public', desc: 'Anyone can see your profile' },
              { value: 'followers_only', label: 'Followers Only', desc: 'Only your followers can see your full profile' },
              { value: 'subscribers_only', label: 'Subscribers Only', desc: 'Only subscribers can see your profile' },
              { value: 'private', label: 'Private', desc: 'Only you can see your profile' }
            ].map((option) => (
              <label key={option.value} style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '12px', 
                cursor: 'pointer',
                padding: '12px',
                borderRadius: '8px',
                backgroundColor: settings?.profileVisibility === option.value ? '#f0f8ff' : 'transparent',
                border: settings?.profileVisibility === option.value ? '1px solid #007bff' : '1px solid transparent'
              }}>
                <input
                  type="radio"
                  name="profileVisibility"
                  value={option.value}
                  checked={settings?.profileVisibility === option.value}
                  onChange={(e) => handleSettingChange('profileVisibility', null, e.target.value)}
                />
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '500' }}>{option.label}</div>
                  <div style={{ fontSize: '12px', color: '#666' }}>{option.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </motion.div>

        {/* Message Privacy */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          style={{
            backgroundColor: '#fff',
            padding: '24px',
            borderRadius: '16px',
            border: '1px solid #e1e5e9'
          }}
        >
          <h4 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 'bold' }}>
            Messaging & Communication
          </h4>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={settings?.allowDirectMessages || false}
                onChange={(e) => handleSettingChange('allowDirectMessages', null, e.target.checked)}
              />
              <div>
                <div style={{ fontSize: '14px', fontWeight: '500' }}>Allow Direct Messages</div>
                <div style={{ fontSize: '12px', color: '#666' }}>Let others send you private messages</div>
              </div>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={settings?.requireFollowApproval || false}
                onChange={(e) => handleSettingChange('requireFollowApproval', null, e.target.checked)}
              />
              <div>
                <div style={{ fontSize: '14px', fontWeight: '500' }}>Require Follow Approval</div>
                <div style={{ fontSize: '12px', color: '#666' }}>You'll need to approve new followers manually</div>
              </div>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={settings?.showOnlineStatus || false}
                onChange={(e) => handleSettingChange('showOnlineStatus', null, e.target.checked)}
              />
              <div>
                <div style={{ fontSize: '14px', fontWeight: '500' }}>Show Online Status</div>
                <div style={{ fontSize: '12px', color: '#666' }}>Let others see when you're online</div>
              </div>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={settings?.allowTips || false}
                onChange={(e) => handleSettingChange('allowTips', null, e.target.checked)}
              />
              <div>
                <div style={{ fontSize: '14px', fontWeight: '500' }}>Allow Tips</div>
                <div style={{ fontSize: '12px', color: '#666' }}>Let viewers send you tips during streams</div>
              </div>
            </label>
          </div>
        </motion.div>

        {/* Content Visibility */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          style={{
            backgroundColor: '#fff',
            padding: '24px',
            borderRadius: '16px',
            border: '1px solid #e1e5e9'
          }}
        >
          <h4 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 'bold' }}>
            Content & Stats Visibility
          </h4>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={settings?.showSubscriberCount || false}
                onChange={(e) => handleSettingChange('showSubscriberCount', null, e.target.checked)}
              />
              <div>
                <div style={{ fontSize: '14px', fontWeight: '500' }}>Show Subscriber Count</div>
                <div style={{ fontSize: '12px', color: '#666' }}>Display your subscriber count publicly</div>
              </div>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={settings?.showFollowerCount || false}
                onChange={(e) => handleSettingChange('showFollowerCount', null, e.target.checked)}
              />
              <div>
                <div style={{ fontSize: '14px', fontWeight: '500' }}>Show Follower Count</div>
                <div style={{ fontSize: '12px', color: '#666' }}>Display your follower count publicly</div>
              </div>
            </label>
          </div>
        </motion.div>
      </div>
    </div>
  );

  const SecurityTab = () => (
    <div style={{ padding: '24px' }}>
      <h3 style={{ margin: '0 0 24px 0', fontSize: '20px', fontWeight: 'bold' }}>
        Security Settings
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Two-Factor Authentication */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            backgroundColor: '#fff',
            padding: '24px',
            borderRadius: '16px',
            border: '1px solid #e1e5e9'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h4 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>
              Two-Factor Authentication
            </h4>
            <button
              onClick={toggle2FA}
              style={{
                padding: '8px 16px',
                backgroundColor: twoFactorEnabled ? '#dc3545' : '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              {twoFactorEnabled ? 'Disable' : 'Enable'}
            </button>
          </div>
          
          <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#666' }}>
            Add an extra layer of security to your account by requiring a verification code when signing in.
          </p>

          <div style={{
            padding: '16px',
            backgroundColor: twoFactorEnabled ? '#d4edda' : '#fff3cd',
            borderRadius: '8px',
            border: `1px solid ${twoFactorEnabled ? '#c3e6cb' : '#ffeaa7'}`
          }}>
            <div style={{ 
              fontSize: '14px', 
              fontWeight: '500',
              color: twoFactorEnabled ? '#155724' : '#856404'
            }}>
              {twoFactorEnabled ? '✅ 2FA is enabled' : '⚠️ 2FA is disabled'}
            </div>
            <div style={{ 
              fontSize: '12px', 
              marginTop: '4px',
              color: twoFactorEnabled ? '#155724' : '#856404'
            }}>
              {twoFactorEnabled 
                ? 'Your account is protected with two-factor authentication'
                : 'Your account is not protected by two-factor authentication'
              }
            </div>
          </div>
        </motion.div>

        {/* Session Management */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          style={{
            backgroundColor: '#fff',
            padding: '24px',
            borderRadius: '16px',
            border: '1px solid #e1e5e9'
          }}
        >
          <h4 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 'bold' }}>
            Session Management
          </h4>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
                Auto-logout after (minutes)
              </label>
              <select
                value={settings?.sessionSettings?.autoLogoutMinutes || 30}
                onChange={(e) => handleSettingChange('sessionSettings', 'autoLogoutMinutes', parseInt(e.target.value))}
                style={{
                  padding: '8px 12px',
                  border: '1px solid #e1e5e9',
                  borderRadius: '8px',
                  fontSize: '14px'
                }}
              >
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={60}>1 hour</option>
                <option value={120}>2 hours</option>
                <option value={480}>8 hours</option>
                <option value={1440}>24 hours</option>
              </select>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={settings?.sessionSettings?.requireReauth || false}
                onChange={(e) => handleSettingChange('sessionSettings', 'requireReauth', e.target.checked)}
              />
              <div>
                <div style={{ fontSize: '14px', fontWeight: '500' }}>Require Re-authentication</div>
                <div style={{ fontSize: '12px', color: '#666' }}>Require password for sensitive actions</div>
              </div>
            </label>
          </div>
        </motion.div>

        {/* Account Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          style={{
            backgroundColor: '#fff',
            padding: '24px',
            borderRadius: '16px',
            border: '1px solid #e1e5e9'
          }}
        >
          <h4 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 'bold' }}>
            Account Actions
          </h4>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button style={{
              padding: '12px 16px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              textAlign: 'left'
            }}>
              🔑 Change Password
            </button>
            
            <button style={{
              padding: '12px 16px',
              backgroundColor: '#ffc107',
              color: '#000',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              textAlign: 'left'
            }}>
              📧 Update Email Address
            </button>
            
            <button style={{
              padding: '12px 16px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              textAlign: 'left'
            }}>
              🗑️ Delete Account
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );

  const BlockedUsersTab = () => (
    <div style={{ padding: '24px' }}>
      <h3 style={{ margin: '0 0 24px 0', fontSize: '20px', fontWeight: 'bold' }}>
        Blocked Users
      </h3>

      {blockedUsers.length === 0 ? (
        <div style={{
          backgroundColor: '#f8f9fa',
          padding: '40px',
          borderRadius: '16px',
          textAlign: 'center',
          border: '1px solid #e1e5e9'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🚫</div>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 'bold' }}>
            No Blocked Users
          </h4>
          <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>
            You haven't blocked any users yet.
          </p>
        </div>
      ) : (
        <div style={{
          backgroundColor: '#fff',
          borderRadius: '16px',
          border: '1px solid #e1e5e9',
          overflow: 'hidden'
        }}>
          {blockedUsers.map((blockedUser, index) => (
            <motion.div
              key={blockedUser.uid}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              style={{
                padding: '16px 24px',
                borderBottom: index < blockedUsers.length - 1 ? '1px solid #f0f0f0' : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  backgroundColor: '#f0f0f0',
                  backgroundImage: blockedUser.profilePicture ? `url(${blockedUser.profilePicture})` : 'none',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '16px'
                }}>
                  {!blockedUser.profilePicture && '👤'}
                </div>
                
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '500' }}>
                    {blockedUser.displayName}
                  </div>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    @{blockedUser.username}
                  </div>
                </div>
              </div>

              <button
                onClick={() => unblockUser(blockedUser.uid)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                Unblock
              </button>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );

  const ActivityLogTab = () => (
    <div style={{ padding: '24px' }}>
      <h3 style={{ margin: '0 0 24px 0', fontSize: '20px', fontWeight: 'bold' }}>
        Security Activity
      </h3>

      <div style={{
        backgroundColor: '#fff',
        borderRadius: '16px',
        border: '1px solid #e1e5e9',
        overflow: 'hidden'
      }}>
        {securityActivity.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
            <div style={{ fontSize: '16px', marginBottom: '8px' }}>No recent activity</div>
            <div style={{ fontSize: '14px' }}>
              Your security activity will appear here
            </div>
          </div>
        ) : (
          securityActivity.map((activity, index) => (
            <motion.div
              key={activity.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              style={{
                padding: '16px 24px',
                borderBottom: index < securityActivity.length - 1 ? '1px solid #f0f0f0' : 'none'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>
                    {getActivityTitle(activity.event)}
                  </div>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    {new Date(activity.timestamp).toLocaleString()}
                  </div>
                </div>
                
                <div style={{
                  padding: '4px 8px',
                  backgroundColor: getActivityColor(activity.event),
                  color: 'white',
                  borderRadius: '12px',
                  fontSize: '10px',
                  fontWeight: 'bold'
                }}>
                  {getActivityIcon(activity.event)}
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );

  const DataPrivacyTab = () => (
    <div style={{ padding: '24px' }}>
      <h3 style={{ margin: '0 0 24px 0', fontSize: '20px', fontWeight: 'bold' }}>
        Data & Privacy
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Data Collection */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            backgroundColor: '#fff',
            padding: '24px',
            borderRadius: '16px',
            border: '1px solid #e1e5e9'
          }}
        >
          <h4 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 'bold' }}>
            Data Collection Preferences
          </h4>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={settings?.dataCollection?.analytics || false}
                onChange={(e) => handleSettingChange('dataCollection', 'analytics', e.target.checked)}
              />
              <div>
                <div style={{ fontSize: '14px', fontWeight: '500' }}>Analytics Data</div>
                <div style={{ fontSize: '12px', color: '#666' }}>Help improve the platform with usage analytics</div>
              </div>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={settings?.dataCollection?.marketing || false}
                onChange={(e) => handleSettingChange('dataCollection', 'marketing', e.target.checked)}
              />
              <div>
                <div style={{ fontSize: '14px', fontWeight: '500' }}>Marketing Communications</div>
                <div style={{ fontSize: '12px', color: '#666' }}>Receive personalized recommendations and offers</div>
              </div>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={settings?.dataCollection?.thirdParty || false}
                onChange={(e) => handleSettingChange('dataCollection', 'thirdParty', e.target.checked)}
              />
              <div>
                <div style={{ fontSize: '14px', fontWeight: '500' }}>Third-Party Sharing</div>
                <div style={{ fontSize: '12px', color: '#666' }}>Allow data sharing with trusted partners</div>
              </div>
            </label>
          </div>
        </motion.div>

        {/* Data Export & Deletion */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          style={{
            backgroundColor: '#fff',
            padding: '24px',
            borderRadius: '16px',
            border: '1px solid #e1e5e9'
          }}
        >
          <h4 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 'bold' }}>
            Data Management
          </h4>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button style={{
              padding: '12px 16px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              textAlign: 'left'
            }}>
              📥 Download My Data
            </button>
            
            <button style={{
              padding: '12px 16px',
              backgroundColor: '#ffc107',
              color: '#000',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              textAlign: 'left'
            }}>
              🗑️ Request Data Deletion
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );

  const getActivityTitle = (event) => {
    const titles = {
      'LOGIN': 'Account Login',
      'LOGOUT': 'Account Logout',
      'PASSWORD_CHANGED': 'Password Changed',
      'EMAIL_CHANGED': 'Email Changed',
      'PRIVACY_SETTINGS_UPDATED': 'Privacy Settings Updated',
      'USER_BLOCKED': 'User Blocked',
      'USER_UNBLOCKED': 'User Unblocked',
      '2FA_ENABLED': 'Two-Factor Authentication Enabled',
      '2FA_DISABLED': 'Two-Factor Authentication Disabled',
      'REPORT_SUBMITTED': 'Report Submitted'
    };
    return titles[event] || event;
  };

  const getActivityIcon = (event) => {
    const icons = {
      'LOGIN': '🔓',
      'LOGOUT': '🔒',
      'PASSWORD_CHANGED': '🔑',
      'EMAIL_CHANGED': '📧',
      'PRIVACY_SETTINGS_UPDATED': '⚙️',
      'USER_BLOCKED': '🚫',
      'USER_UNBLOCKED': '✅',
      '2FA_ENABLED': '🛡️',
      '2FA_DISABLED': '⚠️',
      'REPORT_SUBMITTED': '📝'
    };
    return icons[event] || '📋';
  };

  const getActivityColor = (event) => {
    const colors = {
      'LOGIN': '#28a745',
      'LOGOUT': '#6c757d',
      'PASSWORD_CHANGED': '#007bff',
      'EMAIL_CHANGED': '#007bff',
      'PRIVACY_SETTINGS_UPDATED': '#007bff',
      'USER_BLOCKED': '#dc3545',
      'USER_UNBLOCKED': '#28a745',
      '2FA_ENABLED': '#28a745',
      '2FA_DISABLED': '#ffc107',
      'REPORT_SUBMITTED': '#6f42c1'
    };
    return colors[event] || '#6c757d';
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'privacy':
        return <PrivacyTab />;
      case 'security':
        return <SecurityTab />;
      case 'blocked':
        return <BlockedUsersTab />;
      case 'activity':
        return <ActivityLogTab />;
      case 'data':
        return <DataPrivacyTab />;
      default:
        return <PrivacyTab />;
    }
  };

  if (loading) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{
            backgroundColor: '#fff',
            padding: '40px',
            borderRadius: '16px',
            textAlign: 'center'
          }}
        >
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid #f3f3f3',
            borderTop: '4px solid #007bff',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }} />
          <div>Loading Privacy Settings...</div>
        </motion.div>
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        style={{
          backgroundColor: '#fff',
          borderRadius: '24px',
          width: '100%',
          maxWidth: '1200px',
          maxHeight: '90vh',
          display: 'flex',
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
        }}
      >
        {/* Sidebar */}
        <div style={{
          width: '250px',
          backgroundColor: '#f8f9fa',
          borderRight: '1px solid #e1e5e9',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* Header */}
          <div style={{
            padding: '24px',
            borderBottom: '1px solid #e1e5e9'
          }}>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold' }}>
              🔐 Privacy & Security
            </h2>
          </div>

          {/* Navigation */}
          <div style={{ flex: 1, padding: '16px 0' }}>
            {privacyTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  width: '100%',
                  padding: '12px 24px',
                  backgroundColor: activeTab === tab.id ? '#007bff' : 'transparent',
                  color: activeTab === tab.id ? 'white' : '#666',
                  border: 'none',
                  textAlign: 'left',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s ease'
                }}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Save and Close buttons */}
          <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button
              onClick={saveSettings}
              disabled={saving}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.7 : 1
              }}
            >
              {saving ? '💾 Saving...' : '💾 Save Changes'}
            </button>
            
            <button
              onClick={onClose}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              Close
            </button>
          </div>
        </div>

        {/* Main content */}
        <div style={{
          flex: 1,
          backgroundColor: '#fff',
          overflowY: 'auto'
        }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {renderTabContent()}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default PrivacySettings;