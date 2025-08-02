import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { api } from '../services/api';
import Button from './ui/Button';
import Input from './ui/Input';
import Select from './ui/Select';
import Card from './ui/Card';
import LoadingSpinner from './ui/LoadingSpinner';

const CollaborationInviteForm = ({ onSuccess, onCancel }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    sessionType: 'video',
    scheduledFor: '',
    isPublic: true,
    maxDuration: 60,
    pricePerMinute: 2.00,
    collaboratorIds: [],
    revenueSharing: {}
  });
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedCollaborators, setSelectedCollaborators] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (searchQuery.length >= 2) {
      searchCreators();
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  useEffect(() => {
    // Update revenue sharing when collaborators change
    updateRevenueSharing();
  }, [selectedCollaborators]);

  const searchCreators = async () => {
    try {
      setSearching(true);
      const response = await api.get('/api/collaborations/search-creators', {
        params: { query: searchQuery, limit: 10 }
      });
      
      if (response.data.success) {
        setSearchResults(response.data.creators);
      }
    } catch (error) {
      console.error('Error searching creators:', error);
    } finally {
      setSearching(false);
    }
  };

  const addCollaborator = (creator) => {
    if (!selectedCollaborators.find(c => c.id === creator.id)) {
      setSelectedCollaborators([...selectedCollaborators, creator]);
      setSearchQuery('');
      setSearchResults([]);
    }
  };

  const removeCollaborator = (creatorId) => {
    setSelectedCollaborators(selectedCollaborators.filter(c => c.id !== creatorId));
  };

  const updateRevenueSharing = () => {
    const totalParticipants = selectedCollaborators.length + 1; // +1 for current user
    const equalShare = Math.floor(100 / totalParticipants);
    const remainder = 100 - (equalShare * totalParticipants);
    
    const newRevenueSharing = {};
    
    // Set equal shares for all collaborators
    selectedCollaborators.forEach((collaborator, index) => {
      newRevenueSharing[collaborator.id] = equalShare + (index === 0 ? remainder : 0);
    });
    
    // Set share for current user (host)
    // Note: We'll need to get current user ID from context/auth
    newRevenueSharing['host'] = equalShare;
    
    setFormData(prev => ({ ...prev, revenueSharing: newRevenueSharing }));
  };

  const updateRevenueShare = (creatorId, percentage) => {
    const newRevenueSharing = { ...formData.revenueSharing };
    newRevenueSharing[creatorId] = parseInt(percentage);
    
    // Ensure total doesn't exceed 100%
    const total = Object.values(newRevenueSharing).reduce((sum, val) => sum + val, 0);
    if (total <= 100) {
      setFormData(prev => ({ ...prev, revenueSharing: newRevenueSharing }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }
    
    if (selectedCollaborators.length === 0) {
      newErrors.collaborators = 'At least one collaborator is required';
    }
    
    if (formData.pricePerMinute < 0) {
      newErrors.pricePerMinute = 'Price must be positive';
    }
    
    const totalRevenue = Object.values(formData.revenueSharing).reduce((sum, val) => sum + val, 0);
    if (Math.abs(totalRevenue - 100) > 0.1) {
      newErrors.revenueSharing = 'Revenue sharing must total 100%';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    try {
      setLoading(true);
      
      const submitData = {
        ...formData,
        collaboratorIds: selectedCollaborators.map(c => c.id),
        scheduledFor: formData.scheduledFor || null
      };
      
      const response = await api.post('/api/collaborations/create', submitData);
      
      if (response.data.success) {
        onSuccess();
      }
    } catch (error) {
      console.error('Error creating collaboration:', error);
      setErrors({ submit: 'Failed to create collaboration. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const getTotalRevenue = () => {
    return Object.values(formData.revenueSharing).reduce((sum, val) => sum + val, 0);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Basic Information
        </h3>
        
        <Input
          label="Collaboration Title"
          value={formData.title}
          onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
          placeholder="Enter collaboration title"
          error={errors.title}
          required
        />
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Description
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Describe what this collaboration is about"
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-800 dark:text-white"
          />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Session Type"
            value={formData.sessionType}
            onChange={(e) => setFormData(prev => ({ ...prev, sessionType: e.target.value }))}
            options={[
              { value: 'video', label: 'Video Call' },
              { value: 'voice', label: 'Voice Call' },
              { value: 'stream', label: 'Live Stream' }
            ]}
          />
          
          <Input
            label="Max Duration (minutes)"
            type="number"
            value={formData.maxDuration}
            onChange={(e) => setFormData(prev => ({ ...prev, maxDuration: parseInt(e.target.value) }))}
            min="15"
            max="480"
          />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Price per Minute ($)"
            type="number"
            step="0.50"
            value={formData.pricePerMinute}
            onChange={(e) => setFormData(prev => ({ ...prev, pricePerMinute: parseFloat(e.target.value) }))}
            min="0.50"
            error={errors.pricePerMinute}
          />
          
          <Input
            label="Scheduled For (optional)"
            type="datetime-local"
            value={formData.scheduledFor}
            onChange={(e) => setFormData(prev => ({ ...prev, scheduledFor: e.target.value }))}
            min={new Date().toISOString().slice(0, 16)}
          />
        </div>
        
        <div className="flex items-center">
          <input
            type="checkbox"
            id="isPublic"
            checked={formData.isPublic}
            onChange={(e) => setFormData(prev => ({ ...prev, isPublic: e.target.checked }))}
            className="mr-2 h-4 w-4 text-purple-600 rounded focus:ring-purple-500"
          />
          <label htmlFor="isPublic" className="text-sm text-gray-700 dark:text-gray-300">
            Make this collaboration public
          </label>
        </div>
      </div>

      {/* Collaborator Search */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Add Collaborators
        </h3>
        
        <div className="relative">
          <Input
            label="Search Creators"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by username or name"
          />
          
          {searching && (
            <div className="absolute right-3 top-9">
              <LoadingSpinner size="sm" />
            </div>
          )}
          
          {/* Search Results */}
          {searchResults.length > 0 && (
            <Card className="absolute z-10 w-full mt-1 max-h-60 overflow-y-auto">
              {searchResults.map((creator) => (
                <div
                  key={creator.id}
                  className="p-3 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer flex items-center space-x-3"
                  onClick={() => addCollaborator(creator)}
                >
                  <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-semibold">
                    {creator.username.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {creator.displayName || creator.username}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      @{creator.username} • {creator.followerCount} followers
                    </div>
                  </div>
                </div>
              ))}
            </Card>
          )}
        </div>
        
        {errors.collaborators && (
          <p className="text-red-600 text-sm">{errors.collaborators}</p>
        )}
        
        {/* Selected Collaborators */}
        {selectedCollaborators.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium text-gray-900 dark:text-white">Selected Collaborators:</h4>
            {selectedCollaborators.map((collaborator) => (
              <div key={collaborator.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                    {collaborator.username.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {collaborator.displayName || collaborator.username}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      @{collaborator.username}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeCollaborator(collaborator.id)}
                  className="text-red-600 hover:text-red-800 p-1"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Revenue Sharing */}
      {selectedCollaborators.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Revenue Sharing
          </h3>
          
          <div className="grid gap-3">
            {/* Host (Current User) */}
            <div className="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                  H
                </div>
                <span className="font-medium text-gray-900 dark:text-white">You (Host)</span>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.revenueSharing.host || 0}
                  onChange={(e) => updateRevenueShare('host', e.target.value)}
                  className="w-16 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-center dark:bg-gray-800 dark:text-white"
                />
                <span className="text-gray-600 dark:text-gray-400">%</span>
              </div>
            </div>
            
            {/* Collaborators */}
            {selectedCollaborators.map((collaborator) => (
              <div key={collaborator.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-teal-500 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                    {collaborator.username.charAt(0).toUpperCase()}
                  </div>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {collaborator.displayName || collaborator.username}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.revenueSharing[collaborator.id] || 0}
                    onChange={(e) => updateRevenueShare(collaborator.id, e.target.value)}
                    className="w-16 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-center dark:bg-gray-800 dark:text-white"
                  />
                  <span className="text-gray-600 dark:text-gray-400">%</span>
                </div>
              </div>
            ))}
          </div>
          
          <div className={`flex items-center justify-between p-3 rounded-lg ${
            Math.abs(getTotalRevenue() - 100) < 0.1 
              ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
          }`}>
            <span className="font-medium text-gray-900 dark:text-white">Total</span>
            <span className={`font-bold ${
              Math.abs(getTotalRevenue() - 100) < 0.1 ? 'text-green-600' : 'text-red-600'
            }`}>
              {getTotalRevenue()}%
            </span>
          </div>
          
          {errors.revenueSharing && (
            <p className="text-red-600 text-sm">{errors.revenueSharing}</p>
          )}
        </div>
      )}

      {/* Submit Buttons */}
      <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <Button
          type="button"
          onClick={onCancel}
          variant="secondary"
          className="px-6 py-2"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          loading={loading}
          disabled={loading || Object.keys(errors).length > 0}
          className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-2"
        >
          Create Collaboration
        </Button>
      </div>
      
      {errors.submit && (
        <p className="text-red-600 text-sm text-center">{errors.submit}</p>
      )}
    </form>
  );
};

export default CollaborationInviteForm;