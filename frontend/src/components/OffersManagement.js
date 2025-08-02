import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Edit, Trash2, DollarSign, Package, Clock, X, Star, TrendingUp, Users, Filter, Search, Grid, List, ChevronDown, Eye, EyeOff, Tag, Sparkles } from 'lucide-react';
import Skeleton from './ui/Skeleton';
import toast from 'react-hot-toast';
import { supabase } from '../utils/supabase-auth';

const OffersManagement = ({ user }) => {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingOffer, setEditingOffer] = useState(null);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  const [filterCategory, setFilterCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('recent'); // 'recent', 'price', 'purchases'
  const [showFilters, setShowFilters] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'General',
    priceTokens: '',
    deliveryTime: '',
    maxQuantity: ''
  });

  const categories = [
    'General',
    'Social Media',
    'Content Creation',
    'Collaboration',
    'Custom Request',
    'Exclusive Content',
    'Shoutout',
    'Review/Feedback'
  ];

  const categoryIcons = {
    'General': '📦',
    'Social Media': '📱',
    'Content Creation': '🎨',
    'Collaboration': '🤝',
    'Custom Request': '✨',
    'Exclusive Content': '🔐',
    'Shoutout': '📢',
    'Review/Feedback': '💬'
  };

  const deliveryTimeOptions = [
    'Instant',
    '24 hours',
    '48 hours',
    '3 days',
    '1 week',
    '2 weeks',
    'Custom'
  ];

  useEffect(() => {
    fetchMyOffers();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchMyOffers = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      if (!token) {
        console.error('No auth token available');
        toast.error('Please sign in to view offers');
        setLoading(false);
        return;
      }
      
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/offers/my-offers`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch offers');

      const data = await response.json();
      // Add a sample offer if no offers exist
      if (data.offers.length === 0) {
        setOffers([{
          id: 'sample-offer',
          title: 'Instagram Follow',
          description: 'I will follow you on Instagram with my verified account',
          category: 'Social Media',
          priceTokens: 5000,
          deliveryTime: '24 hours',
          maxQuantity: 100,
          active: true,
          isSample: true
        }]);
      } else {
        setOffers(data.offers);
      }
    } catch (error) {
      console.error('Error fetching offers:', error);
      toast.error('Failed to load offers');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      category: 'General',
      priceTokens: '',
      deliveryTime: '',
      maxQuantity: ''
    });
    setEditingOffer(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      if (!token) {
        toast.error('Please sign in to manage offers');
        return;
      }
      // Always create a new offer if editing a sample
      const isSampleOffer = editingOffer?.isSample;
      const url = editingOffer && !isSampleOffer
        ? `${import.meta.env.VITE_BACKEND_URL}/api/offers/${editingOffer.id}`
        : `${import.meta.env.VITE_BACKEND_URL}/api/offers/create`;
      
      const method = editingOffer && !isSampleOffer ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...formData,
          priceTokens: parseInt(formData.priceTokens),
          maxQuantity: formData.maxQuantity ? parseInt(formData.maxQuantity) : null
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save offer');
      }

      // toast.success(editingOffer && !editingOffer.isSample ? 'Offer updated!' : 'Offer created!');
      setShowAddModal(false);
      resetForm();
      fetchMyOffers();
    } catch (error) {
      console.error('Error saving offer:', error);
      toast.error(error.message);
    }
  };

  const handleEdit = (offer) => {
    // If it's a sample offer, treat it as creating a new offer
    if (offer.isSample) {
      setEditingOffer(null);
    } else {
      setEditingOffer(offer);
    }
    setFormData({
      title: offer.title,
      description: offer.description || '',
      category: offer.category || 'General',
      priceTokens: offer.priceTokens.toString(),
      deliveryTime: offer.deliveryTime || '',
      maxQuantity: offer.maxQuantity?.toString() || ''
    });
    setShowAddModal(true);
  };

  const handleDelete = async (offerId) => {
    if (!window.confirm('Are you sure you want to delete this offer?')) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      if (!token) {
        toast.error('Please sign in to delete offers');
        return;
      }
      
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/offers/${offerId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete offer');
      }

      // toast.success('Offer deleted');
      fetchMyOffers();
    } catch (error) {
      console.error('Error deleting offer:', error);
      toast.error(error.message);
    }
  };

  const toggleActive = async (offer) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      if (!token) {
        toast.error('Please sign in to update offers');
        return;
      }
      
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/offers/${offer.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ active: !offer.active })
      });

      if (!response.ok) throw new Error('Failed to update offer');

      // toast.success(offer.active ? 'Offer deactivated' : 'Offer activated');
      fetchMyOffers();
    } catch (error) {
      console.error('Error toggling offer:', error);
      toast.error('Failed to update offer');
    }
  };

  if (loading) {
    return (
      <div className="p-4">
        <div className="flex items-center justify-between mb-6">
          <Skeleton variant="text" width="w-48" height="h-8" />
          <Skeleton.Button size="md" />
        </div>
        <Skeleton.Grid items={6} columns={3} renderItem={(i) => (
          <div key={i} className="glass-medium rounded-lg p-4">
            <div className="flex justify-between items-start mb-3">
              <Skeleton variant="text" width="w-32" height="h-6" />
              <Skeleton variant="rounded" width="w-16" height="h-5" />
            </div>
            <Skeleton.Text lines={2} className="mb-3" />
            <div className="space-y-2 mb-4">
              <Skeleton variant="text" width="w-24" height="h-4" />
              <Skeleton variant="text" width="w-20" height="h-4" />
              <Skeleton variant="text" width="w-16" height="h-4" />
            </div>
            <div className="flex items-center justify-between border-t pt-3">
              <Skeleton variant="text" width="w-20" height="h-4" />
              <div className="flex space-x-2">
                <Skeleton variant="circular" width="w-6" height="h-6" />
                <Skeleton variant="circular" width="w-6" height="h-6" />
                <Skeleton variant="circular" width="w-6" height="h-6" />
              </div>
            </div>
          </div>
        )} />
      </div>
    );
  }

  // Stats calculation
  const totalEarnings = offers.reduce((sum, offer) => sum + (offer.totalEarnings || 0), 0);
  const totalPurchases = offers.reduce((sum, offer) => sum + (offer.totalPurchases || 0), 0);
  const activeOffers = offers.filter(offer => offer.active).length;

  // Filter and sort offers
  const filteredOffers = offers
    .filter(offer => filterCategory === 'All' || offer.category === filterCategory)
    .filter(offer => offer.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                     offer.description?.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      switch (sortBy) {
        case 'price':
          return b.priceTokens - a.priceTokens;
        case 'purchases':
          return (b.totalPurchases || 0) - (a.totalPurchases || 0);
        default: // 'recent'
          return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      }
    });

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Manage Offers</h2>
              <p className="text-gray-600">Create and manage services for your fans</p>
            </div>
            <button
              onClick={() => {
                resetForm();
                setShowAddModal(true);
              }}
              className="flex items-center px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              <Plus className="w-5 h-5 mr-2" />
              Create Offer
            </button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white rounded-xl shadow-sm p-6 border border-gray-100"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Total Offers</p>
                  <p className="text-2xl font-bold text-gray-900">{offers.length}</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Package className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white rounded-xl shadow-sm p-6 border border-gray-100"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Active Offers</p>
                  <p className="text-2xl font-bold text-green-600">{activeOffers}</p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white rounded-xl shadow-sm p-6 border border-gray-100"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Total Purchases</p>
                  <p className="text-2xl font-bold text-gray-900">{totalPurchases}</p>
                </div>
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Users className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-gradient-to-r from-yellow-400 to-orange-500 rounded-xl shadow-sm p-6 text-white"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white/90 mb-1">Total Earnings</p>
                  <p className="text-2xl font-bold">{totalEarnings.toLocaleString()} tokens</p>
                </div>
                <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
              </div>
            </motion.div>
          </div>

          {/* Filters and Search Bar */}
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Search */}
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Search offers..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Filter and Sort Controls */}
              <div className="flex gap-2">
                {/* Category Filter */}
                <div className="relative">
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className="flex items-center px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <Filter className="w-4 h-4 mr-2" />
                    {filterCategory}
                    <ChevronDown className="w-4 h-4 ml-2" />
                  </button>
                  {showFilters && (
                    <div className="absolute top-full mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                      <button
                        onClick={() => {
                          setFilterCategory('All');
                          setShowFilters(false);
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors"
                      >
                        All Categories
                      </button>
                      {categories.map(cat => (
                        <button
                          key={cat}
                          onClick={() => {
                            setFilterCategory(cat);
                            setShowFilters(false);
                          }}
                          className="w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors flex items-center"
                        >
                          <span className="mr-2">{categoryIcons[cat]}</span>
                          {cat}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Sort Dropdown */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <option value="recent">Most Recent</option>
                  <option value="price">Highest Price</option>
                  <option value="purchases">Most Popular</option>
                </select>

                {/* View Mode Toggle */}
                <div className="flex border border-gray-200 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-2 ${viewMode === 'grid' ? 'bg-blue-500 text-white' : 'hover:bg-gray-50'} transition-colors`}
                  >
                    <Grid className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-2 ${viewMode === 'list' ? 'bg-blue-500 text-white' : 'hover:bg-gray-50'} transition-colors`}
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Offers Grid/List */}
        {filteredOffers.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl shadow-sm">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No offers found</h3>
            <p className="text-gray-600 mb-4">
              {searchQuery || filterCategory !== 'All' 
                ? 'Try adjusting your filters' 
                : 'Create your first offer to start earning'}
            </p>
            {!searchQuery && filterCategory === 'All' && (
              <button
                onClick={() => {
                  resetForm();
                  setShowAddModal(true);
                }}
                className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                Create Offer
              </button>
            )}
          </div>
        ) : (
          <div className={viewMode === 'grid' ? "grid gap-6 md:grid-cols-2 lg:grid-cols-3" : "space-y-4"}>
            {filteredOffers.map((offer) => (
              <motion.div
                key={offer.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: -4 }}
                className={`bg-white rounded-xl shadow-sm hover:shadow-xl transition-all duration-300 p-6 border border-gray-100 ${!offer.active ? 'opacity-60' : ''} ${offer.isSample ? 'border-2 border-blue-400 relative overflow-hidden' : ''} ${viewMode === 'list' ? 'flex items-center justify-between' : ''}`}
              >
                {offer.isSample && (
                  <div className="absolute top-0 right-0 bg-gradient-to-r from-blue-500 to-purple-600 text-white text-xs px-4 py-2 rounded-bl-xl font-medium shadow-lg">
                    <Sparkles className="w-3 h-3 inline mr-1" />
                    Sample Offer
                  </div>
                )}
                {viewMode === 'grid' ? (
                  // Grid View Layout
                  <>
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-2xl">{categoryIcons[offer.category] || '📦'}</span>
                          <h3 className="font-bold text-lg text-gray-900">{offer.title}</h3>
                        </div>
                        <span className="text-xs text-gray-500 uppercase tracking-wide">{offer.category}</span>
                      </div>
                      <span className={`px-3 py-1 text-xs font-medium rounded-full flex items-center gap-1 ${
                        offer.active 
                          ? 'bg-green-100 text-green-700 border border-green-200' 
                          : 'bg-gray-100 text-gray-600 border border-gray-200'
                      }`}>
                        {offer.active ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                        {offer.active ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    <p className="text-gray-600 text-sm mb-4 line-clamp-3 min-h-[3rem]">
                      {offer.description || 'No description provided'}
                    </p>

                    <div className="space-y-3 mb-4">
                      <div className="flex items-center justify-between p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-100">
                        <div className="flex items-center">
                          <DollarSign className="w-5 h-5 text-green-600 mr-2" />
                          <span className="font-bold text-lg text-green-700">{offer.priceTokens.toLocaleString()}</span>
                          <span className="text-sm text-green-600 ml-1">tokens</span>
                        </div>
                        {offer.totalEarnings > 0 && (
                          <span className="text-sm font-medium text-green-600">
                            +{offer.totalEarnings.toLocaleString()}
                          </span>
                        )}
                      </div>
                      
                      {offer.deliveryTime && (
                        <div className="flex items-center text-sm text-gray-600 p-2 bg-gray-50 rounded-lg">
                          <Clock className="w-4 h-4 mr-2 text-gray-500" />
                          <span>Delivery: <strong>{offer.deliveryTime}</strong></span>
                        </div>
                      )}
                      
                      {offer.maxQuantity && (
                        <div className="flex items-center text-sm text-gray-600">
                          <Tag className="w-4 h-4 mr-2" />
                          <span>Limited: {offer.maxQuantity} available</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between border-t pt-4">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center text-sm text-gray-600">
                          <Users className="w-4 h-4 mr-1" />
                          <span className="font-medium">{offer.totalPurchases || 0}</span>
                          <span className="ml-1">purchases</span>
                        </div>
                        {offer.totalPurchases > 0 && (
                          <div className="flex items-center">
                            <Star className="w-4 h-4 text-yellow-500 mr-1" />
                            <span className="text-sm font-medium">Popular</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleEdit(offer)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit offer"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => toggleActive(offer)}
                          className={`p-2 rounded-lg transition-colors ${
                            offer.active 
                              ? 'text-gray-600 hover:bg-gray-50' 
                              : 'text-green-600 hover:bg-green-50'
                          }`}
                          title={offer.active ? 'Deactivate offer' : 'Activate offer'}
                        >
                          {offer.active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                        {!offer.isSample && (
                          <button
                            onClick={() => handleDelete(offer.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete offer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  // List View Layout
                  <>
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-purple-100 rounded-lg flex items-center justify-center text-2xl">
                        {categoryIcons[offer.category] || '📦'}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-lg text-gray-900">{offer.title}</h3>
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                            offer.active 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            {offer.active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <p className="text-gray-600 text-sm line-clamp-1">
                          {offer.description || 'No description'}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-sm">
                          <span className="text-gray-500">{offer.category}</span>
                          {offer.deliveryTime && (
                            <span className="flex items-center text-gray-500">
                              <Clock className="w-3 h-3 mr-1" />
                              {offer.deliveryTime}
                            </span>
                          )}
                          <span className="flex items-center text-gray-600">
                            <Users className="w-3 h-3 mr-1" />
                            {offer.totalPurchases || 0} purchases
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-lg text-green-600">
                          {offer.priceTokens.toLocaleString()} tokens
                        </div>
                        {offer.totalEarnings > 0 && (
                          <div className="text-sm text-gray-500">
                            Earned: {offer.totalEarnings.toLocaleString()}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleEdit(offer)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => toggleActive(offer)}
                          className={`p-2 rounded-lg transition-colors ${
                            offer.active 
                              ? 'text-gray-600 hover:bg-gray-50' 
                              : 'text-green-600 hover:bg-green-50'
                          }`}
                        >
                          {offer.active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                        {!offer.isSample && (
                          <button
                            onClick={() => handleDelete(offer.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </motion.div>
            ))}
          </div>
        )}

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto"
            onClick={() => setShowAddModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl p-8 max-w-md w-full my-8 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">
                    {editingOffer ? 'Edit Offer' : 'Create Offer'}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {editingOffer ? 'Update your offer details' : 'Set up a new service for your fans'}
                  </p>
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Title *
                    </label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => handleInputChange('title', e.target.value)}
                      placeholder="e.g., Instagram Follow"
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => handleInputChange('description', e.target.value)}
                      placeholder="Describe what's included in this offer..."
                      rows={3}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                    />
                    <p className="text-xs text-gray-500 mt-1">Be specific about what buyers will receive</p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Category
                    </label>
                    <div className="relative">
                      <select
                        value={formData.category}
                        onChange={(e) => handleInputChange('category', e.target.value)}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all appearance-none"
                      >
                        {categories.map(cat => (
                          <option key={cat} value={cat}>{categoryIcons[cat]} {cat}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Price (tokens) *
                      </label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="number"
                          value={formData.priceTokens}
                          onChange={(e) => handleInputChange('priceTokens', e.target.value)}
                          placeholder="10000"
                          min="1"
                          max="1000000"
                          className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                          required
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Min: 1 token</p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Max Quantity
                      </label>
                      <div className="relative">
                        <Tag className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="number"
                          value={formData.maxQuantity}
                          onChange={(e) => handleInputChange('maxQuantity', e.target.value)}
                          placeholder="Unlimited"
                          min="1"
                          className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Leave empty for unlimited</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Delivery Time
                    </label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <select
                        value={formData.deliveryTime}
                        onChange={(e) => handleInputChange('deliveryTime', e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all appearance-none"
                      >
                        <option value="">Select delivery time</option>
                        {deliveryTimeOptions.map(time => (
                          <option key={time} value={time}>{time}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                </div>

                <div className="flex space-x-3 mt-8">
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all font-medium shadow-lg hover:shadow-xl transform hover:scale-105"
                  >
                    {editingOffer ? 'Update Offer' : 'Create Offer'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 py-3 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium"
                  >
                    Cancel
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

export default OffersManagement;