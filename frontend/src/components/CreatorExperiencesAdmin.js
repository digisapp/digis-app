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
  TagIcon,
  DocumentTextIcon,
  CheckIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  ArrowUpIcon,
  ArrowDownIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const CreatorExperiencesAdmin = ({ isAdmin, user }) => {
  const [experiences, setExperiences] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedExperience, setSelectedExperience] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [newExperience, setNewExperience] = useState({
    title: '',
    description: '',
    location: '',
    bannerImage: '',
    tokenCost: '',
    date: '',
    duration: '',
    maxParticipants: '',
    category: 'local',
    perks: [''],
    requirements: [''],
    itinerary: [''],
    tier: 'bronze'
  });

  // Experience tiers
  const experienceTiers = [
    { id: 'starter', label: 'Starter', color: 'from-gray-400 to-gray-600', minTokens: 1000 },
    { id: 'bronze', label: 'Bronze', color: 'from-orange-400 to-orange-600', minTokens: 5000 },
    { id: 'silver', label: 'Silver', color: 'from-gray-300 to-gray-500', minTokens: 10000 },
    { id: 'gold', label: 'Gold', color: 'from-yellow-400 to-yellow-600', minTokens: 25000 },
    { id: 'platinum', label: 'Platinum', color: 'from-purple-400 to-purple-600', minTokens: 50000 },
    { id: 'diamond', label: 'Diamond', color: 'from-blue-400 to-blue-600', minTokens: 100000 }
  ];

  // Categories
  const categories = [
    { id: 'local', label: 'Local Event', icon: UserGroupIcon },
    { id: 'domestic', label: 'Domestic Trip', icon: SunIcon },
    { id: 'international', label: 'International', icon: GlobeAltIcon },
    { id: 'premium', label: 'Premium Experience', icon: StarIcon }
  ];

  // Mock existing experiences
  useEffect(() => {
    const mockExperiences = [
      {
        id: 1,
        title: 'Miami Creator Weekend',
        description: 'Exclusive 3-day networking and content creation retreat in Miami Beach',
        location: 'Miami Beach, FL',
        bannerImage: 'https://example.com/miami.jpg',
        tokenCost: 10000,
        date: '2024-03-15',
        duration: '3 days',
        maxParticipants: 20,
        currentParticipants: 12,
        category: 'domestic',
        tier: 'silver',
        perks: ['Luxury accommodation', 'Professional photoshoot', 'Yacht party', 'Workshop sessions'],
        requirements: ['Active creator status', 'Minimum 10k followers', '18+ years old'],
        status: 'active',
        createdAt: '2024-01-10'
      },
      {
        id: 2,
        title: 'Bali Content Creator Villa',
        description: '2-week immersive experience in a luxury villa with top creators',
        location: 'Bali, Indonesia',
        bannerImage: 'https://example.com/bali.jpg',
        tokenCost: 50000,
        date: '2024-04-01',
        duration: '14 days',
        maxParticipants: 15,
        currentParticipants: 8,
        category: 'international',
        tier: 'platinum',
        perks: ['Private villa', 'Daily activities', 'Spa treatments', 'Content collaboration'],
        requirements: ['Verified creator', 'Valid passport', 'Travel insurance'],
        status: 'active',
        createdAt: '2024-01-05'
      }
    ];
    
    setExperiences(mockExperiences);
    setLoading(false);
  }, []);

  const handleAddExperience = () => {
    // Validate form
    if (!newExperience.title || !newExperience.description || !newExperience.location || 
        !newExperience.tokenCost || !newExperience.date || !newExperience.maxParticipants) {
      toast.error('Please fill in all required fields');
      return;
    }

    const experience = {
      ...newExperience,
      id: Date.now(),
      tokenCost: parseInt(newExperience.tokenCost),
      maxParticipants: parseInt(newExperience.maxParticipants),
      currentParticipants: 0,
      status: 'active',
      createdAt: new Date().toISOString(),
      perks: newExperience.perks.filter(p => p.trim()),
      requirements: newExperience.requirements.filter(r => r.trim()),
      itinerary: newExperience.itinerary.filter(i => i.trim())
    };

    setExperiences([experience, ...experiences]);
    // toast.success('Experience created successfully!');
    setShowAddModal(false);
    resetForm();
  };

  const handleUpdateExperience = () => {
    const updatedExperiences = experiences.map(exp => 
      exp.id === selectedExperience.id ? selectedExperience : exp
    );
    setExperiences(updatedExperiences);
    // toast.success('Experience updated successfully!');
    setShowEditModal(false);
    setSelectedExperience(null);
  };

  const handleDeleteExperience = (id) => {
    if (window.confirm('Are you sure you want to delete this experience?')) {
      setExperiences(experiences.filter(exp => exp.id !== id));
      // toast.success('Experience deleted successfully!');
    }
  };

  const resetForm = () => {
    setNewExperience({
      title: '',
      description: '',
      location: '',
      bannerImage: '',
      tokenCost: '',
      date: '',
      duration: '',
      maxParticipants: '',
      category: 'local',
      perks: [''],
      requirements: [''],
      itinerary: [''],
      tier: 'bronze'
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

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Admin Access Required</h2>
          <p className="text-gray-600">Only Digis administrators can manage creator experiences.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Creator Experiences Management</h1>
            <p className="text-purple-100">
              Create and manage exclusive experiences for creators to redeem with tokens
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all duration-200 shadow-lg"
          >
            <PlusIcon className="w-5 h-5" />
            Add Experience
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-purple-100 rounded-lg">
              <MapPinIcon className="w-5 h-5 text-purple-600" />
            </div>
            <p className="text-sm text-gray-600">Total Experiences</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">{experiences.length}</p>
        </div>
        
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-100 rounded-lg">
              <UserGroupIcon className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-sm text-gray-600">Total Participants</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {experiences.reduce((sum, exp) => sum + (exp.currentParticipants || 0), 0)}
          </p>
        </div>
        
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <CheckIcon className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-sm text-gray-600">Active Experiences</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {experiences.filter(exp => exp.status === 'active').length}
          </p>
        </div>
        
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <CurrencyDollarIcon className="w-5 h-5 text-yellow-600" />
            </div>
            <p className="text-sm text-gray-600">Avg Token Cost</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {experiences.length > 0 
              ? Math.round(experiences.reduce((sum, exp) => sum + exp.tokenCost, 0) / experiences.length).toLocaleString()
              : '0'
            }
          </p>
        </div>
      </div>

      {/* Experiences List */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">All Experiences</h2>
        </div>
        
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          </div>
        ) : experiences.length === 0 ? (
          <div className="p-8 text-center">
            <SparklesIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600">No experiences created yet</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-4 text-purple-600 hover:text-purple-700 font-medium"
            >
              Create your first experience
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {experiences.map((experience) => {
              const category = categories.find(c => c.id === experience.category);
              const tier = experienceTiers.find(t => t.id === experience.tier);
              
              return (
                <div key={experience.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start gap-6">
                    {/* Image */}
                    <div className="w-32 h-24 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                      {experience.bannerImage ? (
                        <img 
                          src={experience.bannerImage} 
                          alt={experience.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <PhotoIcon className="w-8 h-8 text-gray-400" />
                        </div>
                      )}
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-3 mb-1">
                            <h3 className="text-lg font-bold text-gray-900">{experience.title}</h3>
                            <span className={`px-2 py-1 text-xs font-medium rounded-full bg-gradient-to-r ${tier.color} text-white`}>
                              {tier.label}
                            </span>
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                              experience.status === 'active' 
                                ? 'bg-green-100 text-green-700' 
                                : 'bg-gray-100 text-gray-700'
                            }`}>
                              {experience.status}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{experience.description}</p>
                          
                          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                            <span className="flex items-center gap-1">
                              <MapPinIcon className="w-4 h-4" />
                              {experience.location}
                            </span>
                            <span className="flex items-center gap-1">
                              <CalendarIcon className="w-4 h-4" />
                              {new Date(experience.date).toLocaleDateString()}
                            </span>
                            <span className="flex items-center gap-1">
                              <ClockIcon className="w-4 h-4" />
                              {experience.duration}
                            </span>
                            <span className="flex items-center gap-1">
                              <UserGroupIcon className="w-4 h-4" />
                              {experience.currentParticipants}/{experience.maxParticipants} participants
                            </span>
                            <span className="flex items-center gap-1 font-semibold text-purple-600">
                              <CurrencyDollarIcon className="w-4 h-4" />
                              {experience.tokenCost.toLocaleString()} tokens
                            </span>
                          </div>
                        </div>
                        
                        {/* Actions */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setSelectedExperience(experience);
                              setShowEditModal(true);
                            }}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <PencilIcon className="w-5 h-5 text-gray-600" />
                          </button>
                          <button
                            onClick={() => handleDeleteExperience(experience.id)}
                            className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <TrashIcon className="w-5 h-5 text-red-600" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Experience Modal */}
      {showAddModal && (
        <AnimatePresence>
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl"
            >
              <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold">Create New Experience</h2>
                  <button
                    onClick={() => {
                      setShowAddModal(false);
                      resetForm();
                    }}
                    className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                  >
                    <XMarkIcon className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 200px)' }}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Title */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Title <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newExperience.title}
                      onChange={(e) => setNewExperience({ ...newExperience, title: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="e.g., Miami Creator Weekend"
                    />
                  </div>

                  {/* Location */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Location <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <MapPinIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                      <input
                        type="text"
                        value={newExperience.location}
                        onChange={(e) => setNewExperience({ ...newExperience, location: e.target.value })}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="e.g., Miami Beach, FL"
                      />
                    </div>
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
                      rows="3"
                      placeholder="Describe the experience..."
                    />
                  </div>

                  {/* Banner Image */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Banner Image URL
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newExperience.bannerImage}
                        onChange={(e) => setNewExperience({ ...newExperience, bannerImage: e.target.value })}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="https://example.com/image.jpg"
                      />
                      <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2">
                        <PhotoIcon className="w-5 h-5" />
                        Upload
                      </button>
                    </div>
                  </div>

                  {/* Token Cost */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Token Cost <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <CurrencyDollarIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                      <input
                        type="number"
                        value={newExperience.tokenCost}
                        onChange={(e) => setNewExperience({ ...newExperience, tokenCost: e.target.value })}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="e.g., 10000"
                      />
                    </div>
                  </div>

                  {/* Max Participants */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Max Participants <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <UserGroupIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                      <input
                        type="number"
                        value={newExperience.maxParticipants}
                        onChange={(e) => setNewExperience({ ...newExperience, maxParticipants: e.target.value })}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="e.g., 20"
                      />
                    </div>
                  </div>

                  {/* Date */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Start Date <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <CalendarIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                      <input
                        type="date"
                        value={newExperience.date}
                        onChange={(e) => setNewExperience({ ...newExperience, date: e.target.value })}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  {/* Duration */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Duration
                    </label>
                    <div className="relative">
                      <ClockIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                      <input
                        type="text"
                        value={newExperience.duration}
                        onChange={(e) => setNewExperience({ ...newExperience, duration: e.target.value })}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="e.g., 3 days"
                      />
                    </div>
                  </div>

                  {/* Category */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Category
                    </label>
                    <select
                      value={newExperience.category}
                      onChange={(e) => setNewExperience({ ...newExperience, category: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Tier */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Experience Tier
                    </label>
                    <select
                      value={newExperience.tier}
                      onChange={(e) => setNewExperience({ ...newExperience, tier: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      {experienceTiers.map(tier => (
                        <option key={tier.id} value={tier.id}>
                          {tier.label} (Min {tier.minTokens.toLocaleString()} tokens)
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Perks */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Perks & Benefits
                    </label>
                    {newExperience.perks.map((perk, index) => (
                      <div key={index} className="flex gap-2 mb-2">
                        <input
                          type="text"
                          value={perk}
                          onChange={(e) => updateArrayField('perks', index, e.target.value)}
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          placeholder="e.g., Luxury accommodation"
                        />
                        {newExperience.perks.length > 1 && (
                          <button
                            onClick={() => removeArrayField('perks', index)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                          >
                            <XMarkIcon className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      onClick={() => addArrayField('perks')}
                      className="text-purple-600 hover:text-purple-700 font-medium text-sm"
                    >
                      + Add Perk
                    </button>
                  </div>

                  {/* Requirements */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Requirements
                    </label>
                    {newExperience.requirements.map((req, index) => (
                      <div key={index} className="flex gap-2 mb-2">
                        <input
                          type="text"
                          value={req}
                          onChange={(e) => updateArrayField('requirements', index, e.target.value)}
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          placeholder="e.g., Active creator status"
                        />
                        {newExperience.requirements.length > 1 && (
                          <button
                            onClick={() => removeArrayField('requirements', index)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                          >
                            <XMarkIcon className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      onClick={() => addArrayField('requirements')}
                      className="text-purple-600 hover:text-purple-700 font-medium text-sm"
                    >
                      + Add Requirement
                    </button>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
                <div className="flex items-center justify-end gap-3">
                  <button
                    onClick={() => {
                      setShowAddModal(false);
                      resetForm();
                    }}
                    className="px-5 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddExperience}
                    className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium hover:shadow-lg transition-all flex items-center gap-2"
                  >
                    <CheckIcon className="w-4 h-4" />
                    Create Experience
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        </AnimatePresence>
      )}
    </div>
  );
};

export default CreatorExperiencesAdmin;