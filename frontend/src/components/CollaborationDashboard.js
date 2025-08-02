import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { api } from '../services/api';
import LoadingSpinner from './ui/LoadingSpinner';
import Button from './ui/Button';
import Card from './ui/Card';
import Modal from './ui/Modal';
import CollaborationInviteForm from './CollaborationInviteForm';
import CollaborationCard from './CollaborationCard';

const CollaborationDashboard = ({ userId, isCreator }) => {
  const [collaborations, setCollaborations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [filter, setFilter] = useState('all'); // all, pending, confirmed, active, completed
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    fetchCollaborations();
  }, [filter, refreshTrigger]);

  const fetchCollaborations = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/collaborations/my-collaborations', {
        params: { status: filter !== 'all' ? filter : undefined }
      });
      
      if (response.data.success) {
        setCollaborations(response.data.collaborations);
      }
    } catch (error) {
      console.error('Error fetching collaborations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCollaborationCreated = () => {
    setShowInviteModal(false);
    setRefreshTrigger(prev => prev + 1);
  };

  const handleStatusUpdate = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const filteredCollaborations = collaborations.filter(collab => {
    if (filter === 'all') return true;
    return collab.status === filter;
  });

  const getStatusCounts = () => {
    return {
      all: collaborations.length,
      pending: collaborations.filter(c => c.status === 'pending').length,
      confirmed: collaborations.filter(c => c.status === 'confirmed').length,
      active: collaborations.filter(c => c.status === 'active').length,
      completed: collaborations.filter(c => c.status === 'completed').length,
    };
  };

  const statusCounts = getStatusCounts();

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            Collaborations
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage your creator collaborations and joint sessions
          </p>
        </div>
        
        {isCreator && (
          <Button
            onClick={() => setShowInviteModal(true)}
            className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
          >
            + New Collaboration
          </Button>
        )}
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {Object.entries(statusCounts).map(([status, count]) => (
          <motion.div
            key={status}
            whileHover={{ scale: 1.02 }}
            className={`p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
              filter === status
                ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
            onClick={() => setFilter(status)}
          >
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {count}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400 capitalize">
              {status === 'all' ? 'Total' : status}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Collaborations List */}
      {filteredCollaborations.length === 0 ? (
        <Card className="p-8 text-center">
          <div className="max-w-md mx-auto">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No Collaborations Found
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {filter === 'all' 
                ? "You haven't created or been invited to any collaborations yet."
                : `No collaborations with status: ${filter}`
              }
            </p>
            {isCreator && (
              <Button
                onClick={() => setShowInviteModal(true)}
                className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-2 rounded-lg"
              >
                Create Your First Collaboration
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <div className="grid gap-6">
          {filteredCollaborations.map((collaboration) => (
            <CollaborationCard
              key={collaboration.id}
              collaboration={collaboration}
              userId={userId}
              isCreator={isCreator}
              onStatusUpdate={handleStatusUpdate}
            />
          ))}
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <Modal
          isOpen={showInviteModal}
          onClose={() => setShowInviteModal(false)}
          title="Create New Collaboration"
          size="lg"
        >
          <CollaborationInviteForm
            onSuccess={handleCollaborationCreated}
            onCancel={() => setShowInviteModal(false)}
          />
        </Modal>
      )}
    </div>
  );
};

export default CollaborationDashboard;