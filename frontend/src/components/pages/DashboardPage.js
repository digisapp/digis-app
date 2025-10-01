import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import CreatorToolsQuickAccess from '../CreatorToolsQuickAccess';
import HybridCreatorDashboard from '../HybridCreatorDashboard';
import MobileCreatorDashboard from '../mobile/MobileCreatorDashboard';
import MobileFanDashboard from '../mobile/MobileFanDashboard';
import PersonalizedRecommendations from '../PersonalizedRecommendations';
import FollowingSystem from '../FollowingSystem';
import PurchasedContentLibrary from '../PurchasedContentLibrary';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { BREAKPOINTS } from '../../constants/breakpoints';
import { 
  StarIcon, 
  HeartIcon,
  FolderOpenIcon,
  CalendarDaysIcon
} from '@heroicons/react/24/outline';
import ScheduleCalendar from '../ScheduleCalendar';

const DashboardPage = ({ 
  user, 
  isCreator, 
  isAdmin, 
  tokenBalance, 
  sessionStats, 
  onShowAvailability, 
  onShowGoLive,
  onCreatorSelect,
  onTipCreator,
  onStartVideoCall,
  onStartVoiceCall,
  onShowEarnings,
  onShowOffers,
  onShowSettings,
  onShowExperiences,
  onNavigate,
  contentData,
  onContentUpdate
}) => {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('discover');
  const isMobile = useMediaQuery(BREAKPOINTS.MOBILE_QUERY);
  
  // Set initial tab from URL parameters
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const tab = searchParams.get('tab');
    if (tab && ['discover', 'following', 'library', 'schedule'].includes(tab)) {
      setActiveTab(tab);
    }
  }, [location.search]);

  const fanTabs = [
    { id: 'discover', label: 'Discover', icon: StarIcon },
    { id: 'following', label: 'Following', icon: HeartIcon },
    { id: 'library', label: 'My Library', icon: FolderOpenIcon },
    { id: 'schedule', label: 'Schedule', icon: CalendarDaysIcon }
  ];

  if (isCreator) {
    // For mobile creators, show the MobileCreatorDashboard
    if (isMobile) {
      return (
        <MobileCreatorDashboard 
          user={user}
          tokenBalance={tokenBalance}
          onNavigate={onNavigate}
          onShowGoLive={onShowGoLive}
          onShowAvailability={onShowAvailability}
          onShowEarnings={onShowEarnings}
          onShowSettings={onShowSettings}
          onShowContent={() => onNavigate('content')}
          onShowMessages={() => onNavigate('messages')}
        />
      );
    }
    
    // For desktop creators, show the HybridCreatorDashboard
    return (
      <HybridCreatorDashboard 
        user={user}
        contentData={contentData}
        onContentUpdate={onContentUpdate}
        onNavigate={(path) => {
          if (path === '/connect?section=experiences') {
            // Use the onShowExperiences prop which properly navigates
            if (onShowExperiences) {
              onShowExperiences();
            }
          } else if (path === 'calls') {
            // Navigate to the calls page
            if (onNavigate) {
              onNavigate('calls');
            }
          } else {
            console.log('Navigate to:', path);
            // Try to navigate using the onNavigate prop for other views
            if (onNavigate) {
              onNavigate(path);
            }
          }
        }}
        onShowGoLive={onShowGoLive}
        onShowAvailability={onShowAvailability}
        onShowEarnings={onShowEarnings}
        onShowOffers={onShowOffers}
        onShowSettings={onShowSettings}
        onShowExperiences={onShowExperiences}
        tokenBalance={tokenBalance}
        sessionStats={sessionStats}
      />
    );
  }

  // Fan Dashboard
  if (isMobile) {
    return (
      <MobileFanDashboard
        user={user}
        tokenBalance={tokenBalance}
        onNavigate={onNavigate}
        onCreatorSelect={onCreatorSelect}
        onTipCreator={onTipCreator}
        onStartVideoCall={onStartVideoCall}
        onStartVoiceCall={onStartVoiceCall}
        onShowTokenPurchase={() => onNavigate('wallet')}
      />
    );
  }
  
  // Desktop Fan Dashboard
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
      {/* Explore Header Section */}
      <div className="bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl p-8 text-white">
        <h1 className="text-xl sm:text-2xl font-bold mb-2">
          Explore
        </h1>
        <p className="text-purple-100">
          Discover amazing creators and start your next session.
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-8">
          {fanTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <tab.icon className="w-5 h-5" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="min-h-96">
        {activeTab === 'discover' && (
          <PersonalizedRecommendations 
            user={user}
            onCreatorSelect={onCreatorSelect}
            onTipCreator={onTipCreator}
            onStartVideoCall={onStartVideoCall}
            onStartVoiceCall={onStartVoiceCall}
          />
        )}
        
        {activeTab === 'following' && (
          <FollowingSystem 
            user={user}
            onCreatorSelect={onCreatorSelect}
          />
        )}
        
        {activeTab === 'library' && (
          <PurchasedContentLibrary 
            user={user}
            onContentView={(content) => {
              console.log('Viewing content:', content);
              // Handle content viewing
            }}
          />
        )}
        
        {activeTab === 'schedule' && (
          <ScheduleCalendar 
            userType="fan"
            userId={user?.id}
            onScheduleEvent={(event) => {
              console.log('Schedule event:', event);
              // Handle event scheduling
              if (event.type === 'video-call' && onStartVideoCall) {
                // Schedule video call
              } else if (event.type === 'voice-call' && onStartVoiceCall) {
                // Schedule voice call
              }
            }}
          />
        )}
        
      </div>
    </div>
  );
};

export default DashboardPage;