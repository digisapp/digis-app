import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPinIcon,
  CalendarIcon,
  UserGroupIcon,
  SparklesIcon,
  GlobeAltIcon,
  CameraIcon,
  HeartIcon,
  ArrowRightIcon,
  CheckBadgeIcon,
  TicketIcon,
  SunIcon,
  StarIcon,
  FireIcon,
  ArrowTrendingUpIcon,
  PhotoIcon,
  VideoCameraIcon,
  PlusCircleIcon,
  XMarkIcon,
  MagnifyingGlassIcon,
  AdjustmentsHorizontalIcon,
  SignalIcon
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolid } from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';

const CreatorConnect = ({ user, onNavigateBack }) => {
  const [activeTab, setActiveTab] = useState('experiences');
  const [selectedExperience, setSelectedExperience] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBy, setFilterBy] = useState('all');
  const [showRedeemModal, setShowRedeemModal] = useState(false);
  const [showPostCollaborationModal, setShowPostCollaborationModal] = useState(false);
  const [collaborationForm, setCollaborationForm] = useState({
    title: '',
    type: 'photoshoot',
    location: '',
    date: '',
    description: '',
    requirements: [],
    compensation: ''
  });

  // Mock data for experiences
  const experiences = [
    {
      id: 1,
      title: 'Greece Creator Retreat 2024',
      location: 'Santorini, Greece',
      dates: 'June 15-22, 2024',
      tokenCost: 25000,
      spotsLeft: 8,
      totalSpots: 20,
      image: '/api/placeholder/400/300',
      category: 'international',
      highlights: ['All-inclusive resort', 'Content creation workshops', 'Yacht party', 'Professional photoshoot'],
      creators: [
        { id: 1, name: 'Emma Rose', avatar: '/api/placeholder/40/40', verified: true },
        { id: 2, name: 'Alex Chen', avatar: '/api/placeholder/40/40', verified: true },
        { id: 3, name: 'Sofia Martinez', avatar: '/api/placeholder/40/40', verified: false }
      ],
      description: 'Join top creators for a week in paradise! This all-inclusive retreat includes luxury accommodation, daily activities, and networking opportunities.',
      featured: true,
      brandSponsored: true,
      sponsor: 'Fashion Nova'
    },
    {
      id: 2,
      title: 'Miami Beach House',
      location: 'Miami Beach, FL',
      dates: 'May 1-5, 2024',
      tokenCost: 10000,
      spotsLeft: 3,
      totalSpots: 12,
      image: '/api/placeholder/400/300',
      category: 'domestic',
      highlights: ['Beach house stay', 'Pool parties', 'Content collaboration', 'Nightlife access'],
      creators: [
        { id: 4, name: 'Jake Wilson', avatar: '/api/placeholder/40/40', verified: true },
        { id: 5, name: 'Luna Park', avatar: '/api/placeholder/40/40', verified: true }
      ],
      description: 'Experience Miami like never before with exclusive beach house access and VIP nightlife experiences.',
      brandSponsored: false
    },
    {
      id: 3,
      title: 'Bali Content Creator Villa',
      location: 'Ubud, Bali',
      dates: 'July 10-24, 2024',
      tokenCost: 50000,
      spotsLeft: 12,
      totalSpots: 15,
      image: '/api/placeholder/400/300',
      category: 'international',
      highlights: ['Private villa', 'Spa & wellness', 'Temple tours', 'Surfing lessons', 'Content workshops'],
      creators: [
        { id: 6, name: 'Maya Patel', avatar: '/api/placeholder/40/40', verified: true }
      ],
      description: 'Two weeks in a luxury Bali villa with daily activities, wellness sessions, and content creation opportunities.',
      featured: true,
      brandSponsored: true,
      sponsor: 'Gymshark'
    }
  ];

  // Mock data for collaborations
  const collaborations = [
    {
      id: 1,
      creator: { name: 'Emma Rose', avatar: '/api/placeholder/60/60', verified: true, followers: '250K' },
      type: 'photoshoot',
      title: 'Summer Beach Collection Shoot',
      location: 'Los Angeles, CA',
      date: 'April 20, 2024',
      description: 'Looking for 2-3 creators to collaborate on a summer fashion shoot',
      requirements: ['Fashion/lifestyle content', '50K+ followers', 'Professional attitude'],
      compensation: '500 tokens + content'
    },
    {
      id: 2,
      creator: { name: 'Alex Chen', avatar: '/api/placeholder/60/60', verified: true, followers: '180K' },
      type: 'video',
      title: 'Travel Vlog Collaboration',
      location: 'New York City',
      date: 'May 5-7, 2024',
      description: 'Join me for a NYC travel vlog series exploring hidden gems',
      requirements: ['Travel content creator', 'Video editing skills', 'Engaging personality'],
      compensation: '1000 tokens + exposure'
    }
  ];

  const filteredExperiences = experiences.filter(exp => {
    if (filterBy !== 'all' && exp.category !== filterBy) return false;
    if (searchQuery && !exp.title.toLowerCase().includes(searchQuery.toLowerCase()) && 
        !exp.location.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const RedeemModal = ({ experience, onClose }) => {
    const [redeeming, setRedeeming] = useState(false);

    const handleRedeem = async () => {
      setRedeeming(true);
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      // toast.success('Successfully redeemed! Check your email for details.');
      onClose();
    };

    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl"
          >
            <div className="relative h-48">
              <img src={experience.image} alt={experience.title} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 bg-white/20 backdrop-blur-sm rounded-full text-white hover:bg-white/30"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
              <div className="absolute bottom-4 left-4 text-white">
                <h3 className="text-2xl font-bold">{experience.title}</h3>
                <p className="flex items-center gap-2 mt-1">
                  <MapPinIcon className="w-4 h-4" />
                  {experience.location}
                </p>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-purple-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Token Cost</span>
                  <span className="text-2xl font-bold text-purple-600">{experience.tokenCost.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Your Balance</span>
                  <span className="text-lg font-semibold text-gray-900">15,000</span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5 text-gray-400" />
                  <span className="text-sm text-gray-700">{experience.dates}</span>
                </div>
                <div className="flex items-center gap-2">
                  <UserGroupIcon className="w-5 h-5 text-gray-400" />
                  <span className="text-sm text-gray-700">{experience.spotsLeft} spots remaining</span>
                </div>
              </div>

              <div className="border-t pt-4">
                <p className="text-sm text-gray-600 mb-4">
                  By redeeming, you agree to the terms and conditions. This action cannot be undone.
                </p>
                <button
                  onClick={handleRedeem}
                  disabled={redeeming}
                  className={`w-full py-3 rounded-xl font-medium transition-all ${
                    redeeming
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:shadow-lg'
                  }`}
                >
                  {redeeming ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Redeeming...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <TicketIcon className="w-5 h-5" />
                      Redeem Experience
                    </span>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={onNavigateBack}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowRightIcon className="w-4 h-4 rotate-180" />
          Back to Dashboard
        </button>
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <div className="p-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl">
                <GlobeAltIcon className="w-8 h-8 text-white" />
              </div>
              Creator Connect
            </h1>
            <p className="text-gray-600 mt-2">Connect with creators, join experiences, and explore the world</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('experiences')}
          className={`px-6 py-3 rounded-lg font-medium transition-all ${
            activeTab === 'experiences'
              ? 'bg-purple-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Experiences & Trips
        </button>
        <button
          onClick={() => setActiveTab('collaborations')}
          className={`px-6 py-3 rounded-lg font-medium transition-all ${
            activeTab === 'collaborations'
              ? 'bg-purple-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Collaborations
        </button>
      </div>

      {activeTab === 'experiences' && (
        <>
          {/* Search and Filter */}
          <div className="flex gap-4 mb-6">
            <div className="flex-1 relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search destinations..."
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <select
              value={filterBy}
              onChange={(e) => setFilterBy(e.target.value)}
              className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="all">All Experiences</option>
              <option value="domestic">Domestic</option>
              <option value="international">International</option>
            </select>
          </div>

          {/* Featured Experience */}
          {filteredExperiences.filter(exp => exp.featured).map(experience => (
            <motion.div
              key={experience.id}
              whileHover={{ y: -4 }}
              className="mb-8 bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl p-1"
            >
              <div className="bg-white rounded-xl overflow-hidden">
                <div className="md:flex">
                  <div className="md:w-2/5 h-64 md:h-auto">
                    <img src={experience.image} alt={experience.title} className="w-full h-full object-cover" />
                  </div>
                  <div className="md:w-3/5 p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="px-3 py-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-bold rounded-full">
                            FEATURED
                          </span>
                          {experience.brandSponsored && (
                            <div className="flex items-center gap-1 px-3 py-1 bg-yellow-100 rounded-full">
                              <StarIcon className="w-4 h-4 text-yellow-600" />
                              <span className="text-xs font-bold text-yellow-800">SPONSORED BY {experience.sponsor}</span>
                            </div>
                          )}
                          <FireIcon className="w-5 h-5 text-orange-500" />
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900">{experience.title}</h3>
                        <p className="text-gray-600 flex items-center gap-2 mt-1">
                          <MapPinIcon className="w-4 h-4" />
                          {experience.location}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-500">Redeem for</p>
                        <p className="text-2xl font-bold text-purple-600">{experience.tokenCost.toLocaleString()}</p>
                        <p className="text-xs text-gray-500">tokens</p>
                      </div>
                    </div>

                    <p className="text-gray-700 mb-4">{experience.description}</p>

                    <div className="flex flex-wrap gap-2 mb-4">
                      {experience.highlights.map((highlight, index) => (
                        <span key={index} className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">
                          {highlight}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex -space-x-2">
                          {experience.creators.map((creator) => (
                            <img
                              key={creator.id}
                              src={creator.avatar}
                              alt={creator.name}
                              className="w-10 h-10 rounded-full border-2 border-white"
                            />
                          ))}
                        </div>
                        <div className="text-sm text-gray-600">
                          <CalendarIcon className="w-4 h-4 inline mr-1" />
                          {experience.dates}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedExperience(experience);
                          setShowRedeemModal(true);
                        }}
                        className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium hover:shadow-lg transition-all"
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}

          {/* Experience Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredExperiences.filter(exp => !exp.featured).map(experience => (
              <motion.div
                key={experience.id}
                whileHover={{ y: -4 }}
                className="bg-white rounded-xl shadow-lg overflow-hidden cursor-pointer"
                onClick={() => {
                  setSelectedExperience(experience);
                  setShowRedeemModal(true);
                }}
              >
                <div className="relative h-48">
                  <img src={experience.image} alt={experience.title} className="w-full h-full object-cover" />
                  <div className="absolute top-4 right-4 px-3 py-1 bg-black/60 backdrop-blur-sm text-white rounded-full text-sm font-medium">
                    {experience.tokenCost.toLocaleString()} tokens
                  </div>
                  {experience.brandSponsored && (
                    <div className="absolute top-4 left-4 flex items-center gap-1 px-2 py-1 bg-yellow-100 rounded-full">
                      <StarIcon className="w-4 h-4 text-yellow-600" />
                      <span className="text-xs font-bold text-yellow-800">{experience.sponsor}</span>
                    </div>
                  )}
                </div>
                <div className="p-5">
                  <h3 className="text-lg font-bold text-gray-900 mb-1">{experience.title}</h3>
                  <p className="text-sm text-gray-600 flex items-center gap-2 mb-3">
                    <MapPinIcon className="w-4 h-4" />
                    {experience.location}
                  </p>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-gray-600">
                      <CalendarIcon className="w-4 h-4 inline mr-1" />
                      {experience.dates}
                    </span>
                    <span className="text-sm font-medium text-purple-600">
                      {experience.spotsLeft} spots left
                    </span>
                  </div>
                  <div className="flex -space-x-2">
                    {experience.creators.map((creator) => (
                      <img
                        key={creator.id}
                        src={creator.avatar}
                        alt={creator.name}
                        className="w-8 h-8 rounded-full border-2 border-white"
                      />
                    ))}
                    <div className="w-8 h-8 rounded-full bg-purple-100 border-2 border-white flex items-center justify-center text-xs font-medium text-purple-600">
                      +{experience.totalSpots - experience.creators.length}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Token Payment Info Section */}
          <div className="mt-8 bg-gradient-to-r from-purple-900 to-pink-900 rounded-2xl p-8 text-white">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-start gap-6">
                <div className="p-4 bg-white/20 rounded-xl">
                  <TicketIcon className="w-12 h-12" />
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold mb-3">Use Your Tokens for Amazing Experiences</h3>
                  <p className="text-purple-100 mb-4 leading-relaxed">
                    Your hard-earned tokens aren't just numbers – they're your ticket to unforgettable adventures! 
                    Use the tokens you earn on the platform to pay towards incredible trips and experiences with fellow creators. 
                    From beach retreats to international adventures, your tokens unlock a world of possibilities.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                      <MapPinIcon className="w-8 h-8 mb-2 text-purple-200" />
                      <h4 className="font-semibold mb-1">Travel the World</h4>
                      <p className="text-sm text-purple-200">Visit dream destinations with creator communities</p>
                    </div>
                    <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                      <UserGroupIcon className="w-8 h-8 mb-2 text-purple-200" />
                      <h4 className="font-semibold mb-1">Network & Collaborate</h4>
                      <p className="text-sm text-purple-200">Connect with top creators in your niche</p>
                    </div>
                    <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                      <SparklesIcon className="w-8 h-8 mb-2 text-purple-200" />
                      <h4 className="font-semibold mb-1">Exclusive Access</h4>
                      <p className="text-sm text-purple-200">Enjoy VIP experiences and brand partnerships</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => toast.info('Wallet integration coming soon!')}
                      className="px-6 py-3 bg-white text-purple-900 rounded-lg font-medium hover:bg-purple-50 transition-colors"
                    >
                      Check Your Token Balance
                    </button>
                    <p className="text-sm text-purple-200">
                      Current balance: View in your wallet
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {activeTab === 'collaborations' && (
        <div className="space-y-6">
          {/* Post Collaboration Button */}
          <div className="flex justify-end mb-6">
            <button
              onClick={() => setShowPostCollaborationModal(true)}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium hover:shadow-lg transition-all flex items-center gap-2"
            >
              <PlusCircleIcon className="w-5 h-5" />
              Post Collaboration
            </button>
          </div>

          {collaborations.map(collab => (
            <motion.div
              key={collab.id}
              whileHover={{ x: 4 }}
              className="bg-white rounded-xl shadow-lg p-6"
            >
              <div className="flex items-start gap-4">
                <img src={collab.creator.avatar} alt={collab.creator.name} className="w-16 h-16 rounded-full" />
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold text-gray-900">{collab.title}</h3>
                        {collab.type === 'photoshoot' && <CameraIcon className="w-5 h-5 text-purple-600" />}
                        {collab.type === 'video' && <VideoCameraIcon className="w-5 h-5 text-pink-600" />}
                      </div>
                      <p className="text-sm text-gray-600 flex items-center gap-2 mt-1">
                        by {collab.creator.name}
                        {collab.creator.verified && <CheckBadgeIcon className="w-4 h-4 text-blue-500" />}
                        • {collab.creator.followers} followers
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">Compensation</p>
                      <p className="font-medium text-purple-600">{collab.compensation}</p>
                    </div>
                  </div>

                  <p className="text-gray-700 mb-3">{collab.description}</p>

                  <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                    <span className="flex items-center gap-1">
                      <MapPinIcon className="w-4 h-4" />
                      {collab.location}
                    </span>
                    <span className="flex items-center gap-1">
                      <CalendarIcon className="w-4 h-4" />
                      {collab.date}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex flex-wrap gap-2">
                      {collab.requirements.map((req, index) => (
                        <span key={index} className="px-3 py-1 bg-gray-100 rounded-full text-xs text-gray-700">
                          {req}
                        </span>
                      ))}
                    </div>
                    <button
                      onClick={() => toast.info('Collaboration application coming soon!')}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors"
                    >
                      Apply Now
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Redeem Modal */}
      {showRedeemModal && selectedExperience && (
        <RedeemModal
          experience={selectedExperience}
          onClose={() => {
            setShowRedeemModal(false);
            setSelectedExperience(null);
          }}
        />
      )}

      {/* Post Collaboration Modal */}
      {showPostCollaborationModal && (
        <AnimatePresence>
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                    <div className="p-3 bg-gradient-to-r from-purple-100 to-pink-100 rounded-xl">
                      <UserGroupIcon className="w-6 h-6 text-purple-600" />
                    </div>
                    Post a Collaboration
                  </h2>
                  <button
                    onClick={() => setShowPostCollaborationModal(false)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <XMarkIcon className="w-6 h-6 text-gray-500" />
                  </button>
                </div>

                <form className="space-y-6">
                  {/* Title */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Collaboration Title *
                    </label>
                    <input
                      type="text"
                      value={collaborationForm.title}
                      onChange={(e) => setCollaborationForm({...collaborationForm, title: e.target.value})}
                      placeholder="e.g., Summer Fashion Photoshoot"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      required
                    />
                  </div>

                  {/* Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Collaboration Type *
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { value: 'photoshoot', label: 'Photoshoot', icon: CameraIcon },
                        { value: 'video', label: 'Video', icon: VideoCameraIcon },
                        { value: 'livestream', label: 'Live Stream', icon: SignalIcon }
                      ].map(type => (
                        <button
                          key={type.value}
                          type="button"
                          onClick={() => setCollaborationForm({...collaborationForm, type: type.value})}
                          className={`p-4 rounded-lg border-2 transition-all ${
                            collaborationForm.type === type.value
                              ? 'border-purple-600 bg-purple-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <type.icon className={`w-6 h-6 mx-auto mb-2 ${
                            collaborationForm.type === type.value ? 'text-purple-600' : 'text-gray-500'
                          }`} />
                          <p className={`text-sm font-medium ${
                            collaborationForm.type === type.value ? 'text-purple-900' : 'text-gray-700'
                          }`}>{type.label}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Location & Date */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Location *
                      </label>
                      <div className="relative">
                        <MapPinIcon className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" />
                        <input
                          type="text"
                          value={collaborationForm.location}
                          onChange={(e) => setCollaborationForm({...collaborationForm, location: e.target.value})}
                          placeholder="City, State"
                          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Date *
                      </label>
                      <div className="relative">
                        <CalendarIcon className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" />
                        <input
                          type="date"
                          value={collaborationForm.date}
                          onChange={(e) => setCollaborationForm({...collaborationForm, date: e.target.value})}
                          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description *
                    </label>
                    <textarea
                      value={collaborationForm.description}
                      onChange={(e) => setCollaborationForm({...collaborationForm, description: e.target.value})}
                      placeholder="Describe the collaboration opportunity, what you're looking for, and what creators can expect..."
                      rows={4}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                      required
                    />
                  </div>

                  {/* Requirements */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Requirements (Press Enter to add)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., 50K+ followers"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const value = e.target.value.trim();
                          if (value) {
                            setCollaborationForm({
                              ...collaborationForm,
                              requirements: [...collaborationForm.requirements, value]
                            });
                            e.target.value = '';
                          }
                        }
                      }}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                    <div className="mt-2 flex flex-wrap gap-2">
                      {collaborationForm.requirements.map((req, index) => (
                        <span key={index} className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm flex items-center gap-1">
                          {req}
                          <button
                            type="button"
                            onClick={() => {
                              setCollaborationForm({
                                ...collaborationForm,
                                requirements: collaborationForm.requirements.filter((_, i) => i !== index)
                              });
                            }}
                            className="ml-1 hover:text-purple-900"
                          >
                            <XMarkIcon className="w-4 h-4" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Compensation */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Compensation *
                    </label>
                    <input
                      type="text"
                      value={collaborationForm.compensation}
                      onChange={(e) => setCollaborationForm({...collaborationForm, compensation: e.target.value})}
                      placeholder="e.g., 500 tokens + content, Paid partnership, etc."
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      required
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-3 pt-4 border-t">
                    <button
                      type="button"
                      onClick={() => setShowPostCollaborationModal(false)}
                      className="px-6 py-2.5 text-gray-700 hover:text-gray-900 font-medium transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      onClick={(e) => {
                        e.preventDefault();
                        if (collaborationForm.title && collaborationForm.location && collaborationForm.date && 
                            collaborationForm.description && collaborationForm.compensation) {
                          // toast.success('Collaboration posted successfully!');
                          setShowPostCollaborationModal(false);
                          setCollaborationForm({
                            title: '',
                            type: 'photoshoot',
                            location: '',
                            date: '',
                            description: '',
                            requirements: [],
                            compensation: ''
                          });
                        } else {
                          toast.error('Please fill in all required fields');
                        }
                      }}
                      className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium hover:shadow-lg transition-all"
                    >
                      Post Collaboration
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        </AnimatePresence>
      )}
    </div>
  );
};

export default CreatorConnect;