/**
 * Experiences section component
 * @module components/ExperiencesSection
 */

import React, { useState, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GlobeAltIcon,
  MapPinIcon,
  CalendarIcon,
  UsersIcon,
  CurrencyDollarIcon,
  FunnelIcon
} from '@heroicons/react/24/outline';
import ExperienceCard from './ExperienceCard';
import ExperienceFilters from './ExperienceFilters';
import ExperienceDetailsModal from './ExperienceDetailsModal';

/**
 * Displays and manages creator experiences/trips
 */
const ExperiencesSection = memo(({
  experiences,
  user,
  onJoinExperience,
  onCreateExperience,
  onCancelBooking
}) => {
  const [selectedExperience, setSelectedExperience] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    category: 'all',
    priceRange: 'all',
    availability: 'all',
    sortBy: 'upcoming'
  });

  /**
   * Filter experiences based on criteria
   */
  const filteredExperiences = experiences.filter(exp => {
    if (filters.category !== 'all' && exp.category.toLowerCase() !== filters.category) {
      return false;
    }
    
    if (filters.priceRange !== 'all') {
      switch (filters.priceRange) {
        case 'low':
          if (exp.tokenCost > 20000) return false;
          break;
        case 'medium':
          if (exp.tokenCost <= 20000 || exp.tokenCost > 35000) return false;
          break;
        case 'high':
          if (exp.tokenCost <= 35000) return false;
          break;
      }
    }
    
    if (filters.availability === 'available' && exp.participants >= exp.maxParticipants) {
      return false;
    }
    
    return true;
  });

  /**
   * Sort experiences
   */
  const sortedExperiences = [...filteredExperiences].sort((a, b) => {
    switch (filters.sortBy) {
      case 'upcoming':
        return new Date(a.dates) - new Date(b.dates);
      case 'price-low':
        return a.tokenCost - b.tokenCost;
      case 'price-high':
        return b.tokenCost - a.tokenCost;
      case 'availability':
        return (b.maxParticipants - b.participants) - (a.maxParticipants - a.participants);
      default:
        return 0;
    }
  });

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <GlobeAltIcon className="w-7 h-7" />
              Creator Experiences
            </h2>
            <p className="text-gray-400 mt-1">
              Join exclusive trips and experiences with fellow creators
            </p>
          </div>
          
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="px-4 py-2 bg-gray-800 text-gray-400 hover:text-white rounded-lg flex items-center gap-2 transition-colors"
          >
            <FunnelIcon className="w-4 h-4" />
            Filters
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-800 rounded-lg p-4">
            <p className="text-gray-400 text-sm">Available Experiences</p>
            <p className="text-2xl font-bold text-white">{sortedExperiences.length}</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <p className="text-gray-400 text-sm">Total Spots</p>
            <p className="text-2xl font-bold text-white">
              {sortedExperiences.reduce((sum, exp) => sum + (exp.maxParticipants - exp.participants), 0)}
            </p>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <p className="text-gray-400 text-sm">Average Cost</p>
            <p className="text-2xl font-bold text-white">
              {Math.round(sortedExperiences.reduce((sum, exp) => sum + exp.tokenCost, 0) / sortedExperiences.length || 0).toLocaleString()}
            </p>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <p className="text-gray-400 text-sm">Next Experience</p>
            <p className="text-2xl font-bold text-white">
              {sortedExperiences[0]?.dates?.split(',')[0] || 'TBA'}
            </p>
          </div>
        </div>
      </div>

      {/* Filters panel */}
      <AnimatePresence>
        {showFilters && (
          <ExperienceFilters
            filters={filters}
            onFiltersChange={setFilters}
            onClose={() => setShowFilters(false)}
          />
        )}
      </AnimatePresence>

      {/* Experiences grid */}
      {sortedExperiences.length === 0 ? (
        <div className="text-center py-12">
          <GlobeAltIcon className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No experiences found</h3>
          <p className="text-gray-400">Try adjusting your filters or check back for new experiences</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence>
            {sortedExperiences.map((experience, index) => (
              <motion.div
                key={experience.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ delay: index * 0.05 }}
              >
                <ExperienceCard
                  experience={experience}
                  user={user}
                  onSelect={() => setSelectedExperience(experience)}
                  onJoin={onJoinExperience}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Experience details modal */}
      <AnimatePresence>
        {selectedExperience && (
          <ExperienceDetailsModal
            experience={selectedExperience}
            user={user}
            onClose={() => setSelectedExperience(null)}
            onJoin={onJoinExperience}
            onCancel={onCancelBooking}
          />
        )}
      </AnimatePresence>
    </div>
  );
});

ExperiencesSection.displayName = 'ExperiencesSection';

export default ExperiencesSection;