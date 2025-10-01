import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Package, Clock, DollarSign, X } from 'lucide-react';
import useStore from '../stores/useStore';
import Skeleton from './ui/Skeleton';
import toast from 'react-hot-toast';
import { getAuthToken } from '../utils/auth-helpers';

const CreatorOffers = ({ creatorId, creatorUsername, auth }) => {
  const tokenBalance = useStore((state) => state.tokenBalance);
  const subtractTokens = useStore((state) => state.subtractTokens);
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOffer, setSelectedOffer] = useState(null);
  const [purchaseNotes, setPurchaseNotes] = useState('');
  const [purchasing, setPurchasing] = useState(false);

  // Number formatter for consistent formatting
  const nf = useMemo(() => new Intl.NumberFormat(undefined, {
    notation: 'compact',
    maximumFractionDigits: 1
  }), []);

  const fetchCreatorOffers = useCallback(async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/offers/creator/${creatorId}`);
      
      if (!response.ok) throw new Error('Failed to fetch offers');
      
      const data = await response.json();
      setOffers(data.offers);
    } catch (error) {
      console.error('Error fetching offers:', error);
      toast.error('Failed to load offers');
    } finally {
      setLoading(false);
    }
  }, [creatorId]);

  useEffect(() => {
    fetchCreatorOffers();
  }, [fetchCreatorOffers]);

  const handlePurchase = async () => {
    if (!auth.currentUser) {
      toast.error('Please sign in to purchase offers');
      return;
    }

    if (!selectedOffer) return;

    if (tokenBalance < selectedOffer.priceTokens) {
      toast.error('Insufficient tokens. Please purchase more tokens.');
      return;
    }

    setPurchasing(true);

    try {
      const token = await getAuthToken();
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/offers/${selectedOffer.id}/purchase`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ notes: purchaseNotes })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Purchase failed');
      }

      await response.json();
      
      // Update token balance
      subtractTokens(selectedOffer.priceTokens);
      
      // toast.success('Purchase successful! The creator will be notified.');
      setSelectedOffer(null);
      setPurchaseNotes('');
      fetchCreatorOffers(); // Refresh to update counts
    } catch (error) {
      console.error('Error purchasing offer:', error);
      toast.error(error.message);
    } finally {
      setPurchasing(false);
    }
  };

  const getCategoryIcon = (category) => {
    const icons = {
      'Social Media': '📱',
      'Content Creation': '🎬',
      'Collaboration': '🤝',
      'Custom Request': '✨',
      'Exclusive Content': '🔒',
      'Shoutout': '📢',
      'Review/Feedback': '💬',
      'General': '📦'
    };
    return icons[category] || '📦';
  };

  if (loading) {
    return (
      <Skeleton.Grid items={6} columns={3} renderItem={(i) => (
        <div key={i} className="glass-medium rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center">
              <Skeleton variant="circular" width="w-8" height="h-8" className="mr-2" />
              <Skeleton variant="text" width="w-24" height="h-5" />
            </div>
            <Skeleton variant="rounded" width="w-16" height="h-6" />
          </div>
          <Skeleton.Text lines={2} className="mb-4" />
          <div className="space-y-2 mb-4">
            <div className="flex items-center justify-between">
              <Skeleton variant="text" width="w-20" height="h-5" />
              <Skeleton variant="text" width="w-16" height="h-4" />
            </div>
            <Skeleton variant="text" width="w-12" height="h-4" />
          </div>
          <Skeleton.Button size="md" className="w-full" />
        </div>
      )} />
    );
  }

  if (offers.length === 0) {
    return (
      <div className="text-center py-12">
        <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No offers available</h3>
        <p className="text-gray-600">This creator hasn't added any offers yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {offers.map((offer) => (
          <motion.div
            key={offer.id}
            whileHover={{ scale: 1.02 }}
            className="bg-white rounded-lg shadow-md p-4 cursor-pointer border-2 border-transparent hover:border-blue-500 transition-colors"
            onClick={() => setSelectedOffer(offer)}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center">
                <span className="text-2xl mr-2">{getCategoryIcon(offer.category)}</span>
                <h3 className="font-semibold text-lg text-gray-900">{offer.title}</h3>
              </div>
              {offer.remainingQuantity !== null && offer.remainingQuantity === 0 && (
                <span className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded-full">
                  Sold Out
                </span>
              )}
            </div>

            <p className="text-gray-600 text-sm mb-3 line-clamp-2">
              {offer.description || 'No description provided'}
            </p>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center text-green-600 font-semibold">
                  <DollarSign className="w-5 h-5 mr-1" />
                  <span>{nf.format(offer.priceTokens || offer.price || 0)} tokens</span>
                </div>
                {offer.deliveryTime && (
                  <div className="flex items-center text-sm text-gray-600">
                    <Clock className="w-4 h-4 mr-1" />
                    <span>{offer.deliveryTime}</span>
                  </div>
                )}
              </div>

              {offer.remainingQuantity !== null && (
                <div className="text-sm text-gray-600">
                  {offer.remainingQuantity} remaining
                </div>
              )}

              {offer.totalPurchases > 0 && (
                <div className="text-sm text-gray-500">
                  {offer.totalPurchases} {offer.totalPurchases === 1 ? 'purchase' : 'purchases'}
                </div>
              )}
            </div>

            <div className="mt-3 pt-3 border-t">
              <button
                aria-disabled={offer.remainingQuantity === 0}
                disabled={offer.remainingQuantity === 0}
                className={`w-full py-2 rounded-lg font-medium transition-colors ${
                  offer.remainingQuantity === 0
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-500 text-white hover:bg-blue-600'
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedOffer(offer);
                }}
              >
                {offer.remainingQuantity === 0 ? 'Sold Out' : 'Purchase'}
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Purchase Modal */}
      <AnimatePresence>
        {selectedOffer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => setSelectedOffer(null)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-white rounded-lg p-6 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold">Purchase Offer</h3>
                <button
                  onClick={() => setSelectedOffer(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mb-6">
                <div className="flex items-center mb-3">
                  <span className="text-2xl mr-2">{getCategoryIcon(selectedOffer.category)}</span>
                  <h4 className="font-semibold text-lg">{selectedOffer.title}</h4>
                </div>
                
                {selectedOffer.description && (
                  <p className="text-gray-600 mb-4">{selectedOffer.description}</p>
                )}

                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Price:</span>
                    <span className="font-semibold text-green-600">
                      {nf.format(selectedOffer.priceTokens || selectedOffer.price || 0)} tokens
                    </span>
                  </div>
                  {selectedOffer.deliveryTime && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Delivery:</span>
                      <span>{selectedOffer.deliveryTime}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Creator:</span>
                    <span>{creatorUsername}</span>
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Add notes for the creator (optional)
                  </label>
                  <textarea
                    value={purchaseNotes}
                    onChange={(e) => setPurchaseNotes(e.target.value)}
                    placeholder="Any special requests or details..."
                    rows={3}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="bg-blue-50 rounded-lg p-3 mb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Your balance:</span>
                    <span className={`font-semibold ${
                      tokenBalance >= (selectedOffer.priceTokens || selectedOffer.price || 0) ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {nf.format(tokenBalance)} tokens
                    </span>
                  </div>
                  {tokenBalance < (selectedOffer.priceTokens || selectedOffer.price || 0) && (
                    <p className="text-sm text-red-600 mt-2">
                      You need {nf.format((selectedOffer.priceTokens || selectedOffer.price || 0) - tokenBalance)} more tokens
                    </p>
                  )}
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={handlePurchase}
                  disabled={purchasing || tokenBalance < selectedOffer.priceTokens}
                  className={`flex-1 py-2 rounded-lg font-medium transition-colors flex items-center justify-center ${
                    tokenBalance < selectedOffer.priceTokens
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : purchasing
                      ? 'bg-blue-400 text-white cursor-wait'
                      : 'bg-blue-500 text-white hover:bg-blue-600'
                  }`}
                >
                  {purchasing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="w-4 h-4 mr-2" />
                      Purchase
                    </>
                  )}
                </button>
                <button
                  onClick={() => setSelectedOffer(null)}
                  className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CreatorOffers;