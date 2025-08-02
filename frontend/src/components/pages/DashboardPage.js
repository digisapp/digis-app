import React, { useState } from 'react';
import CreatorToolsQuickAccess from '../CreatorToolsQuickAccess';
import EnhancedCreatorDashboard from '../EnhancedCreatorDashboard';
import PersonalizedRecommendations from '../PersonalizedRecommendations';
import FollowingSystem from '../FollowingSystem';
import PurchasedContentLibrary from '../PurchasedContentLibrary';
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
  onShowContent,
  onShowOffers,
  onShowSettings,
  onShowExperiences
}) => {
  const [activeTab, setActiveTab] = useState('discover');

  const fanTabs = [
    { id: 'discover', label: 'Discover', icon: StarIcon },
    { id: 'following', label: 'Following', icon: HeartIcon },
    { id: 'library', label: 'My Library', icon: FolderOpenIcon },
    { id: 'schedule', label: 'Schedule', icon: CalendarDaysIcon }
  ];

  if (isCreator) {
    return (
      <EnhancedCreatorDashboard 
        user={user}
        onNavigate={(path) => {
          if (path === '/connect?section=experiences') {
            // Use the onShowExperiences prop which properly navigates
            if (onShowExperiences) {
              onShowExperiences();
            }
          } else {
            console.log('Navigate to:', path);
          }
        }}
        onShowGoLive={onShowGoLive}
        onShowAvailability={onShowAvailability}
        onShowEarnings={onShowEarnings}
        onShowContent={onShowContent}
        onShowOffers={onShowOffers}
        onShowSettings={onShowSettings}
        onShowExperiences={onShowExperiences}
        tokenBalance={tokenBalance}
        sessionStats={sessionStats}
      />
    );
  }

  // Fan Dashboard
  return (
    <div className="space-y-8">
      {/* Explore Header Section */}
      <div className="bg-gradient-to-r from-purple-500 to-pink-600 rounded-2xl p-8 text-white">
        <h1 className="text-3xl font-bold mb-2">
          Explore
        </h1>
        <p className="text-purple-100">
          Discover amazing creators and start your next session.
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          {fanTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
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