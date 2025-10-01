import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '../services/api';
import Button from './ui/Button';
import Card from './ui/Card';
import Badge from './ui/Badge';
import Modal from './ui/Modal';

const MembershipTierCard = ({ tier, isCreator, onEdit, onUpdate }) => {
  const [loading, setLoading] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);

  const handleJoinTier = async () => {
    try {
      setLoading(true);
      const response = await api.post(`/api/membership-tiers/join/${tier.id}`, {
        paymentMethod: 'tokens'
      });
      
      if (response.data.success) {
        setShowJoinModal(false);
        if (onUpdate) onUpdate();
        // Show success notification
      }
    } catch (error) {
      console.error('Error joining tier:', error);
      // Show error notification
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async () => {
    try {
      setLoading(true);
      const response = await api.post(`/api/membership-tiers/upgrade/${tier.id}`, {
        paymentMethod: 'tokens'
      });
      
      if (response.data.success) {
        if (onUpdate) onUpdate();
        // Show success notification
      }
    } catch (error) {
      console.error('Error upgrading tier:', error);
      // Show error notification
    } finally {
      setLoading(false);
    }
  };

  const handleCancelMembership = async () => {
    const reason = prompt('Please provide a reason for cancellation (optional):');
    
    try {
      setLoading(true);
      const response = await api.post(`/api/membership-tiers/cancel/${tier.id}`, {
        reason
      });
      
      if (response.data.success) {
        if (onUpdate) onUpdate();
        // Show success notification
      }
    } catch (error) {
      console.error('Error cancelling membership:', error);
      // Show error notification
    } finally {
      setLoading(false);
    }
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

  const getBenefitIcon = (benefit) => {
    const lower = benefit.toLowerCase();
    if (lower.includes('token')) return '💰';
    if (lower.includes('discount')) return '💸';
    if (lower.includes('exclusive')) return '🔒';
    if (lower.includes('priority')) return '⚡';
    if (lower.includes('support')) return '🛟';
    if (lower.includes('content')) return '📱';
    if (lower.includes('chat') || lower.includes('message')) return '💬';
    return '✨';
  };

  // Different rendering for creator view vs fan view
  const isUserMembership = !isCreator && tier.status;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -4 }}
        transition={{ duration: 0.3 }}
      >
        <Card 
          className="relative overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${tier.color || tier.tierColor || '#8B5CF6'}15, ${tier.color || tier.tierColor || '#8B5CF6'}25)`,
            border: `2px solid ${tier.color || tier.tierColor || '#8B5CF6'}40`
          }}
        >
          <div className="p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-4">
                <div 
                  className="w-12 h-12 rounded-full flex items-center justify-center text-white text-xl font-bold"
                  style={{ backgroundColor: tier.color || tier.tierColor || '#8B5CF6' }}
                >
                  {tier.badgeIcon || tier.tierLevel}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    {tier.name || tier.tierName}
                  </h3>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Level {tier.tierLevel}
                    </span>
                    {isUserMembership && tier.status && (
                      <Badge className={`text-xs ${
                        tier.status === 'active' 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300'
                      }`}>
                        {tier.status}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="text-right">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatCurrency(tier.price || tier.pricePaid)}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  per month
                </div>
              </div>
            </div>

            {/* Creator Stats */}
            {isCreator && (
              <div className="flex items-center justify-between mb-4 p-3 bg-white/50 dark:bg-gray-800/50 rounded-lg">
                <div className="text-center">
                  <div className="text-lg font-bold text-gray-900 dark:text-white">
                    {tier.memberCount || 0}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    Total Members
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-gray-900 dark:text-white">
                    {tier.activeMembers || 0}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    Active
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-green-600">
                    {formatCurrency((tier.price || 0) * (tier.activeMembers || 0))}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    Monthly Revenue
                  </div>
                </div>
              </div>
            )}

            {/* User Membership Info */}
            {isUserMembership && (
              <div className="mb-4 p-3 bg-white/50 dark:bg-gray-800/50 rounded-lg">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Started</div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {formatDate(tier.startedAt)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Next Billing</div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {formatDate(tier.nextBillingDate)}
                    </div>
                  </div>
                  {tier.tokensRemaining > 0 && (
                    <div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Tokens Remaining</div>
                      <div className="font-medium text-purple-600">
                        {tier.tokensRemaining} tokens
                      </div>
                    </div>
                  )}
                  {tier.sessionDiscountPercent > 0 && (
                    <div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Session Discount</div>
                      <div className="font-medium text-green-600">
                        {tier.sessionDiscountPercent}% off
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Creator Info */}
            {!isCreator && tier.creatorUsername && (
              <div className="mb-4 p-3 bg-white/50 dark:bg-gray-800/50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                    {tier.creatorUsername.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {tier.creatorUsername}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Creator
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Description */}
            {(tier.description || tier.tierDescription) && (
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                {tier.description || tier.tierDescription}
              </p>
            )}

            {/* Benefits */}
            <div className="space-y-2 mb-6">
              <h4 className="font-semibold text-gray-900 dark:text-white">Benefits:</h4>
              <div className="space-y-2">
                {(tier.benefits || []).map((benefit, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <span className="text-lg">{getBenefitIcon(benefit)}</span>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {benefit}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Special Perks */}
            {(tier.tokensIncluded > 0 || tier.sessionDiscountPercent > 0 || 
              tier.exclusiveContent || tier.prioritySupport || tier.customEmojis) && (
              <div className="mb-6">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Special Perks:</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  {tier.tokensIncluded > 0 && (
                    <div className="flex items-center space-x-2">
                      <span>💰</span>
                      <span className="text-gray-700 dark:text-gray-300">
                        {tier.tokensIncluded} bonus tokens monthly
                      </span>
                    </div>
                  )}
                  {tier.sessionDiscountPercent > 0 && (
                    <div className="flex items-center space-x-2">
                      <span>💸</span>
                      <span className="text-gray-700 dark:text-gray-300">
                        {tier.sessionDiscountPercent}% session discount
                      </span>
                    </div>
                  )}
                  {tier.exclusiveContent && (
                    <div className="flex items-center space-x-2">
                      <span>🔒</span>
                      <span className="text-gray-700 dark:text-gray-300">
                        Exclusive content access
                      </span>
                    </div>
                  )}
                  {tier.prioritySupport && (
                    <div className="flex items-center space-x-2">
                      <span>⚡</span>
                      <span className="text-gray-700 dark:text-gray-300">
                        Priority support
                      </span>
                    </div>
                  )}
                  {tier.customEmojis && (
                    <div className="flex items-center space-x-2">
                      <span>😊</span>
                      <span className="text-gray-700 dark:text-gray-300">
                        Custom emoji reactions
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end space-x-3">
              {isCreator ? (
                <>
                  <Button
                    onClick={() => onEdit(tier)}
                    variant="secondary"
                    className="px-4 py-2 text-sm"
                  >
                    Edit
                  </Button>
                  <Button
                    variant="secondary"
                    className="px-4 py-2 text-sm"
                  >
                    View Members
                  </Button>
                </>
              ) : isUserMembership ? (
                <>
                  {tier.status === 'active' && (
                    <Button
                      onClick={handleCancelMembership}
                      loading={loading}
                      variant="secondary"
                      className="px-4 py-2 text-sm text-red-600 hover:text-red-800"
                    >
                      Cancel
                    </Button>
                  )}
                  <Button
                    onClick={handleUpgrade}
                    loading={loading}
                    className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-2 text-sm"
                  >
                    Upgrade
                  </Button>
                </>
              ) : (
                <Button
                  onClick={() => setShowJoinModal(true)}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-2"
                >
                  Join Tier
                </Button>
              )}
            </div>
          </div>

          {/* Status Indicator */}
          {isCreator && !tier.isActive && (
            <div className="absolute top-4 right-4">
              <Badge className="bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300">
                Inactive
              </Badge>
            </div>
          )}
        </Card>
      </motion.div>

      {/* Join Confirmation Modal */}
      {showJoinModal && (
        <Modal
          isOpen={showJoinModal}
          onClose={() => setShowJoinModal(false)}
          title="Join Membership Tier"
        >
          <div className="space-y-4">
            <div className="text-center">
              <div 
                className="w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4"
                style={{ backgroundColor: tier.color || tier.tierColor || '#8B5CF6' }}
              >
                {tier.badgeIcon || tier.tierLevel}
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                {tier.name || tier.tierName}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                {tier.description || tier.tierDescription}
              </p>
              
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-4">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatCurrency(tier.price)}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  per month (billed monthly)
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-semibold text-gray-900 dark:text-white">You'll get:</h4>
              {(tier.benefits || []).map((benefit, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {benefit}
                  </span>
                </div>
              ))}
            </div>
            
            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button
                onClick={() => setShowJoinModal(false)}
                variant="secondary"
                className="px-4 py-2"
              >
                Cancel
              </Button>
              <Button
                onClick={handleJoinTier}
                loading={loading}
                className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-2"
              >
                Join for {formatCurrency(tier.price)}/month
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
};

export default MembershipTierCard;