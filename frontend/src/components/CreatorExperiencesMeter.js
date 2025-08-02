import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  MapPinIcon,
  SparklesIcon,
  CheckCircleIcon,
  LockClosedIcon,
  TrophyIcon,
  CalendarIcon,
  UserGroupIcon,
  ArrowRightIcon,
  GlobeAltIcon,
  SunIcon,
  StarIcon
} from '@heroicons/react/24/outline';
import {
  HeartIcon,
  FireIcon
} from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';

const CreatorExperiencesMeter = ({ totalTokens = 0, onViewExperiences }) => {
  const [currentExperience, setCurrentExperience] = useState(null);
  const [nextExperience, setNextExperience] = useState(null);
  const [progress, setProgress] = useState(0);

  // Experience tiers with token requirements - showing only latest 2
  const experiences = [
    {
      id: 4,
      tier: 'gold',
      name: 'Bali Creator Villa',
      location: 'Bali, Indonesia',
      tokensRequired: 50000,
      description: '2-week luxury villa experience with top creators',
      perks: ['Private villa', 'Daily activities', 'Spa & wellness', 'Collaboration opportunities'],
      image: '/api/placeholder/300/200',
      icon: StarIcon,
      color: 'from-purple-500 to-pink-600'
    },
    {
      id: 5,
      tier: 'platinum',
      name: 'World Tour',
      location: 'Multiple Destinations',
      tokensRequired: 100000,
      description: '1-month world tour visiting 5 amazing destinations',
      perks: ['Business class flights', '5-star hotels', 'VIP experiences', 'Documentary crew'],
      image: '/api/placeholder/300/200',
      icon: TrophyIcon,
      color: 'from-yellow-400 to-orange-500'
    }
  ];

  useEffect(() => {
    // Find current and next experience based on tokens
    let current = null;
    let next = null;
    
    for (let i = 0; i < experiences.length; i++) {
      if (totalTokens >= experiences[i].tokensRequired) {
        current = experiences[i];
      } else {
        next = experiences[i];
        break;
      }
    }
    
    setCurrentExperience(current);
    setNextExperience(next);
    
    // Calculate progress to next tier
    if (next) {
      const prevTokens = current ? current.tokensRequired : 0;
      const tokensInRange = totalTokens - prevTokens;
      const rangeSize = next.tokensRequired - prevTokens;
      setProgress((tokensInRange / rangeSize) * 100);
    } else {
      setProgress(100);
    }
  }, [totalTokens]);

  const formatTokens = (tokens) => {
    if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(0)}k`;
    }
    return tokens.toLocaleString();
  };

  const getTimeToNext = () => {
    if (!nextExperience) return null;
    const tokensNeeded = nextExperience.tokensRequired - totalTokens;
    const avgDailyTokens = 500; // This would be calculated from actual data
    const daysToGoal = Math.ceil(tokensNeeded / avgDailyTokens);
    
    if (daysToGoal <= 7) return `${daysToGoal} days`;
    if (daysToGoal <= 30) return `${Math.ceil(daysToGoal / 7)} weeks`;
    return `${Math.ceil(daysToGoal / 30)} months`;
  };

  return (
    <div className="bg-gradient-to-br from-purple-900/10 via-pink-900/10 to-purple-900/10 rounded-2xl p-6 border border-purple-500/20">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl">
          <MapPinIcon className="w-6 h-6 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-900">Creator Experiences</h3>
          <p className="text-sm text-gray-600">Redeem tokens for amazing trips</p>
        </div>
      </div>


      {/* Upcoming Experiences */}
      <div className="space-y-4">
        {experiences.map((experience) => (
          <motion.div
            key={experience.id}
            whileHover={{ scale: 1.02 }}
            className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-200 cursor-pointer"
            onClick={onViewExperiences}
          >
            <div className="flex items-start gap-4">
              <div className={`p-3 bg-gradient-to-r ${experience.color} rounded-xl`}>
                <experience.icon className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-gray-900">{experience.name}</h4>
                    <p className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                      <MapPinIcon className="w-4 h-4" />
                      {experience.location}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Requires</p>
                    <p className="font-bold text-purple-600">{formatTokens(experience.tokensRequired)}</p>
                  </div>
                </div>
                <p className="text-sm text-gray-700 mt-2">{experience.description}</p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {experience.perks.slice(0, 3).map((perk, index) => (
                    <span key={index} className="text-xs px-2 py-1 bg-white/70 rounded-full text-purple-700">
                      {perk}
                    </span>
                  ))}
                  {experience.perks.length > 3 && (
                    <span className="text-xs px-2 py-1 bg-purple-100 rounded-full text-purple-700">
                      +{experience.perks.length - 3} more
                    </span>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>


      {/* Call to Action */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={onViewExperiences}
        className="w-full mt-4 px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-medium flex items-center justify-center gap-2 shadow-lg"
      >
        <SparklesIcon className="w-5 h-5" />
        Explore All Experiences
        <ArrowRightIcon className="w-4 h-4" />
      </motion.button>
    </div>
  );
};

export default CreatorExperiencesMeter;