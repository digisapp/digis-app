/**
 * Refactored Connect Page - Main orchestrator component
 * @module components/ConnectPageRefactored
 */

import React, { useState, useEffect, Suspense, lazy } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../../hooks/useApp';
import { useConnectData } from './hooks/useConnectData';
import { useCollaborations } from './hooks/useCollaborations';
import { useExperiences } from './hooks/useExperiences';
import ConnectHeader from './components/ConnectHeader';
import LoadingSpinner from '../ui/LoadingSpinner';

// Lazy load heavy components
const CollaborationHub = lazy(() => import('./components/CollaborationHub'));
const ExperiencesSection = lazy(() => import('./components/ExperiencesSection'));

/**
 * Main Connect page component - reduced from 1200+ lines to ~100 lines
 */
const ConnectPageRefactored = ({ user, isCreator }) => {
  const { state } = useApp();
  
  // Parse URL params
  const urlParams = new URLSearchParams(window.location.search);
  const sectionParam = urlParams.get('section');
  const initialSection = sectionParam === 'collaborate' ? 'collaborate' : 'travel';
  
  const [activeSection, setActiveSection] = useState(initialSection);
  
  // Use custom hooks for data management
  const { loading, error, refetchData } = useConnectData(user);
  const {
    collaborations,
    createCollaboration,
    applyToCollaboration,
    deleteCollaboration
  } = useCollaborations(user);
  
  const {
    experiences,
    joinExperience,
    createExperience,
    cancelExperienceBooking
  } = useExperiences(user);

  /**
   * Update URL when section changes
   */
  useEffect(() => {
    const newUrl = new URL(window.location);
    newUrl.searchParams.set('section', activeSection);
    window.history.pushState({}, '', newUrl);
  }, [activeSection]);

  /**
   * Error boundary
   */
  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">Error loading content</p>
          <button
            onClick={refetchData}
            className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header with section navigation */}
      <ConnectHeader
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        user={user}
        isCreator={isCreator}
      />

      {/* Main content area */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex justify-center py-12"
            >
              <LoadingSpinner />
            </motion.div>
          ) : (
            <Suspense fallback={<LoadingSpinner />}>
              {activeSection === 'collaborate' ? (
                <CollaborationHub
                  key="collaborate"
                  collaborations={collaborations}
                  user={user}
                  isCreator={isCreator}
                  onCreateCollaboration={createCollaboration}
                  onApplyToCollaboration={applyToCollaboration}
                  onDeleteCollaboration={deleteCollaboration}
                />
              ) : (
                <ExperiencesSection
                  key="travel"
                  experiences={experiences}
                  user={user}
                  onJoinExperience={joinExperience}
                  onCreateExperience={createExperience}
                  onCancelBooking={cancelExperienceBooking}
                />
              )}
            </Suspense>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default ConnectPageRefactored;