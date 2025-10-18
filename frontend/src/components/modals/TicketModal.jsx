import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XMarkIcon, TicketIcon, SparklesIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

export default function TicketModal({
  isOpen,
  onClose,
  streamId,
  priceTokens = 500,
  userBalance = 0,
  onPurchased,
  openBuyTokens, // function to open BuyTokensSheet
  creator = {}
}) {
  const [loading, setLoading] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  const [error, setError] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!isOpen || !streamId) return;

    (async () => {
      try {
        setChecking(true);
        setError(null);

        const BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3005';
        const token = localStorage.getItem('supabase_token');

        const response = await fetch(`${BASE}/streams/${streamId}/access`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          credentials: 'include'
        });

        const data = await response.json();
        setHasAccess(Boolean(data?.hasAccess));
      } catch (e) {
        console.error('Error checking access:', e);
        setError('Failed to check access');
      } finally {
        setChecking(false);
      }
    })();
  }, [isOpen, streamId]);

  const handleBuyTicket = async () => {
    try {
      setLoading(true);
      setError(null);

      if (userBalance < priceTokens) {
        // Not enough tokens — open quick top-up
        openBuyTokens?.({ required: priceTokens - userBalance });
        setLoading(false);
        return;
      }

      const BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3005';
      const token = localStorage.getItem('supabase_token');

      const response = await fetch(`${BASE}/streams/${streamId}/tickets/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        credentials: 'include',
        body: JSON.stringify({ priceTokens })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Ticket purchase failed');
      }

      toast.success('Ticket purchased! Joining stream...');
      onPurchased?.(data.ticketId);
      onClose?.();
    } catch (e) {
      console.error('Ticket purchase error:', e);
      setError(e.message || 'Purchase failed');
      toast.error(e.message || 'Failed to purchase ticket');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full sm:w-[480px] bg-gradient-to-br from-purple-900 via-purple-800 to-pink-900 rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl"
        >
          {/* Header */}
          <div className="relative p-6 border-b border-white/10">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            >
              <XMarkIcon className="w-5 h-5 text-white" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400 to-pink-500 flex items-center justify-center">
                <TicketIcon className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Private Show Access</h3>
                <p className="text-sm text-purple-200">Ticket required to join this stream</p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-4">
            {checking ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-3" />
                <p className="text-white/80">Checking access...</p>
              </div>
            ) : (
              <>
                {/* Creator Info */}
                {creator && (
                  <div className="flex items-center gap-3 p-4 rounded-2xl bg-white/10 backdrop-blur-sm">
                    <img
                      src={creator.profile_pic_url || creator.profilePic || '/api/placeholder/48/48'}
                      alt={creator.username || creator.displayName}
                      className="w-12 h-12 rounded-full object-cover border-2 border-white/20"
                    />
                    <div className="flex-1">
                      <p className="font-semibold text-white">
                        {creator.display_name || creator.displayName || creator.username}
                      </p>
                      <p className="text-sm text-purple-200">@{creator.username}</p>
                    </div>
                    <SparklesIcon className="w-5 h-5 text-yellow-400" />
                  </div>
                )}

                {/* Price Info */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-4 rounded-xl bg-white/5">
                    <span className="text-purple-200">Ticket Price</span>
                    <div className="flex items-center gap-2">
                      <img src="/digis-coin.png" alt="Tokens" className="w-5 h-5" />
                      <span className="font-bold text-white text-lg">{priceTokens}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-xl bg-white/5">
                    <span className="text-purple-200">Your Balance</span>
                    <div className="flex items-center gap-2">
                      <img src="/digis-coin.png" alt="Tokens" className="w-5 h-5" />
                      <span className={`font-bold text-lg ${userBalance >= priceTokens ? 'text-green-400' : 'text-yellow-400'}`}>
                        {userBalance}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="p-4 rounded-xl bg-red-500/20 border border-red-500/30">
                    <p className="text-sm text-red-200">{error}</p>
                  </div>
                )}

                {/* Success Message */}
                {hasAccess && (
                  <div className="p-4 rounded-xl bg-green-500/20 border border-green-500/30">
                    <p className="text-sm text-green-200 font-medium">
                      ✓ You already have access. You can join now!
                    </p>
                  </div>
                )}

                {/* Info */}
                {!hasAccess && (
                  <div className="p-4 rounded-xl bg-purple-500/20 border border-purple-500/30">
                    <p className="text-xs text-purple-100">
                      This is a one-time purchase. You'll have access to this private stream once you buy the ticket.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          {!checking && (
            <div className="p-6 border-t border-white/10 flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-4 rounded-2xl border border-white/20 text-white font-semibold hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              {hasAccess ? (
                <button
                  onClick={() => {
                    onPurchased?.('existing');
                    onClose?.();
                  }}
                  className="flex-1 py-4 rounded-2xl bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold shadow-lg hover:shadow-xl transition-all"
                >
                  Join Now
                </button>
              ) : (
                <button
                  disabled={loading}
                  onClick={handleBuyTicket}
                  className="flex-1 py-4 rounded-2xl bg-gradient-to-r from-purple-500 to-pink-600 text-white font-bold shadow-lg hover:shadow-xl transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Processing...
                    </span>
                  ) : userBalance < priceTokens ? (
                    'Buy Tokens'
                  ) : (
                    'Buy Ticket'
                  )}
                </button>
              )}
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
