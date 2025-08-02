import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPinIcon,
  SparklesIcon,
  PlusIcon,
  XMarkIcon,
  PhotoIcon,
  CurrencyDollarIcon,
  CalendarIcon,
  UserGroupIcon,
  GlobeAltIcon,
  SunIcon,
  StarIcon,
  TrophyIcon,
  ClockIcon,
  DocumentTextIcon,
  CheckIcon,
  ArrowRightIcon,
  PaperAirplaneIcon,
  HeartIcon,
  LockClosedIcon
} from '@heroicons/react/24/outline';
import ConfirmDialog from './common/ConfirmDialog';
import toast from 'react-hot-toast';
import api from '../services/api';

const CreatorExperiences = ({ user }) => {
  const [experiences, setExperiences] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedExperience, setSelectedExperience] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    type: 'warning'
  });
  
  const [newExperience, setNewExperience] = useState({
    title: '',
    description: '',
    location: '',
    proposedDate: '',
    duration: '',
    estimatedCost: '',
    maxParticipants: '',
    minParticipants: '',
    targetAudience: '',
    activities: [''],
    requirements: [''],
    whySpecial: '',
    coHosts: ['']
  });

  // Categories
  const categories = [
    { id: 'local', label: 'Local Event', icon: UserGroupIcon, color: 'from-blue-500 to-cyan-500' },
    { id: 'domestic', label: 'Domestic Trip', icon: SunIcon, color: 'from-yellow-500 to-orange-500' },
    { id: 'international', label: 'International', icon: GlobeAltIcon, color: 'from-purple-500 to-pink-500' },
    { id: 'premium', label: 'Premium Experience', icon: StarIcon, color: 'from-pink-500 to-rose-500' }
  ];

  // Mock existing experiences
  useEffect(() => {
    const mockExperiences = [
      {
        id: 1,
        title: 'Miami Creator Weekend',
        description: 'Exclusive 3-day networking and content creation retreat in Miami Beach',
        location: 'Miami Beach, FL',
        bannerImage: 'https://source.unsplash.com/800x400/?miami,beach',
        tokenCost: 10000,
        date: '2024-03-15',
        duration: '3 days',
        maxParticipants: 20,
        currentParticipants: 12,
        category: 'domestic',
        tier: 'silver',
        perks: ['Luxury accommodation', 'Professional photoshoot', 'Yacht party', 'Workshop sessions'],
        requirements: ['Active creator status', 'Minimum 10k followers', '18+ years old'],
        status: 'open',
        organizer: 'Digis Team',
        deadline: '2024-03-01'
      },
      {
        id: 2,
        title: 'Bali Content Creator Villa',
        description: '2-week immersive experience in a luxury villa with top creators',
        location: 'Bali, Indonesia',
        bannerImage: 'https://source.unsplash.com/800x400/?bali,villa',
        tokenCost: 50000,
        date: '2024-04-01',
        duration: '14 days',
        maxParticipants: 15,
        currentParticipants: 8,
        category: 'international',
        tier: 'platinum',
        perks: ['Private villa', 'Daily activities', 'Spa treatments', 'Content collaboration'],
        requirements: ['Verified creator', 'Valid passport', 'Travel insurance'],
        status: 'open',
        organizer: 'Digis Team',
        deadline: '2024-03-15'
      },
      {
        id: 3,
        title: 'LA Creator House Party',
        description: 'Weekend networking event at exclusive Hollywood Hills mansion',
        location: 'Los Angeles, CA',
        bannerImage: 'https://source.unsplash.com/800x400/?losangeles,party',
        tokenCost: 5000,
        date: '2024-02-20',
        duration: '2 days',
        maxParticipants: 50,
        currentParticipants: 38,
        category: 'local',
        tier: 'bronze',
        perks: ['Mansion access', 'DJ & entertainment', 'Catered meals', 'Gift bags'],
        requirements: ['Creator account', '21+ years old'],
        status: 'filling-fast',
        organizer: 'Digis Team',
        deadline: '2024-02-15'
      }
    ];
    
    setExperiences(mockExperiences);
    setLoading(false);
  }, []);

  const handleSubmitExperience = async () => {
    // Validate form
    if (!newExperience.title || !newExperience.description || !newExperience.location || 
        !newExperience.proposedDate || !newExperience.estimatedCost) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSubmitting(true);
    try {
      // In production, this would submit to the API
      // await api.post('/experiences/submit', newExperience);
      
      // toast.success('Experience submitted for review! We\'ll get back to you within 48 hours.');
      setShowCreateModal(false);
      resetForm();
    } catch (error) {
      toast.error('Failed to submit experience');
    } finally {
      setSubmitting(false);
    }
  };

  const handleJoinExperience = async (experience) => {
    if (user.tokenBalance < experience.tokenCost) {
      toast.error(`You need ${experience.tokenCost - user.tokenBalance} more tokens to join this experience`);
      return;
    }

    setConfirmDialog({
      isOpen: true,
      title: 'Join Experience',
      message: `Are you sure you want to join "${experience.title}"? This will deduct ${experience.tokenCost} tokens from your balance.`,
      type: 'warning',
      onConfirm: async () => {
        try {
          // In production, this would call the API
          await api.post(`/experiences/${experience.id}/join`);
          
          // toast.success(`Successfully joined ${experience.title}!`);
          setShowDetailsModal(false);
          // Refresh experiences list
          setLoading(true);
          setTimeout(() => setLoading(false), 1000); // Simulate refresh
        } catch (error) {
          toast.error('Failed to join experience');
        }
      }
    });
  };

  const resetForm = () => {
    setNewExperience({
      title: '',
      description: '',
      location: '',
      proposedDate: '',
      duration: '',
      estimatedCost: '',
      maxParticipants: '',
      minParticipants: '',
      targetAudience: '',
      activities: [''],
      requirements: [''],
      whySpecial: '',
      coHosts: ['']
    });
  };

  const addArrayField = (field) => {
    setNewExperience({
      ...newExperience,
      [field]: [...newExperience[field], '']
    });
  };

  const updateArrayField = (field, index, value) => {
    const updated = [...newExperience[field]];
    updated[index] = value;
    setNewExperience({ ...newExperience, [field]: updated });
  };

  const removeArrayField = (field, index) => {
    const updated = newExperience[field].filter((_, i) => i !== index);
    setNewExperience({ ...newExperience, [field]: updated });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl p-8 mb-8 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-3">Creator Experiences</h1>
              <p className="text-purple-100 text-lg">
                Join exclusive trips and events or create your own experience for fellow creators
              </p>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowCreateModal(true)}
              className="bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all duration-200 shadow-lg"
            >
              <PlusIcon className="w-5 h-5" />
              Create Experience
            </motion.button>
          </div>
        </div>

        {/* Token Balance Card */}
        <div className="bg-white rounded-xl p-6 mb-8 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Your Token Balance</p>
              <p className="text-3xl font-bold text-gray-900">{(user.tokenBalance || 0).toLocaleString()} tokens</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600 mb-1">Can afford</p>
              <p className="text-lg font-semibold text-purple-600">
                {experiences.filter(exp => exp.tokenCost <= (user.tokenBalance || 0)).length} experiences
              </p>
            </div>
          </div>
        </div>

        {/* Experiences Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {experiences.map((experience) => {
              const category = categories.find(c => c.id === experience.category);
              const canAfford = (user.tokenBalance || 0) >= experience.tokenCost;
              const spotsLeft = experience.maxParticipants - experience.currentParticipants;
              
              return (
                <motion.div
                  key={experience.id}
                  whileHover={{ y: -5 }}
                  className="bg-white rounded-2xl overflow-hidden border border-gray-200 shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  {/* Banner Image */}
                  <div className="relative h-48 overflow-hidden">
                    <img 
                      src={experience.bannerImage} 
                      alt={experience.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                    
                    {/* Status Badge */}
                    <div className="absolute top-4 right-4">
                      {experience.status === 'filling-fast' && (
                        <span className="px-3 py-1 bg-orange-500 text-white text-xs font-bold rounded-full flex items-center gap-1">
                          <SparklesIcon className="w-3 h-3" />
                          Filling Fast
                        </span>
                      )}
                    </div>
                    
                    {/* Category Badge */}
                    <div className="absolute bottom-4 left-4">
                      <span className={`px-3 py-1 bg-gradient-to-r ${category.color} text-white text-xs font-bold rounded-full`}>
                        {category.label}
                      </span>
                    </div>
                  </div>
                  
                  {/* Content */}
                  <div className="p-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-2">{experience.title}</h3>
                    <p className="text-gray-600 text-sm mb-4 line-clamp-2">{experience.description}</p>
                    
                    {/* Details */}
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <MapPinIcon className="w-4 h-4 text-gray-400" />
                        {experience.location}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <CalendarIcon className="w-4 h-4 text-gray-400" />
                        {new Date(experience.date).toLocaleDateString()} • {experience.duration}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <UserGroupIcon className="w-4 h-4 text-gray-400" />
                        {experience.currentParticipants}/{experience.maxParticipants} spots filled
                      </div>
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="mb-4">
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300"
                          style={{ width: `${(experience.currentParticipants / experience.maxParticipants) * 100}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {spotsLeft} spots remaining
                      </p>
                    </div>
                    
                    {/* Price and Action */}
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-2xl font-bold text-gray-900">
                          {experience.tokenCost.toLocaleString()}
                          <span className="text-sm font-normal text-gray-600 ml-1">tokens</span>
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => {
                            setSelectedExperience(experience);
                            setShowDetailsModal(true);
                          }}
                          className="px-4 py-2 border border-purple-600 text-purple-600 rounded-lg hover:bg-purple-50 transition-colors font-medium"
                        >
                          Details
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: canAfford ? 1.05 : 1 }}
                          whileTap={{ scale: canAfford ? 0.95 : 1 }}
                          onClick={() => canAfford && handleJoinExperience(experience)}
                          disabled={!canAfford || spotsLeft === 0}
                          className={`px-4 py-2 rounded-lg font-medium transition-all ${
                            canAfford && spotsLeft > 0
                              ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:shadow-lg' 
                              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          }`}
                        >
                          {spotsLeft === 0 ? 'Sold Out' : canAfford ? 'Join' : 'Insufficient Tokens'}
                        </motion.button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Create Experience Modal */}
        <AnimatePresence>
          {showCreateModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl"
              >
                <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-bold">Submit Experience Proposal</h2>
                      <p className="text-purple-100 mt-1">Create an unforgettable experience for fellow creators</p>
                    </div>
                    <button
                      onClick={() => {
                        setShowCreateModal(false);
                        resetForm();
                      }}
                      className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                    >
                      <XMarkIcon className="w-6 h-6" />
                    </button>
                  </div>
                </div>

                <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 200px)' }}>
                  <div className="mb-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
                    <p className="text-sm text-blue-800">
                      <strong>Note:</strong> Your experience proposal will be reviewed by the Digis team. 
                      If approved, we'll work with you to finalize details and pricing.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Title */}
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Experience Title <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={newExperience.title}
                        onChange={(e) => setNewExperience({ ...newExperience, title: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="e.g., Bali Creator Retreat 2024"
                      />
                    </div>

                    {/* Description */}
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Description <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        value={newExperience.description}
                        onChange={(e) => setNewExperience({ ...newExperience, description: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        rows="4"
                        placeholder="Describe your experience in detail..."
                      />
                    </div>

                    {/* Location */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Location <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={newExperience.location}
                        onChange={(e) => setNewExperience({ ...newExperience, location: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="e.g., Bali, Indonesia"
                      />
                    </div>

                    {/* Proposed Date */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Proposed Date <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={newExperience.proposedDate}
                        onChange={(e) => setNewExperience({ ...newExperience, proposedDate: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                    </div>

                    {/* Duration */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Duration
                      </label>
                      <input
                        type="text"
                        value={newExperience.duration}
                        onChange={(e) => setNewExperience({ ...newExperience, duration: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="e.g., 7 days"
                      />
                    </div>

                    {/* Estimated Cost */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Estimated Cost (in tokens) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        value={newExperience.estimatedCost}
                        onChange={(e) => setNewExperience({ ...newExperience, estimatedCost: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="e.g., 50000"
                      />
                    </div>

                    {/* Participants */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Min Participants
                      </label>
                      <input
                        type="number"
                        value={newExperience.minParticipants}
                        onChange={(e) => setNewExperience({ ...newExperience, minParticipants: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="e.g., 10"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Max Participants
                      </label>
                      <input
                        type="number"
                        value={newExperience.maxParticipants}
                        onChange={(e) => setNewExperience({ ...newExperience, maxParticipants: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="e.g., 20"
                      />
                    </div>

                    {/* Activities */}
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Planned Activities
                      </label>
                      {newExperience.activities.map((activity, index) => (
                        <div key={index} className="flex gap-2 mb-2">
                          <input
                            type="text"
                            value={activity}
                            onChange={(e) => updateArrayField('activities', index, e.target.value)}
                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            placeholder="e.g., Sunset photoshoot"
                          />
                          {newExperience.activities.length > 1 && (
                            <button
                              onClick={() => removeArrayField('activities', index)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                            >
                              <XMarkIcon className="w-5 h-5" />
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        onClick={() => addArrayField('activities')}
                        className="text-purple-600 hover:text-purple-700 font-medium text-sm"
                      >
                        + Add Activity
                      </button>
                    </div>

                    {/* Co-hosts */}
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Co-hosts (Other Creators)
                      </label>
                      {newExperience.coHosts.map((coHost, index) => (
                        <div key={index} className="flex gap-2 mb-2">
                          <input
                            type="text"
                            value={coHost}
                            onChange={(e) => updateArrayField('coHosts', index, e.target.value)}
                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            placeholder="@username"
                          />
                          {newExperience.coHosts.length > 1 && (
                            <button
                              onClick={() => removeArrayField('coHosts', index)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                            >
                              <XMarkIcon className="w-5 h-5" />
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        onClick={() => addArrayField('coHosts')}
                        className="text-purple-600 hover:text-purple-700 font-medium text-sm"
                      >
                        + Add Co-host
                      </button>
                    </div>

                    {/* Why Special */}
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        What makes this experience special?
                      </label>
                      <textarea
                        value={newExperience.whySpecial}
                        onChange={(e) => setNewExperience({ ...newExperience, whySpecial: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        rows="3"
                        placeholder="Tell us what makes your experience unique..."
                      />
                    </div>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
                  <div className="flex items-center justify-end gap-3">
                    <button
                      onClick={() => {
                        setShowCreateModal(false);
                        resetForm();
                      }}
                      className="px-5 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSubmitExperience}
                      disabled={submitting}
                      className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {submitting ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          Submitting...
                        </>
                      ) : (
                        <>
                          <PaperAirplaneIcon className="w-4 h-4" />
                          Submit for Review
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Experience Details Modal */}
        <AnimatePresence>
          {showDetailsModal && selectedExperience && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl"
              >
                <div className="relative h-64 overflow-hidden">
                  <img 
                    src={selectedExperience.bannerImage} 
                    alt={selectedExperience.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
                  <button
                    onClick={() => setShowDetailsModal(false)}
                    className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg transition-colors"
                  >
                    <XMarkIcon className="w-6 h-6 text-white" />
                  </button>
                  <div className="absolute bottom-6 left-6 right-6">
                    <h2 className="text-3xl font-bold text-white mb-2">{selectedExperience.title}</h2>
                    <p className="text-white/90">{selectedExperience.location}</p>
                  </div>
                </div>

                <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 16rem)' }}>
                  <div className="mb-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-2">About This Experience</h3>
                    <p className="text-gray-600">{selectedExperience.description}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-6 mb-6">
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">Event Details</h4>
                      <div className="space-y-2 text-sm">
                        <p className="flex items-center gap-2">
                          <CalendarIcon className="w-4 h-4 text-gray-400" />
                          {new Date(selectedExperience.date).toLocaleDateString()}
                        </p>
                        <p className="flex items-center gap-2">
                          <ClockIcon className="w-4 h-4 text-gray-400" />
                          {selectedExperience.duration}
                        </p>
                        <p className="flex items-center gap-2">
                          <UserGroupIcon className="w-4 h-4 text-gray-400" />
                          {selectedExperience.currentParticipants}/{selectedExperience.maxParticipants} participants
                        </p>
                        <p className="flex items-center gap-2">
                          <DocumentTextIcon className="w-4 h-4 text-gray-400" />
                          Apply by {new Date(selectedExperience.deadline).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">Requirements</h4>
                      <ul className="space-y-1 text-sm text-gray-600">
                        {selectedExperience.requirements.map((req, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <CheckIcon className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                            {req}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="mb-6">
                    <h4 className="font-semibold text-gray-900 mb-2">What's Included</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {selectedExperience.perks.map((perk, index) => (
                        <div key={index} className="flex items-center gap-2 text-sm text-gray-600">
                          <StarIcon className="w-4 h-4 text-purple-500" />
                          {perk}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="border-t pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Total Cost</p>
                        <p className="text-3xl font-bold text-gray-900">
                          {selectedExperience.tokenCost.toLocaleString()}
                          <span className="text-sm font-normal text-gray-600 ml-1">tokens</span>
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          handleJoinExperience(selectedExperience);
                          setShowDetailsModal(false);
                        }}
                        disabled={(user.tokenBalance || 0) < selectedExperience.tokenCost}
                        className={`px-8 py-3 rounded-lg font-semibold transition-all ${
                          (user.tokenBalance || 0) >= selectedExperience.tokenCost
                            ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:shadow-lg' 
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        Join Experience
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
        onConfirm={() => {
          confirmDialog.onConfirm();
          setConfirmDialog({ ...confirmDialog, isOpen: false });
        }}
        title={confirmDialog.title}
        message={confirmDialog.message}
        type={confirmDialog.type}
      />
    </div>
  );
};

export default CreatorExperiences;