import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase-auth.js';

// Upload profile image to Supabase storage via API
const uploadProfileImage = async (file, userId) => {
  const formData = new FormData();
  formData.append('file', file);
  
  const { data: { session } } = await supabase.auth.getSession();
  const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/users/upload-profile-image`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session?.access_token}`
    },
    body: formData
  });
  
  if (!response.ok) {
    throw new Error('Failed to upload image');
  }
  
  const data = await response.json();
  return data.url;
};

const Profile = ({ user, onLogout }) => {
  const [bio, setBio] = useState('');
  const [pic, setPic] = useState('');
  const [streamPrice, setStreamPrice] = useState(5);
  const [videoPrice, setVideoPrice] = useState(8);
  const [voicePrice, setVoicePrice] = useState(6);
  const [messagePrice, setMessagePrice] = useState(2);
  const [isCreator, setIsCreator] = useState(false);
  const [username, setUsername] = useState('');
  const [showTokenBalance, setShowTokenBalance] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [previewImage, setPreviewImage] = useState('');
  const [activeTab, setActiveTab] = useState('profile');
  const [transactions, setTransactions] = useState([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);

  useEffect(() => {
    loadProfile();
  }, [user]);

  useEffect(() => {
    if (activeTab === 'transactions' && isCreator) {
      loadTransactions();
    }
  }, [activeTab, isCreator]);

  const loadProfile = async () => {
    setLoading(true);
    setError('');
    
    try {
      console.log('🔄 Loading profile for user:', user.id);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/users/profile?uid=${user.id}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Profile loaded:', data);
        setProfile(data);
        setBio(data.bio || '');
        setPic(data.profile_pic_url || '');
        setStreamPrice(data.stream_price || 5);
        setVideoPrice(data.video_price || 8);
        setVoicePrice(data.voice_price || 6);
        setMessagePrice(data.message_price || 2);
        setIsCreator(data.is_creator || false);
        setUsername(data.username || '');
        setShowTokenBalance(data.show_token_balance || false);
        setPreviewImage(data.profile_pic_url || '');
      } else {
        console.log('ℹ️ No existing profile found');
      }
    } catch (error) {
      console.error('❌ Error loading profile:', error);
      setError('Failed to load profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadTransactions = async () => {
    setTransactionsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/transactions?uid=${user.id}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setTransactions(data.transactions || []);
      } else {
        // Mock data for development
        setTransactions([
          {
            id: 1,
            type: 'earning',
            description: 'Video call with SuperFan123',
            amount: 240,
            date: new Date(Date.now() - 3600000),
            status: 'completed',
            category: 'video_call',
            user: 'SuperFan123'
          },
          {
            id: 2,
            type: 'expense',
            description: 'Token purchase',
            amount: -1000,
            date: new Date(Date.now() - 86400000),
            status: 'completed',
            category: 'token_purchase',
            paymentMethod: 'Credit Card'
          },
          {
            id: 3,
            type: 'earning',
            description: 'Live stream earnings',
            amount: 450,
            date: new Date(Date.now() - 86400000 * 2),
            status: 'completed',
            category: 'live_stream',
            viewers: 15
          },
          {
            id: 4,
            type: 'earning',
            description: 'Voice call with MusicLover',
            amount: 180,
            date: new Date(Date.now() - 86400000 * 3),
            status: 'completed',
            category: 'voice_call',
            user: 'MusicLover'
          },
          {
            id: 5,
            type: 'expense',
            description: 'Video call with Emma Creates',
            amount: -320,
            date: new Date(Date.now() - 86400000 * 4),
            status: 'completed',
            category: 'video_call',
            creator: 'Emma Creates'
          },
          {
            id: 6,
            type: 'earning',
            description: 'Tips received',
            amount: 50,
            date: new Date(Date.now() - 86400000 * 5),
            status: 'completed',
            category: 'tips',
            user: 'ArtEnthusiast'
          }
        ]);
      }
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setTransactionsLoading(false);
    }
  };

  const validateProfile = () => {
    if (isCreator && (streamPrice <= 0 || videoPrice <= 0 || voicePrice <= 0 || messagePrice <= 0)) {
      setError('All prices must be greater than 0 for creators');
      return false;
    }
    if (bio.length > 500) {
      setError('Bio must be less than 500 characters');
      return false;
    }
    if (pic && !isValidUrl(pic)) {
      setError('Invalid profile picture URL');
      return false;
    }
    if (username) {
      if (username.length < 3 || username.length > 50) {
        setError('Username must be between 3 and 50 characters');
        return false;
      }
      if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        setError('Username can only contain letters, numbers, and underscores');
        return false;
      }
    }
    return true;
  };

  const isValidUrl = (string) => {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      setError('Please upload a valid image (JPG, PNG, or GIF)');
      return;
    }

    // Validate file size (e.g., max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB in bytes
    if (file.size > maxSize) {
      setError('Image size must be less than 5MB');
      return;
    }

    setSaving(true);
    setError('');
    
    try {
      // Supabase storage handled via API
      // File upload handled via API
      // Upload handled via API
      const url = await uploadProfileImage(file, user.id);
      setPic(url);
      setPreviewImage(url);
      setSuccess('Image uploaded successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('❌ Error uploading image:', error);
      setError('Failed to upload image. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const saveProfile = async () => {
    if (!validateProfile()) return;

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      console.log('🔄 Saving profile...');
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/users/profile`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ 
          uid: user.id, 
          isCreator, 
          bio: bio.trim(), 
          profilePic: pic.trim(), 
          streamPrice: parseFloat(streamPrice) || 5,
          videoPrice: parseFloat(videoPrice) || 8,
          voicePrice: parseFloat(voicePrice) || 6,
          messagePrice: parseFloat(messagePrice) || 2,
          username: username.trim(),
          showTokenBalance
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Profile saved successfully:', result);
        setProfile(result.user);
        setSuccess('Profile saved successfully!');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save profile');
      }
    } catch (error) {
      console.error('❌ Error saving profile:', error);
      setError(error.message || 'Failed to save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const clearMessages = () => {
    setError('');
    setSuccess('');
  };

  if (loading) {
    return (
      <div style={{ 
        maxWidth: '800px', 
        margin: '0 auto', 
        padding: '40px',
        textAlign: 'center',
        backgroundColor: '#fff',
        borderRadius: '12px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
      }}>
        <div style={{ fontSize: '24px', marginBottom: '20px' }}>⏳</div>
        <div style={{ fontSize: '18px', color: '#666' }}>
          Loading profile...
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      maxWidth: '800px', 
      margin: '0 auto', 
      padding: '40px',
      backgroundColor: '#fff',
      borderRadius: '12px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
    }}>
      <h2 style={{ 
        marginBottom: '30px',
        color: '#333',
        textAlign: 'center',
        fontSize: '28px'
      }}>
        👤 Profile Settings
      </h2>

      {/* Tab Navigation */}
      <div style={{
        display: 'flex',
        borderBottom: '2px solid #dee2e6',
        marginBottom: '30px',
        gap: '20px'
      }}>
        <button
          onClick={() => setActiveTab('profile')}
          style={{
            padding: '10px 20px',
            backgroundColor: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'profile' ? '3px solid #007bff' : '3px solid transparent',
            color: activeTab === 'profile' ? '#007bff' : '#666',
            fontSize: '16px',
            fontWeight: activeTab === 'profile' ? '600' : '400',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          Profile
        </button>
        {isCreator && (
          <button
            onClick={() => setActiveTab('transactions')}
            style={{
              padding: '10px 20px',
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'transactions' ? '3px solid #007bff' : '3px solid transparent',
              color: activeTab === 'transactions' ? '#007bff' : '#666',
              fontSize: '16px',
              fontWeight: activeTab === 'transactions' ? '600' : '400',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            Transactions
          </button>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div style={{ 
          color: '#721c24',
          backgroundColor: '#f8d7da',
          padding: '15px',
          borderRadius: '8px',
          marginBottom: '20px',
          border: '1px solid #f5c6cb'
        }}>
          <span style={{ marginRight: '8px' }}>⚠️</span>
          {error}
          <button 
            onClick={clearMessages}
            style={{ 
              float: 'right', 
              background: 'none', 
              border: 'none', 
              fontSize: '16px',
              cursor: 'pointer',
              color: '#721c24'
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div style={{ 
          color: '#155724',
          backgroundColor: '#d4edda',
          padding: '15px',
          borderRadius: '8px',
          marginBottom: '20px',
          border: '1px solid #c3e6cb'
        }}>
          <span style={{ marginRight: '8px' }}>✅</span>
          {success}
        </div>
      )}

      {/* Profile Tab Content */}
      {activeTab === 'profile' && (
        <div style={{ 
          display: 'grid',
          gridTemplateColumns: '1fr 300px',
          gap: '40px'
        }}>
          {/* Main Form */}
          <div>
          <div style={{ marginBottom: '25px' }}>
            <label style={{ 
              display: 'flex', 
              alignItems: 'center',
              marginBottom: '20px',
              cursor: 'pointer',
              fontSize: '16px',
              padding: '15px',
              backgroundColor: '#f8f9fa',
              borderRadius: '8px',
              border: '1px solid #dee2e6'
            }}>
              <input 
                type="checkbox" 
                checked={isCreator} 
                onChange={e => {
                  setIsCreator(e.target.checked);
                  clearMessages();
                }}
                style={{ marginRight: '12px', transform: 'scale(1.3)' }}
              /> 
              <div>
                <div style={{ fontWeight: 'bold' }}>
                  I'm a Creator (I offer services to fans)
                </div>
                <div style={{ fontSize: '14px', color: '#666', marginTop: '5px' }}>
                  Creators can earn money by offering video calls, voice calls, and live streaming
                </div>
              </div>
            </label>
          </div>

          <div style={{ marginBottom: '25px' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px',
              fontWeight: 'bold',
              color: '#333',
              fontSize: '14px'
            }}>
              Username
            </label>
            <input 
              type="text" 
              value={username} 
              onChange={e => {
                setUsername(e.target.value);
                clearMessages();
              }} 
              placeholder="Enter your username"
              style={{ 
                width: '100%', 
                padding: '12px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            />
          </div>

          <div style={{ marginBottom: '25px' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px',
              fontWeight: 'bold',
              color: '#333',
              fontSize: '14px'
            }}>
              Bio
            </label>
            <textarea 
              value={bio} 
              onChange={e => {
                setBio(e.target.value);
                clearMessages();
              }} 
              placeholder="Tell us about yourself..."
              rows={4}
              style={{ 
                width: '100%', 
                padding: '12px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '14px',
                resize: 'vertical'
              }}
            />
            <div style={{ 
              fontSize: '12px', 
              color: '#666',
              marginTop: '5px'
            }}>
              {bio.length}/500 characters
            </div>
          </div>



          {activeTab === 'profile' && isCreator && (
            <div style={{ marginBottom: '25px' }}>
              <h3 style={{ 
                marginBottom: '20px',
                color: '#333',
                fontSize: '18px'
              }}>
                💰 Pricing Options (per minute)
              </h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px' }}>
                <div>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '8px',
                    fontWeight: 'bold',
                    color: '#333',
                    fontSize: '14px'
                  }}>
                    📡 Private Live Stream:
                  </label>
                  <input 
                    type="number" 
                    value={streamPrice} 
                    onChange={e => {
                      setStreamPrice(e.target.value);
                      clearMessages();
                    }} 
                    placeholder="5.00"
                    min="0.01"
                    step="0.01"
                    style={{ 
                      width: '100%', 
                      padding: '12px',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  />
                </div>
                
                <div>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '8px',
                    fontWeight: 'bold',
                    color: '#333',
                    fontSize: '14px'
                  }}>
                    📹 Video Call:
                  </label>
                  <input 
                    type="number" 
                    value={videoPrice} 
                    onChange={e => {
                      setVideoPrice(e.target.value);
                      clearMessages();
                    }} 
                    placeholder="8.00"
                    min="0.01"
                    step="0.01"
                    style={{ 
                      width: '100%', 
                      padding: '12px',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  />
                </div>
                
                <div>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '8px',
                    fontWeight: 'bold',
                    color: '#333',
                    fontSize: '14px'
                  }}>
                    📱 Voice Call:
                  </label>
                  <input 
                    type="number" 
                    value={voicePrice} 
                    onChange={e => {
                      setVoicePrice(e.target.value);
                      clearMessages();
                    }} 
                    placeholder="6.00"
                    min="0.01"
                    step="0.01"
                    style={{ 
                      width: '100%', 
                      padding: '12px',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  />
                </div>
                
                <div>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '8px',
                    fontWeight: 'bold',
                    color: '#333',
                    fontSize: '14px'
                  }}>
                    📧 Messages:
                  </label>
                  <input 
                    type="number" 
                    value={messagePrice} 
                    onChange={e => {
                      setMessagePrice(e.target.value);
                      clearMessages();
                    }} 
                    placeholder="2.00"
                    min="0.01"
                    step="0.01"
                    style={{ 
                      width: '100%', 
                      padding: '12px',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '15px', marginTop: '30px' }}>
            <button 
              onClick={saveProfile} 
              disabled={saving}
              style={{ 
                flex: 1,
                padding: '16px 20px',
                backgroundColor: saving ? '#6c757d' : '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                cursor: saving ? 'not-allowed' : 'pointer',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.2s ease'
              }}
            >
              {saving ? '⏳ Saving Profile...' : '💾 Save Profile'}
            </button>
            
            <button 
              onClick={async () => {
                try {
                  await supabase.auth.signOut();
                  if (onLogout) onLogout();
                } catch (error) {
                  console.error('Logout error:', error);
                }
              }}
              style={{ 
                padding: '16px 20px',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                cursor: 'pointer',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.2s ease',
                minWidth: '120px'
              }}
              onMouseOver={(e) => e.target.style.backgroundColor = '#c82333'}
              onMouseOut={(e) => e.target.style.backgroundColor = '#dc3545'}
            >
              🚪 Logout
            </button>
          </div>
          </div>

        {/* Preview Panel */}
        <div style={{ 
          padding: '20px',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px',
          border: '1px solid #dee2e6',
          position: 'sticky',
          top: '20px'
        }}>
          <h3 style={{ marginBottom: '20px', color: '#333' }}>👁️ Preview</h3>
          
          {/* Profile Picture Preview */}
          <div style={{ 
            textAlign: 'center',
            marginBottom: '20px'
          }}>
            <input 
              type="file"
              accept="image/jpeg,image/png,image/gif"
              onChange={handleImageUpload}
              disabled={saving}
              id="profile-pic-upload"
              style={{ display: 'none' }}
            />
            
            {previewImage && isValidUrl(previewImage) ? (
              <img 
                src={previewImage} 
                alt="Profile preview" 
                onClick={() => document.getElementById('profile-pic-upload').click()}
                style={{ 
                  width: '120px',
                  height: '120px',
                  borderRadius: '50%',
                  border: '3px solid #007bff',
                  objectFit: 'cover',
                  cursor: 'pointer',
                  transition: 'transform 0.2s ease',
                  ':hover': { transform: 'scale(1.05)' }
                }}
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
                onMouseOver={(e) => e.target.style.transform = 'scale(1.05)'}
                onMouseOut={(e) => e.target.style.transform = 'scale(1)'}
              />
            ) : (
              <div 
                onClick={() => document.getElementById('profile-pic-upload').click()}
                style={{ 
                  width: '120px',
                  height: '120px',
                  borderRadius: '50%',
                  border: '3px dashed #007bff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto',
                  fontSize: '24px',
                  color: '#007bff',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => {
                  e.target.style.backgroundColor = '#f8f9ff';
                  e.target.style.borderColor = '#0056b3';
                }}
                onMouseOut={(e) => {
                  e.target.style.backgroundColor = 'transparent';
                  e.target.style.borderColor = '#007bff';
                }}
              >
                📷
              </div>
            )}
            <div style={{ 
              fontSize: '12px', 
              color: '#666',
              marginTop: '8px'
            }}>
              Click to upload photo
            </div>
          </div>

          {/* Profile Info Preview */}
          <div style={{ 
            padding: '15px',
            backgroundColor: '#fff',
            borderRadius: '8px',
            border: '1px solid #dee2e6'
          }}>
            <div style={{ 
              marginBottom: '10px',
              fontWeight: 'bold',
              color: '#333'
            }}>
              {user.email}
              {isCreator && <span style={{ color: '#28a745', marginLeft: '8px' }}>👑</span>}
            </div>
            
            <div style={{ 
              marginBottom: '10px',
              fontSize: '14px',
              color: '#666'
            }}>
              <strong>Account Type:</strong> {isCreator ? 'Creator' : 'User'}
            </div>
            
            <div style={{ 
              marginBottom: '10px',
              fontSize: '14px',
              color: '#666'
            }}>
              <strong>Bio:</strong> {bio || 'No bio yet'}
            </div>
            
            {isCreator && (
              <div style={{ 
                fontSize: '12px',
                color: '#28a745',
                marginTop: '10px'
              }}>
                <div>📡 Stream: ${streamPrice}/min</div>
                <div>📹 Video: ${videoPrice}/min</div>
                <div>📱 Voice: ${voicePrice}/min</div>
                <div>📧 Messages: ${messagePrice}/min</div>
              </div>
            )}
          </div>
        </div>
      </div>
      )}
      
      {/* Current Profile Display */}
      {profile && (
        <div style={{ 
          marginTop: '40px', 
          padding: '25px', 
          backgroundColor: '#f8f9fa', 
          borderRadius: '8px',
          border: '1px solid #dee2e6'
        }}>
          <h3 style={{ 
            margin: '0 0 20px 0', 
            color: '#333',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            📊 Current Profile Data
          </h3>
          <div style={{ 
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '15px',
            fontSize: '14px'
          }}>
            <div>
              <strong>Account Type:</strong> {profile.is_creator ? '👑 Creator' : '👤 User'}
            </div>
            <div>
              <strong>Bio Length:</strong> {profile.bio ? profile.bio.length : 0} characters
            </div>
            {profile.is_creator && (
              <div>
                <strong>Prices:</strong> Stream ${profile.stream_price || streamPrice}/min, Video ${profile.video_price || videoPrice}/min
              </div>
            )}
            <div>
              <strong>Profile Picture:</strong> {profile.profile_pic_url ? '✅ Set' : '❌ Not Set'}
            </div>
          </div>
        </div>
      )}

      {/* Transactions Tab Content */}
      {activeTab === 'transactions' && isCreator && (
        <div style={{ width: '100%' }}>
          <div style={{
            backgroundColor: '#f8f9fa',
            borderRadius: '8px',
            padding: '20px',
            marginBottom: '20px'
          }}>
            <h3 style={{ 
              fontSize: '20px', 
              fontWeight: '600', 
              marginBottom: '20px',
              color: '#333'
            }}>
              💰 Transaction History
            </h3>

            {/* Transaction Summary */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '15px',
              marginBottom: '30px'
            }}>
              <div style={{
                backgroundColor: '#28a745',
                color: 'white',
                padding: '20px',
                borderRadius: '8px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
                  {transactions
                    .filter(t => t.type === 'earning')
                    .reduce((sum, t) => sum + t.amount, 0)
                    .toLocaleString()}
                </div>
                <div style={{ fontSize: '14px', opacity: 0.9 }}>Total Earnings</div>
              </div>
              
              <div style={{
                backgroundColor: '#dc3545',
                color: 'white',
                padding: '20px',
                borderRadius: '8px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
                  {Math.abs(transactions
                    .filter(t => t.type === 'expense')
                    .reduce((sum, t) => sum + t.amount, 0))
                    .toLocaleString()}
                </div>
                <div style={{ fontSize: '14px', opacity: 0.9 }}>Total Spent</div>
              </div>
              
              <div style={{
                backgroundColor: '#007bff',
                color: 'white',
                padding: '20px',
                borderRadius: '8px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
                  {transactions
                    .reduce((sum, t) => sum + t.amount, 0)
                    .toLocaleString()}
                </div>
                <div style={{ fontSize: '14px', opacity: 0.9 }}>Net Balance</div>
              </div>
            </div>

            {/* Transactions List */}
            {transactionsLoading ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <div style={{ fontSize: '24px', marginBottom: '10px' }}>⏳</div>
                <div>Loading transactions...</div>
              </div>
            ) : transactions.length === 0 ? (
              <div style={{ 
                textAlign: 'center', 
                padding: '40px',
                backgroundColor: '#f8f9fa',
                borderRadius: '8px'
              }}>
                <div style={{ fontSize: '48px', marginBottom: '10px' }}>📊</div>
                <div style={{ fontSize: '18px', color: '#666' }}>
                  No transactions yet
                </div>
              </div>
            ) : (
              <div style={{
                backgroundColor: 'white',
                borderRadius: '8px',
                overflow: 'hidden',
                border: '1px solid #dee2e6'
              }}>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse'
                }}>
                  <thead>
                    <tr style={{
                      backgroundColor: '#f8f9fa',
                      borderBottom: '2px solid #dee2e6'
                    }}>
                      <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Date</th>
                      <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Description</th>
                      <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Category</th>
                      <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600' }}>Amount</th>
                      <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((transaction, index) => (
                      <tr key={transaction.id} style={{
                        borderBottom: index < transactions.length - 1 ? '1px solid #dee2e6' : 'none',
                        backgroundColor: index % 2 === 0 ? 'white' : '#f8f9fa'
                      }}>
                        <td style={{ padding: '12px' }}>
                          {new Date(transaction.date).toLocaleDateString()}
                        </td>
                        <td style={{ padding: '12px' }}>
                          <div>
                            <div style={{ fontWeight: '500' }}>{transaction.description}</div>
                            {transaction.user && (
                              <div style={{ fontSize: '12px', color: '#666' }}>
                                User: {transaction.user}
                              </div>
                            )}
                            {transaction.creator && (
                              <div style={{ fontSize: '12px', color: '#666' }}>
                                Creator: {transaction.creator}
                              </div>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '12px' }}>
                          <span style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            backgroundColor: 
                              transaction.category === 'video_call' ? '#e3f2fd' :
                              transaction.category === 'voice_call' ? '#e8f5e9' :
                              transaction.category === 'live_stream' ? '#fce4ec' :
                              transaction.category === 'tips' ? '#fff3e0' :
                              transaction.category === 'token_purchase' ? '#f3e5f5' :
                              '#f5f5f5',
                            color: 
                              transaction.category === 'video_call' ? '#1976d2' :
                              transaction.category === 'voice_call' ? '#388e3c' :
                              transaction.category === 'live_stream' ? '#c2185b' :
                              transaction.category === 'tips' ? '#f57c00' :
                              transaction.category === 'token_purchase' ? '#7b1fa2' :
                              '#666'
                          }}>
                            {transaction.category.replace(/_/g, ' ').charAt(0).toUpperCase() + 
                             transaction.category.replace(/_/g, ' ').slice(1)}
                          </span>
                        </td>
                        <td style={{ 
                          padding: '12px', 
                          textAlign: 'right',
                          fontWeight: '600',
                          color: transaction.type === 'earning' ? '#28a745' : '#dc3545'
                        }}>
                          {transaction.type === 'earning' ? '+' : ''}{transaction.amount.toLocaleString()} tokens
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          <span style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            backgroundColor: 
                              transaction.status === 'completed' ? '#d4edda' :
                              transaction.status === 'pending' ? '#fff3cd' :
                              '#f8d7da',
                            color: 
                              transaction.status === 'completed' ? '#155724' :
                              transaction.status === 'pending' ? '#856404' :
                              '#721c24'
                          }}>
                            {transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;