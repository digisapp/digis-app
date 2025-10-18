import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { api } from '../services/api';
import LoadingSpinner from './ui/LoadingSpinner';
import Button from './ui/Button';
import Card from './ui/Card';
import Modal from './ui/Modal';
import MembershipTierForm from './MembershipTierForm';
import MembershipTierCard from './MembershipTierCard';
import MemberManagement from './MemberManagement';

const MembershipDashboard = ({ userId, isCreator }) => {
  const [tiers, setTiers] = useState([]);
  const [memberships, setMemberships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showTierModal, setShowTierModal] = useState(false);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [editingTier, setEditingTier] = useState(null);
  const [view, setView] = useState(isCreator ? 'manage' : 'browse'); // manage, browse, members
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    if (isCreator && view === 'manage') {
      fetchCreatorTiers();
    } else if (!isCreator || view === 'browse') {
      fetchUserMemberships();
    }
  }, [view, isCreator, refreshTrigger]);

  const fetchCreatorTiers = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/membership-tiers/creator/${userId}/tiers`);
      
      if (response.data.success) {
        setTiers(response.data.tiers);
      }
    } catch (error) {
      console.error('Error fetching creator tiers:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserMemberships = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/membership-tiers/my-memberships');
      
      if (response.data.success) {
        setMemberships(response.data.memberships);
      }
    } catch (error) {
      console.error('Error fetching memberships:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTierCreated = () => {
    setShowTierModal(false);
    setEditingTier(null);
    setRefreshTrigger(prev => prev + 1);
  };

  const handleEditTier = (tier) => {
    setEditingTier(tier);
    setShowTierModal(true);
  };

  const handleTierUpdated = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const getTierStats = () => {
    if (!isCreator || !tiers.length) return null;
    
    return {
      totalTiers: tiers.length,
      activeTiers: tiers.filter(t => t.isActive).length,
      totalMembers: tiers.reduce((sum, t) => sum + t.memberCount, 0),
      monthlyRevenue: tiers.reduce((sum, t) => sum + (t.price * t.activeMembers), 0)
    };
  };

  const stats = getTierStats();

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
            {isCreator ? 'Membership Tiers' : 'My Memberships'}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {isCreator 
              ? 'Create and manage your membership tiers for fans'
              : 'Manage your creator memberships and benefits'
            }
          </p>
        </div>
        
        {isCreator && (
          <div className="flex space-x-3">
            <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
              <button
                onClick={() => setView('manage')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  view === 'manage'
                    ? 'bg-white dark:bg-gray-700 text-purple-600 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                Manage Tiers
              </button>
              <button
                onClick={() => setView('members')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  view === 'members'
                    ? 'bg-white dark:bg-gray-700 text-purple-600 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                Members
              </button>
            </div>
            
            {view === 'manage' && (
              <Button
                onClick={() => setShowTierModal(true)}
                className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
              >
                + New Tier
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Statistics (Creator Only) */}
      {isCreator && view === 'manage' && stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="p-6 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl border border-purple-200 dark:border-purple-800"
          >
            <div className="text-3xl font-bold text-purple-600 mb-2">
              {stats.totalTiers}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Total Tiers
            </div>
          </motion.div>
          
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl border border-green-200 dark:border-green-800"
          >
            <div className="text-3xl font-bold text-green-600 mb-2">
              {stats.activeTiers}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Active Tiers
            </div>
          </motion.div>
          
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="p-6 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-xl border border-blue-200 dark:border-blue-800"
          >
            <div className="text-3xl font-bold text-blue-600 mb-2">
              {stats.totalMembers}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Total Members
            </div>
          </motion.div>
          
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="p-6 bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-xl border border-yellow-200 dark:border-yellow-800"
          >
            <div className="text-3xl font-bold text-yellow-600 mb-2">
              ${stats.monthlyRevenue.toFixed(0)}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Monthly Revenue
            </div>
          </motion.div>
        </div>
      )}

      {/* Content based on view */}
      {view === 'members' ? (
        <MemberManagement userId={userId} />
      ) : (
        <>
          {/* Tiers/Memberships List */}
          {(isCreator ? tiers : memberships).length === 0 ? (
            <Card className="p-8 text-center">
              <div className="max-w-md mx-auto">
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  {isCreator ? 'No Tiers Created' : 'No Memberships Found'}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  {isCreator 
                    ? "You haven't created any membership tiers yet. Create your first tier to start building your community!"
                    : "You don't have any active memberships. Browse creators to find membership tiers to join!"
                  }
                </p>
                {isCreator && (
                  <Button
                    onClick={() => setShowTierModal(true)}
                    className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-2 rounded-lg"
                  >
                    Create Your First Tier
                  </Button>
                )}
              </div>
            </Card>
          ) : (
            <div className="grid gap-6">
              {(isCreator ? tiers : memberships).map((item) => (
                <MembershipTierCard
                  key={item.id}
                  tier={item}
                  isCreator={isCreator}
                  onEdit={isCreator ? handleEditTier : undefined}
                  onUpdate={handleTierUpdated}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Tier Creation/Edit Modal */}
      {showTierModal && (
        <Modal
          isOpen={showTierModal}
          onClose={() => {
            setShowTierModal(false);
            setEditingTier(null);
          }}
          title={editingTier ? 'Edit Membership Tier' : 'Create New Membership Tier'}
          size="lg"
        >
          <MembershipTierForm
            tier={editingTier}
            onSuccess={handleTierCreated}
            onCancel={() => {
              setShowTierModal(false);
              setEditingTier(null);
            }}
          />
        </Modal>
      )}
    </div>
  );
};

export default MembershipDashboard;