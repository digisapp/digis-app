import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { api } from '../services/api';
import LoadingSpinner from './ui/LoadingSpinner';
import Button from './ui/Button';
import Card from './ui/Card';
import Badge from './ui/Badge';
import Select from './ui/Select';
import Input from './ui/Input';

const MemberManagement = ({ userId }) => {
  const [members, setMembers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    tierLevel: '',
    status: 'active',
    search: ''
  });

  useEffect(() => {
    fetchMembers();
  }, [filters]);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/membership-tiers/my-members', {
        params: filters
      });
      
      if (response.data.success) {
        setMembers(response.data.members);
        setStats(response.data.stats);
      }
    } catch (error) {
      console.error('Error fetching members:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  const getStatusColor = (status) => {
    const colors = {
      active: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300',
      cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300',
      expired: 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300'
    };
    return colors[status] || colors.active;
  };

  const getTierLevelColor = (level) => {
    const colors = {
      1: 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300',
      2: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300',
      3: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300',
      4: 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300',
      5: 'bg-pink-100 text-pink-800 dark:bg-pink-900/20 dark:text-pink-300'
    };
    return colors[level] || colors[1];
  };

  const filteredMembers = members.filter(member => {
    if (filters.search && !member.memberUsername.toLowerCase().includes(filters.search.toLowerCase())) {
      return false;
    }
    return true;
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistics */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
              {stats.totalMembers}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Total Members
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="text-2xl font-bold text-green-600 mb-1">
              {stats.activeMembers}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Active Members
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="text-2xl font-bold text-purple-600 mb-1">
              {formatCurrency(stats.monthlyRevenue)}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Monthly Revenue
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="text-2xl font-bold text-blue-600 mb-1">
              {stats.avgTierLevel.toFixed(1)}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Avg Tier Level
            </div>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            label="Search Members"
            value={filters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
            placeholder="Search by username"
          />
          
          <Select
            label="Status"
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            options={[
              { value: 'active', label: 'Active' },
              { value: 'cancelled', label: 'Cancelled' },
              { value: 'expired', label: 'Expired' }
            ]}
          />
          
          <Select
            label="Tier Level"
            value={filters.tierLevel}
            onChange={(e) => handleFilterChange('tierLevel', e.target.value)}
            options={[
              { value: '', label: 'All Levels' },
              { value: '1', label: 'Level 1' },
              { value: '2', label: 'Level 2' },
              { value: '3', label: 'Level 3' },
              { value: '4', label: 'Level 4' },
              { value: '5', label: 'Level 5+' }
            ]}
          />
        </div>
      </Card>

      {/* Members List */}
      {filteredMembers.length === 0 ? (
        <Card className="p-8 text-center">
          <div className="max-w-md mx-auto">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No Members Found
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              {filters.search || filters.tierLevel
                ? 'No members match your current filters.'
                : "You don't have any members yet. Create attractive membership tiers to start building your community!"
              }
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredMembers.map((member) => (
            <motion.div
              key={member.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Card className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
                  {/* Member Info */}
                  <div className="flex items-center space-x-4">
                    <div 
                      className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold"
                      style={{ backgroundColor: member.tierColor || '#8B5CF6' }}
                    >
                      {member.memberUsername.charAt(0).toUpperCase()}
                    </div>
                    
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                          {member.memberUsername}
                        </h4>
                        <Badge className={getStatusColor(member.status)}>
                          {member.status}
                        </Badge>
                        <Badge className={getTierLevelColor(member.tierLevel)}>
                          Level {member.tierLevel}
                        </Badge>
                      </div>
                      
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {member.tierName}
                      </div>
                      
                      <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                        Member since: {formatDate(member.startedAt)}
                      </div>
                    </div>
                  </div>

                  {/* Membership Details */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 flex-1 lg:max-w-lg">
                    <div className="text-center">
                      <div className="text-lg font-bold text-green-600">
                        {formatCurrency(member.pricePaid)}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        Monthly
                      </div>
                    </div>
                    
                    <div className="text-center">
                      <div className="text-lg font-bold text-purple-600">
                        {member.tokensRemaining || 0}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        Tokens Left
                      </div>
                    </div>
                    
                    <div className="text-center">
                      <div className="text-lg font-bold text-blue-600">
                        {formatDate(member.nextBillingDate)}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        Next Billing
                      </div>
                    </div>
                    
                    <div className="text-center">
                      <div className="text-lg font-bold text-gray-600 dark:text-gray-400">
                        {Math.floor((new Date() - new Date(member.startedAt)) / (1000 * 60 * 60 * 24))}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        Days Active
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex space-x-2">
                    <Button
                      variant="secondary"
                      className="px-3 py-1 text-sm"
                      onClick={() => {
                        // Navigate to member's profile or open DM
                      }}
                    >
                      Message
                    </Button>
                    
                    <Button
                      variant="secondary"
                      className="px-3 py-1 text-sm"
                      onClick={() => {
                        // View member's activity/stats
                      }}
                    >
                      View Details
                    </Button>
                  </div>
                </div>

                {/* Additional Member Info */}
                {member.memberEmail && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      <strong>Email:</strong> {member.memberEmail}
                    </div>
                  </div>
                )}
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Bulk Actions */}
      {filteredMembers.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Showing {filteredMembers.length} of {members.length} members
            </div>
            
            <div className="flex space-x-2">
              <Button
                variant="secondary"
                className="px-4 py-2 text-sm"
                onClick={() => {
                  // Export members list
                }}
              >
                Export CSV
              </Button>
              
              <Button
                variant="secondary"
                className="px-4 py-2 text-sm"
                onClick={() => {
                  // Send message to all members
                }}
              >
                Message All
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

export default MemberManagement;