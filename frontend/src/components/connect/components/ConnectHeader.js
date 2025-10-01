/**
 * Connect page header component
 * @module components/ConnectHeader
 */

import React, { memo } from 'react';
import { motion } from 'framer-motion';
import {
  GlobeAltIcon,
  SparklesIcon,
  PlusIcon
} from '@heroicons/react/24/outline';

/**
 * Header with section navigation for Connect page
 */
const ConnectHeader = memo(({
  activeSection,
  onSectionChange,
  user,
  isCreator
}) => {
  const sections = [
    { id: 'travel', label: 'Experiences', icon: GlobeAltIcon },
    { id: 'collaborate', label: 'Collaboration Hub', icon: SparklesIcon }
  ];

  return (
    <div className="bg-gray-800 border-b border-gray-700">
      <div className="max-w-7xl mx-auto px-4">
        {/* Page title */}
        <div className="py-6">
          <h1 className="text-3xl font-bold text-white">Connect & Collaborate</h1>
          <p className="mt-2 text-gray-400">
            {activeSection === 'travel' 
              ? 'Join exclusive creator experiences and trips'
              : 'Find collaboration opportunities with other creators'
            }
          </p>
        </div>

        {/* Section tabs */}
        <div className="flex items-center justify-between">
          <div className="flex space-x-1">
            {sections.map((section) => {
              const Icon = section.icon;
              const isActive = activeSection === section.id;
              
              return (
                <button
                  key={section.id}
                  onClick={() => onSectionChange(section.id)}
                  className={`relative px-4 py-3 flex items-center gap-2 font-medium transition-colors ${
                    isActive
                      ? 'text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{section.label}</span>
                  
                  {/* Active indicator */}
                  {isActive && (
                    <motion.div
                      layoutId="activeSection"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500"
                      initial={false}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Create button for creators */}
          {isCreator && (
            <button
              className="mb-3 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg font-medium flex items-center gap-2 transition-colors"
            >
              <PlusIcon className="w-5 h-5" />
              Create {activeSection === 'travel' ? 'Experience' : 'Collaboration'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

ConnectHeader.displayName = 'ConnectHeader';

export default ConnectHeader;