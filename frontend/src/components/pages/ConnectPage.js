import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UserGroupIcon,
  SparklesIcon,
  GlobeAltIcon,
  MapPinIcon,
  LightBulbIcon,
  CalendarIcon,
  PlusIcon,
  UsersIcon,
  VideoCameraIcon,
  CameraIcon,
  MusicalNoteIcon,
  PaintBrushIcon,
  BeakerIcon,
  FireIcon,
  ChartBarIcon,
  CodeBracketIcon,
  BookOpenIcon,
  ArrowRightIcon,
  CurrencyDollarIcon,
  XMarkIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { useApp } from '../../hooks/useApp';
import { getAuthToken } from '../../utils/auth-helpers';

const ConnectPage = ({ user, isCreator }) => {
  const { state } = useApp();
  
  // Check URL params for section
  const urlParams = new URLSearchParams(window.location.search);
  const sectionParam = urlParams.get('section');
  const initialSection = sectionParam === 'collaborate' ? 'collaborate' : 'travel';
  
  const [activeSection, setActiveSection] = useState(initialSection);
  const [collaborations, setCollaborations] = useState([]);
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewCollabModal, setShowNewCollabModal] = useState(false);
  const [showNewTripModal, setShowNewTripModal] = useState(false);
  const [newCollabData, setNewCollabData] = useState({
    title: '',
    description: '',
    category: 'Co-streaming',
    requirements: '',
    benefits: '',
    duration: '1 week',
    targetAudience: ''
  });

  const sections = [
    { id: 'travel', label: 'Experiences', icon: GlobeAltIcon },
    { id: 'collaborate', label: 'Collaboration Hub', icon: SparklesIcon }
  ];

  const contentCategories = [
    { id: 'all', label: 'All Categories', icon: SparklesIcon },
    { id: 'gaming', label: 'Gaming', icon: VideoCameraIcon },
    { id: 'music', label: 'Music', icon: MusicalNoteIcon },
    { id: 'art', label: 'Art & Design', icon: PaintBrushIcon },
    { id: 'cooking', label: 'Cooking', icon: BeakerIcon },
    { id: 'fitness', label: 'Fitness', icon: FireIcon },
    { id: 'tech', label: 'Tech & Coding', icon: CodeBracketIcon },
    { id: 'business', label: 'Business', icon: ChartBarIcon }
  ];

  // Mock data for demonstration
  const mockCollaborations = [
    {
      id: 1,
      title: 'Looking for co-host for cooking streams',
      description: 'I stream cooking content 3x/week and looking for someone to co-host themed cooking challenges.',
      creator: {
        id: 'creator1',
        name: 'ChefMaria',
        avatar: '/api/placeholder/40/40',
        rating: 4.8,
        followers: 12500
      },
      type: 'Co-streaming',
      categories: ['cooking', 'entertainment'],
      requirements: '5k+ followers, cooking experience',
      benefits: 'Revenue split, cross-promotion',
      postedAt: new Date(Date.now() - 86400000)
    },
    {
      id: 2,
      title: 'Fashion Week Coverage Partnership',
      description: 'Planning comprehensive Fashion Week coverage across multiple cities. Need partners for different locations.',
      creator: {
        id: 'creator2',
        name: 'StyleIcon',
        avatar: '/api/placeholder/40/40',
        rating: 4.9,
        followers: 45000
      },
      type: 'Content Series',
      categories: ['fashion', 'travel'],
      requirements: 'Fashion content creator, travel ready',
      benefits: 'Sponsored travel, brand deals',
      postedAt: new Date(Date.now() - 172800000)
    }
  ];

  // Mock trips data
  const mockTrips = [
    {
      id: 1,
      destination: 'Miami Beach Retreat',
      location: 'Miami, Florida',
      dates: 'March 15-20, 2024',
      organizer: 'Digis',
      organizerAvatar: '🌴',
      description: 'Exclusive creator retreat with workshops, networking, and beachside content creation.',
      activities: ['Content Workshops', 'Networking Events', 'Beach Photoshoots', 'Brand Meetups'],
      tokenCost: 25000,
      maxParticipants: 20,
      participants: 12,
      image: 'https://images.unsplash.com/photo-1506929562872-bb421503ef21?w=800&h=600&fit=crop',
      category: 'Retreat',
      duration: '5 days'
    },
    {
      id: 2,
      destination: 'NYC Creator Week',
      location: 'New York City',
      dates: 'April 5-10, 2024',
      organizer: 'Digis',
      organizerAvatar: '🗽',
      description: 'Experience the best of NYC with exclusive access to studios, events, and creator spaces.',
      activities: ['Studio Tours', 'Broadway Shows', 'Creator Meetups', 'Brand Partnerships'],
      tokenCost: 30000,
      maxParticipants: 15,
      participants: 8,
      image: 'https://images.unsplash.com/photo-1522083165195-3424ed129620?w=800&h=600&fit=crop',
      category: 'Workshop',
      duration: '5 days'
    },
    {
      id: 3,
      destination: 'Bali Content Creation',
      location: 'Bali, Indonesia',
      dates: 'May 1-7, 2024',
      organizer: 'Digis',
      organizerAvatar: '🏝️',
      description: 'Create stunning content in paradise with professional photographers and videographers.',
      activities: ['Sunrise Shoots', 'Temple Tours', 'Beach Sessions', 'Cultural Experiences'],
      tokenCost: 35000,
      maxParticipants: 12,
      participants: 10,
      image: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=800&h=600&fit=crop',
      category: 'Adventure',
      duration: '7 days'
    },
    {
      id: 4,
      destination: 'LA Fashion Week',
      location: 'Los Angeles',
      dates: 'June 10-15, 2024',
      organizer: 'Digis',
      organizerAvatar: '✨',
      description: 'Front row access to Fashion Week with exclusive designer meetups and afterparties.',
      activities: ['Fashion Shows', 'Designer Meetups', 'Photo Shoots', 'VIP Events'],
      tokenCost: 40000,
      maxParticipants: 10,
      participants: 6,
      image: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800&h=600&fit=crop',
      category: 'Fashion',
      duration: '5 days'
    }
  ];

  useEffect(() => {
    fetchData();
  }, []);
  
  const fetchData = async () => {
    setLoading(true);
    await Promise.all([
      fetchCollaborations(),
      fetchExperiences()
    ]);
    setLoading(false);
  };

  // Fetch collaborations
  const fetchCollaborations = async () => {
    try {
      let headers = {};
      if (user) {
        const authToken = await getAuthToken();
        headers = { 'Authorization': `Bearer ${authToken}` };
      }
      
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/public/collaborations`, {
        headers
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Map API response to expected format
        const apiCollabs = (data.collaborations || []).map(collab => ({
          id: collab.id,
          title: collab.title,
          description: collab.description,
          creator: {
            id: collab.creator_id,
            name: collab.creator_name || collab.creator_username,
            avatar: collab.creator_avatar,
            rating: collab.creator_rating || 0,
            followers: collab.creator_followers || 0
          },
          type: collab.collaboration_type || 'Co-streaming',
          categories: collab.categories || [],
          requirements: collab.requirements,
          benefits: collab.benefits,
          postedAt: new Date(collab.created_at)
        }));
        
        setCollaborations(apiCollabs.length > 0 ? apiCollabs : mockCollaborations);
      } else {
        setCollaborations(mockCollaborations);
      }
    } catch (error) {
      console.error('Error fetching collaborations:', error);
      setCollaborations(mockCollaborations);
    }
  };
  
  // Fetch experiences/trips
  const fetchExperiences = async () => {
    try {
      let headers = {};
      if (user) {
        const authToken = await getAuthToken();
        headers = { 'Authorization': `Bearer ${authToken}` };
      }
      
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/public/experiences`, {
        headers
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Map API response to expected format
        const apiTrips = (data.experiences || []).map(exp => ({
          id: exp.id,
          destination: exp.title,
          location: exp.location,
          dates: exp.dates,
          organizer: exp.organizer || 'Digis',
          organizerAvatar: exp.organizer_avatar || '🌴',
          description: exp.description,
          activities: exp.activities || [],
          tokenCost: exp.token_cost,
          maxParticipants: exp.max_participants,
          participants: exp.current_participants || 0,
          image: exp.image_url,
          category: exp.category,
          duration: exp.duration
        }));
        
        setTrips(apiTrips.length > 0 ? apiTrips : mockTrips);
      } else {
        setTrips(mockTrips);
      }
    } catch (error) {
      console.error('Error fetching experiences:', error);
      setTrips(mockTrips);
    }
  };

  // Handle apply collaboration
  const handleApplyCollaboration = async (collab) => {
    if (!user) {
      toast.error('Please sign in to apply for collaborations');
      return;
    }

    try {
      const authToken = await getAuthToken();
      
      // Send application
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/collaborations/${collab.id}/apply`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: `Hi! I'm interested in your ${collab.type} collaboration. I'd love to discuss how we can work together!`
        })
      });

      if (response.ok) {
        // Auto-send message to creator
        await sendAutoMessage(collab.creator.id, collab.title);
        
        // toast.success('Application sent! The creator will be notified.');
      } else {
        throw new Error('Failed to apply');
      }
    } catch (error) {
      console.error('Error applying to collaboration:', error);
      toast.error('Failed to send application. Please try again.');
    }
  };

  // Auto-send message to creator
  const sendAutoMessage = async (creatorId, collabTitle) => {
    try {
      const authToken = await getAuthToken();
      
      await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          recipientId: creatorId,
          content: `New collaboration application for "${collabTitle}"! Check your collaboration requests to review the application.`,
          type: 'collaboration_application'
        })
      });
    } catch (error) {
      console.error('Error sending auto-message:', error);
    }
  };

  // Handle submit new collaboration
  const handleSubmitCollaboration = async (e) => {
    e.preventDefault();
    
    if (!user) {
      toast.error('Please sign in to post collaborations');
      return;
    }

    try {
      const authToken = await getAuthToken();
      
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/collaborations`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newCollabData)
      });

      if (response.ok) {
        // toast.success('Collaboration posted successfully!');
        setShowNewCollabModal(false);
        setNewCollabData({
          title: '',
          description: '',
          category: 'Co-streaming',
          requirements: '',
          benefits: '',
          duration: '1 week',
          targetAudience: ''
        });
        // Refresh collaborations
        fetchCollaborations();
      } else {
        throw new Error('Failed to post collaboration');
      }
    } catch (error) {
      console.error('Error posting collaboration:', error);
      toast.error('Failed to post collaboration. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-white dark:from-purple-950 dark:via-pink-950 dark:to-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Section Tabs */}
        <div className="flex space-x-1 mb-8 bg-white dark:bg-gray-800 rounded-xl p-1 shadow-sm">
          {sections.map(section => {
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 px-6 rounded-lg font-semibold transition-all ${
                  activeSection === section.id
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <Icon className="w-5 h-5" />
                {section.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {activeSection === 'collaborate' && (
            <CollaborationHub
              collaborations={collaborations}
              showNewCollabModal={showNewCollabModal}
              setShowNewCollabModal={setShowNewCollabModal}
              contentCategories={contentCategories}
              handleApplyCollaboration={handleApplyCollaboration}
            />
          )}
          
          {activeSection === 'travel' && (
            <ExperiencesSection
              trips={trips}
              showNewTripModal={showNewTripModal}
              setShowNewTripModal={setShowNewTripModal}
              isAdmin={user?.isAdmin}
              user={user}
            />
          )}
        </AnimatePresence>

        {/* New Collaboration Modal */}
        <AnimatePresence>
          {showNewCollabModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
              onClick={() => setShowNewCollabModal(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              >
                {/* Modal Header */}
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Post New Collaboration</h2>
                    <button
                      onClick={() => setShowNewCollabModal(false)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      <XMarkIcon className="w-6 h-6 text-gray-500 dark:text-gray-400" />
                    </button>
                  </div>
                </div>

                {/* Modal Body */}
                <form className="p-6 space-y-6" onSubmit={handleSubmitCollaboration}>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Title</label>
                    <input
                      type="text"
                      value={newCollabData.title}
                      onChange={(e) => setNewCollabData({...newCollabData, title: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="e.g., Fashion Week Co-streaming Partner"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Category</label>
                    <select
                      value={newCollabData.category}
                      onChange={(e) => setNewCollabData({...newCollabData, category: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="Co-streaming">Co-streaming</option>
                      <option value="Content Series">Content Series</option>
                      <option value="Cross-promotion">Cross-promotion</option>
                      <option value="Skill Exchange">Skill Exchange</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Description</label>
                    <textarea
                      value={newCollabData.description}
                      onChange={(e) => setNewCollabData({...newCollabData, description: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none resize-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      rows={4}
                      placeholder="Describe your collaboration opportunity..."
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Requirements</label>
                    <textarea
                      value={newCollabData.requirements}
                      onChange={(e) => setNewCollabData({...newCollabData, requirements: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none resize-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      rows={3}
                      placeholder="What are you looking for in a collaborator?"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Benefits</label>
                    <textarea
                      value={newCollabData.benefits}
                      onChange={(e) => setNewCollabData({...newCollabData, benefits: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none resize-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      rows={3}
                      placeholder="What benefits will collaborators receive?"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Duration</label>
                      <select
                        value={newCollabData.duration}
                        onChange={(e) => setNewCollabData({...newCollabData, duration: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="1 week">1 week</option>
                        <option value="2 weeks">2 weeks</option>
                        <option value="1 month">1 month</option>
                        <option value="3 months">3 months</option>
                        <option value="Ongoing">Ongoing</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Target Audience</label>
                      <input
                        type="text"
                        value={newCollabData.targetAudience}
                        onChange={(e) => setNewCollabData({...newCollabData, targetAudience: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="e.g., Fashion enthusiasts"
                      />
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div className="flex gap-4 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowNewCollabModal(false)}
                      className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all"
                    >
                      Post Collaboration
                    </button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

// Sub-components for each section
const CollaborationHub = ({ collaborations, showNewCollabModal, setShowNewCollabModal, contentCategories, handleApplyCollaboration }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-bold mb-2 bg-gradient-to-r from-purple-600 to-pink-600 dark:from-purple-400 dark:to-pink-400 text-transparent bg-clip-text">Active Collaborations</h2>
          <p className="text-gray-600 dark:text-gray-400 text-lg">Find your next creative partnership</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowNewCollabModal(true)}
          className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl font-semibold flex items-center gap-2 text-white shadow-lg hover:shadow-xl transition-all"
        >
          <PlusIcon className="w-5 h-5" />
          Post Collaboration
        </motion.button>
      </div>


      {/* Collaboration Listings */}
      <div className="space-y-6">
        {collaborations.map((collab, index) => {
          const categoryIcons = collab.categories.map(catId => {
            const cat = contentCategories.find(c => c.id === catId);
            return cat ? { Icon: cat.icon, label: cat.label, id: cat.id } : null;
          }).filter(Boolean);

          return (
            <motion.div
              key={collab.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-white">{collab.title}</h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">{collab.description}</p>
                  
                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full flex items-center justify-center text-white font-bold">
                        {collab.creator.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-semibold">{collab.creator.name}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{collab.creator.followers.toLocaleString()} followers</p>
                      </div>
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      Posted {Math.floor((Date.now() - collab.postedAt) / 86400000)}d ago
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mb-4">
                    <span className="font-medium">Requirements:</span>
                    <span>{collab.requirements}</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <div className="flex items-center gap-2">
                  {categoryIcons.map(({ Icon, label, id }) => {
                    return (
                      <span key={id} className="flex items-center gap-1 px-4 py-2 bg-gradient-to-r from-purple-100 to-pink-100 text-purple-800 rounded-full text-sm font-medium">
                        <Icon className="w-4 h-4" />
                        {label}
                      </span>
                    );
                  })}
                </div>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleApplyCollaboration(collab)}
                  className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all flex items-center gap-2"
                >
                  Apply Now
                  <ArrowRightIcon className="w-4 h-4" />
                </motion.button>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
};

const ExperiencesSection = ({ trips, showNewTripModal, setShowNewTripModal, isAdmin, user }) => {
  const [selectedExperience, setSelectedExperience] = useState(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showCreatorExperienceModal, setShowCreatorExperienceModal] = useState(false);
  const [creatorExperienceData, setCreatorExperienceData] = useState({
    title: '',
    destination: '',
    description: '',
    duration: '',
    maxParticipants: '',
    tokenCost: '',
    activities: '',
    includes: '',
    notIncludes: '',
    packingList: '',
    itinerary: ''
  });

  const handleBookExperience = async (experience) => {
    if (!user) {
      toast.error('Please sign in to book experiences');
      return;
    }

    // Check if experience is full
    if (experience.participants >= experience.maxParticipants) {
      // Add to waitlist
      toast.info('This experience is full. You\'ve been added to the waitlist.');
      // TODO: Implement waitlist API call
      return;
    }

    try {
      // TODO: Implement actual booking API
      // Deduct tokens and confirm booking
      // toast.success('Booking confirmed! Check your messages for details.');
      
      // Send confirmation message
      // TODO: Send message via API
      
      setShowBookingModal(false);
      setSelectedExperience(null);
    } catch (error) {
      toast.error('Failed to book experience. Please try again.');
    }
  };

  const handleSubmitCreatorExperience = async (e) => {
    e.preventDefault();
    
    try {
      // TODO: Submit to admin for approval
      // toast.success('Experience submitted for admin approval!');
      setShowCreatorExperienceModal(false);
      setCreatorExperienceData({
        title: '',
        destination: '',
        description: '',
        duration: '',
        maxParticipants: '',
        tokenCost: '',
        activities: '',
        includes: '',
        notIncludes: '',
        packingList: '',
        itinerary: ''
      });
    } catch (error) {
      toast.error('Failed to submit experience. Please try again.');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-bold mb-2 bg-gradient-to-r from-purple-600 to-pink-600 dark:from-purple-400 dark:to-pink-400 text-transparent bg-clip-text">Creator Experiences</h2>
          <p className="text-gray-600 dark:text-gray-400 text-lg">Exclusive experiences created by Digis for creators</p>
        </div>
        <div className="flex gap-3">
          {isAdmin && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowNewTripModal(true)}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl font-semibold flex items-center gap-2 text-white shadow-lg hover:shadow-xl transition-all"
            >
              <PlusIcon className="w-5 h-5" />
              Add Experience
            </motion.button>
          )}
          {user?.isCreator && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowCreatorExperienceModal(true)}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-xl font-semibold flex items-center gap-2 text-white shadow-lg hover:shadow-xl transition-all"
            >
              <SparklesIcon className="w-5 h-5" />
              Create Experience
            </motion.button>
          )}
        </div>
      </div>


      {/* Experience Cards - Modern Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {trips.map((trip) => (
          <motion.div
            key={trip.id}
            whileHover={{ y: -4 }}
            transition={{ duration: 0.2 }}
            className="group cursor-pointer"
          >
            <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-gray-800 shadow-sm hover:shadow-xl transition-all duration-300">
              {/* Image Container */}
              <div className="relative h-64 overflow-hidden">
                <img 
                  src={trip.image} 
                  alt={trip.destination}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                
                {/* Category Badge */}
                <div className="absolute top-4 left-4">
                  <span className="px-3 py-1 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-full text-xs font-medium text-gray-800 dark:text-gray-200">
                    {trip.category}
                  </span>
                </div>

                {/* Token Price */}
                <div className="absolute top-4 right-4">
                  <div className="px-3 py-1 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full text-white font-bold text-sm flex items-center gap-1">
                    <CurrencyDollarIcon className="w-4 h-4" />
                    {trip.tokenCost.toLocaleString()}
                  </div>
                </div>

                {/* Title & Location Overlay */}
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <h3 className="text-xl font-bold text-white mb-1">{trip.destination}</h3>
                  <div className="flex items-center gap-2 text-white/90 text-sm">
                    <MapPinIcon className="w-4 h-4" />
                    <span>{trip.location}</span>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-4">
                {/* Organizer & Duration */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-sm">
                      {trip.organizerAvatar}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{trip.organizer}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{trip.duration}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500 dark:text-gray-400">{trip.dates.split('-')[0]}</p>
                    <p className="text-xs font-medium text-gray-700 dark:text-gray-300">{trip.participants} going</p>
                  </div>
                </div>

                {/* Description */}
                <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-3">
                  {trip.description}
                </p>

                {/* Progress Bar */}
                <div className="mb-4">
                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                    <span>{trip.participants} / {trip.maxParticipants} spots</span>
                    <span>{Math.round((trip.participants / trip.maxParticipants) * 100)}% filled</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-purple-600 to-pink-600 rounded-full transition-all duration-500"
                      style={{ width: `${(trip.participants / trip.maxParticipants) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Status & Action Button */}
                {trip.participants >= trip.maxParticipants ? (
                  <button 
                    onClick={() => {
                      setSelectedExperience(trip);
                      handleBookExperience(trip);
                    }}
                    className="w-full py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-medium text-sm transition-colors duration-200"
                  >
                    Join Waitlist
                  </button>
                ) : (
                  <button 
                    onClick={() => {
                      setSelectedExperience(trip);
                      setShowBookingModal(true);
                    }}
                    className="w-full py-2.5 bg-gray-900 hover:bg-black text-white rounded-xl font-medium text-sm transition-colors duration-200 flex items-center justify-center gap-2 group"
                  >
                    <span>Book Now</span>
                    <ArrowRightIcon className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Booking Modal */}
      <AnimatePresence>
        {showBookingModal && selectedExperience && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowBookingModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Book Experience</h2>
                  <button
                    onClick={() => setShowBookingModal(false)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <XMarkIcon className="w-6 h-6 text-gray-500" />
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-6">
                {/* Experience Summary */}
                <div className="mb-6">
                  <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-white">{selectedExperience.destination}</h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">{selectedExperience.description}</p>
                  
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Dates</p>
                      <p className="font-semibold">{selectedExperience.dates}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Duration</p>
                      <p className="font-semibold">{selectedExperience.duration}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Location</p>
                      <p className="font-semibold">{selectedExperience.location}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Available Spots</p>
                      <p className="font-semibold">{selectedExperience.maxParticipants - selectedExperience.participants}</p>
                    </div>
                  </div>
                </div>

                {/* Itinerary */}
                <div className="mb-6">
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <CalendarIcon className="w-5 h-5 text-purple-600" />
                    Itinerary
                  </h4>
                  <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                    <p>Day 1: Arrival and welcome dinner</p>
                    <p>Day 2-4: Workshops and activities</p>
                    <p>Day 5: Departure</p>
                  </div>
                </div>

                {/* What's Included */}
                <div className="mb-6">
                  <h4 className="font-semibold mb-2">What's Included</h4>
                  <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400 space-y-1">
                    <li>Accommodation for all nights</li>
                    <li>All meals and beverages</li>
                    <li>Workshop materials and sessions</li>
                    <li>Airport transfers</li>
                    <li>Professional photography</li>
                  </ul>
                </div>

                {/* What's Not Included */}
                <div className="mb-6">
                  <h4 className="font-semibold mb-2">What's Not Included</h4>
                  <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400 space-y-1">
                    <li>Flights to/from destination</li>
                    <li>Personal expenses</li>
                    <li>Travel insurance</li>
                    <li>Visa fees (if applicable)</li>
                  </ul>
                </div>

                {/* Packing List */}
                <div className="mb-6">
                  <h4 className="font-semibold mb-2">Suggested Packing List</h4>
                  <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400 space-y-1">
                    <li>Comfortable clothing for workshops</li>
                    <li>Swimwear (if beach/pool activities)</li>
                    <li>Camera/phone for content creation</li>
                    <li>Laptop (if needed for workshops)</li>
                    <li>Sunscreen and personal items</li>
                  </ul>
                </div>

                {/* Pricing */}
                <div className="p-4 bg-purple-50 rounded-xl mb-6">
                  <div className="flex items-center justify-between">
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">Total Cost</p>
                    <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{selectedExperience.tokenCost.toLocaleString()} Tokens</p>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Payment will be processed immediately upon confirmation</p>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowBookingModal(false)}
                    className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleBookExperience(selectedExperience)}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all font-medium"
                  >
                    Confirm Booking
                  </button>
                </div>

                {/* Direct Message Organizer */}
                <div className="mt-4 text-center">
                  <button className="text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 text-sm font-medium">
                    Message Organizer (Digis Admin)
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Creator Experience Modal */}
      <AnimatePresence>
        {showCreatorExperienceModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowCreatorExperienceModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Create Your Experience</h2>
                  <button
                    onClick={() => setShowCreatorExperienceModal(false)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <XMarkIcon className="w-6 h-6 text-gray-500" />
                  </button>
                </div>
                <p className="text-gray-600 dark:text-gray-400 mt-2">Submit your experience for admin approval</p>
              </div>

              {/* Modal Body */}
              <form className="p-6 space-y-4" onSubmit={handleSubmitCreatorExperience}>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Experience Title</label>
                  <input
                    type="text"
                    value={creatorExperienceData.title}
                    onChange={(e) => setCreatorExperienceData({...creatorExperienceData, title: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="e.g., Photography Workshop in Paris"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Destination</label>
                  <input
                    type="text"
                    value={creatorExperienceData.destination}
                    onChange={(e) => setCreatorExperienceData({...creatorExperienceData, destination: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="e.g., Paris, France"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                  <textarea
                    value={creatorExperienceData.description}
                    onChange={(e) => setCreatorExperienceData({...creatorExperienceData, description: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    rows={3}
                    placeholder="Describe your experience..."
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Duration</label>
                    <input
                      type="text"
                      value={creatorExperienceData.duration}
                      onChange={(e) => setCreatorExperienceData({...creatorExperienceData, duration: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="e.g., 5 days"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Max Participants</label>
                    <input
                      type="number"
                      value={creatorExperienceData.maxParticipants}
                      onChange={(e) => setCreatorExperienceData({...creatorExperienceData, maxParticipants: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="e.g., 15"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Token Cost per Person</label>
                  <input
                    type="number"
                    value={creatorExperienceData.tokenCost}
                    onChange={(e) => setCreatorExperienceData({...creatorExperienceData, tokenCost: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="e.g., 25000"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Activities</label>
                  <textarea
                    value={creatorExperienceData.activities}
                    onChange={(e) => setCreatorExperienceData({...creatorExperienceData, activities: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    rows={2}
                    placeholder="List main activities..."
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">What's Included</label>
                  <textarea
                    value={creatorExperienceData.includes}
                    onChange={(e) => setCreatorExperienceData({...creatorExperienceData, includes: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    rows={2}
                    placeholder="What's included in the experience..."
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">What's Not Included</label>
                  <textarea
                    value={creatorExperienceData.notIncludes}
                    onChange={(e) => setCreatorExperienceData({...creatorExperienceData, notIncludes: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    rows={2}
                    placeholder="What participants need to arrange themselves..."
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Detailed Itinerary</label>
                  <textarea
                    value={creatorExperienceData.itinerary}
                    onChange={(e) => setCreatorExperienceData({...creatorExperienceData, itinerary: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    rows={3}
                    placeholder="Day by day breakdown..."
                    required
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreatorExperienceModal(false)}
                    className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all font-medium"
                  >
                    Submit for Approval
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </motion.div>
  );
};

export default ConnectPage;