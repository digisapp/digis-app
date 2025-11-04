import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useSocket } from '../hooks/useSocket';
import { fetchWithRetry } from '../utils/fetchWithRetry';
import { getAuthToken } from '../utils/supabase-auth';
import toast from 'react-hot-toast';
import { UserGroupIcon, CheckIcon, XMarkIcon, UserPlusIcon, UserMinusIcon } from '@heroicons/react/24/outline';

const CoHostManager = ({ streamId, isCreator, user, onCoHostsUpdate, onRequestsUpdate, onClose, className = '' }) => {
  const [coHostRequests, setCoHostRequests] = useState([]);
  const [coHosts, setCoHosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const { on, sendEvent } = useSocket();
  const fetchTimeoutRef = useRef(null);
  const lastFetchRef = useRef(0);

  // Debounced fetch current co-hosts
  const fetchCoHosts = useCallback(async () => {
    // Validate streamId before making request
    if (!streamId || streamId === 'undefined') {
      console.debug('ℹ️ CoHostManager: No valid streamId, skipping co-host fetch');
      return;
    }

    // Rate limiting - don't fetch more than once every 5 seconds
    const now = Date.now();
    if (now - lastFetchRef.current < 5000) {
      return;
    }
    lastFetchRef.current = now;

    try {
      const authToken = await getAuthToken();
      const response = await fetchWithRetry(
        `${import.meta.env.VITE_BACKEND_URL}/streaming/co-hosts/${streamId}`,
        {
          headers: { Authorization: `Bearer ${authToken}` }
        },
        2, // Reduce retries
        2000 // Increase delay between retries
      );
      
      if (!response.ok) throw new Error('Failed to fetch co-hosts');
      
      const data = await response.json();
      const coHostsList = data.coHosts || [];
      setCoHosts(coHostsList);
      
      // Notify parent component
      if (onCoHostsUpdate) {
        onCoHostsUpdate(coHostsList);
      }
    } catch (error) {
      console.error('Failed to fetch co-hosts:', error);
    }
  }, [streamId, onCoHostsUpdate]);

  // Debounced fetch pending requests (for creators)
  const fetchRequests = useCallback(async () => {
    if (!isCreator) return;

    // Validate streamId before making request
    if (!streamId || streamId === 'undefined') {
      console.debug('ℹ️ CoHostManager: No valid streamId, skipping requests fetch');
      return;
    }

    // Rate limiting - don't fetch more than once every 5 seconds
    const now = Date.now();
    if (now - lastFetchRef.current < 5000) {
      return;
    }
    lastFetchRef.current = now;

    try {
      const authToken = await getAuthToken();
      const response = await fetchWithRetry(
        `${import.meta.env.VITE_BACKEND_URL}/streaming/co-host-requests`,
        {
          headers: { Authorization: `Bearer ${authToken}` }
        },
        2, // Reduce retries
        2000 // Increase delay between retries
      );
      
      if (!response.ok) throw new Error('Failed to fetch requests');
      
      const data = await response.json();
      const requests = data.requests?.filter(r => r.stream_id === streamId) || [];
      setCoHostRequests(requests);
      // Notify parent about requests
      if (onRequestsUpdate) {
        onRequestsUpdate(requests);
      }
    } catch (error) {
      console.error('Failed to fetch co-host requests:', error);
    }
  }, [streamId, isCreator]);

  // Request to co-host
  const handleJoinRequest = async () => {
    setLoading(true);
    try {
      const authToken = await getAuthToken();
      const response = await fetchWithRetry(
        `${import.meta.env.VITE_BACKEND_URL}/streaming/co-host-request`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`
          },
          body: JSON.stringify({ streamId })
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send request');
      }

      toast.success('Co-host request sent!');
    } catch (error) {
      toast.error(error.message || 'Failed to send co-host request');
    } finally {
      setLoading(false);
    }
  };

  // Accept co-host request
  const handleAcceptRequest = async (requestId) => {
    setLoading(true);
    try {
      const authToken = await getAuthToken();
      const response = await fetchWithRetry(
        `${import.meta.env.VITE_BACKEND_URL}/streaming/co-host-accept`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`
          },
          body: JSON.stringify({ requestId })
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to accept request');
      }

      toast.success('Co-host accepted!');
      await fetchRequests();
      await fetchCoHosts();
    } catch (error) {
      toast.error(error.message || 'Failed to accept co-host');
    } finally {
      setLoading(false);
    }
  };

  // Reject co-host request
  const handleRejectRequest = async (requestId) => {
    setLoading(true);
    try {
      const authToken = await getAuthToken();
      const response = await fetchWithRetry(
        `${import.meta.env.VITE_BACKEND_URL}/streaming/co-host-reject`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`
          },
          body: JSON.stringify({ requestId })
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to reject request');
      }

      toast.success('Co-host request rejected');
      await fetchRequests();
    } catch (error) {
      toast.error(error.message || 'Failed to reject co-host');
    } finally {
      setLoading(false);
    }
  };

  // Remove co-host
  const handleRemoveCoHost = async (coHostId) => {
    setLoading(true);
    try {
      const authToken = await getAuthToken();
      const response = await fetchWithRetry(
        `${import.meta.env.VITE_BACKEND_URL}/streaming/co-host-remove`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`
          },
          body: JSON.stringify({ coHostId, streamId })
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to remove co-host');
      }

      toast.success('Co-host removed');
      await fetchCoHosts();
    } catch (error) {
      toast.error(error.message || 'Failed to remove co-host');
    } finally {
      setLoading(false);
    }
  };

  // Setup socket listeners with initial delay
  useEffect(() => {
    // Delay initial fetch to avoid rate limiting on mount
    const initialFetchTimeout = setTimeout(() => {
      fetchCoHosts();
      if (isCreator) {
        fetchRequests();
      }
    }, 1000);
    
    // Cleanup timeout on unmount
    const cleanup = () => clearTimeout(initialFetchTimeout);

    // Socket event listeners
    const unsubscribeRequest = on('co_host_request', (data) => {
      if (isCreator && data.streamId === streamId) {
        setCoHostRequests(prev => {
          const updated = [...prev, data];
          // Notify parent about new requests
          if (onRequestsUpdate) {
            onRequestsUpdate(updated);
          }
          return updated;
        });
        toast.info(`${data.requesterName} wants to co-host`);
      }
    });

    const unsubscribeAccepted = on('co_host_accepted', (data) => {
      if (data.streamId === streamId) {
        toast.success('You are now a co-host!');
        fetchCoHosts();
      }
    });

    const unsubscribeRejected = on('co_host_rejected', () => {
      toast.info('Your co-host request was declined');
    });

    const unsubscribeJoined = on('co_host_joined', (data) => {
      if (data.streamId === streamId) {
        fetchCoHosts();
      }
    });

    const unsubscribeLeft = on('co_host_left', (data) => {
      if (data.streamId === streamId) {
        setCoHosts(prev => prev.filter(ch => ch.co_host_id !== data.coHostId));
      }
    });

    const unsubscribeRemoved = on('co_host_removed', (data) => {
      if (data.streamId === streamId && data.coHostId === user?.supabase_id) {
        toast.info('You have been removed as a co-host');
        window.location.reload(); // Reload to switch back to audience role
      }
    });

    return () => {
      cleanup();
      unsubscribeRequest();
      unsubscribeAccepted();
      unsubscribeRejected();
      unsubscribeJoined();
      unsubscribeLeft();
      unsubscribeRemoved();
    };
  }, [streamId, isCreator, user, on, fetchCoHosts, fetchRequests]);

  // Check if current user is already a co-host
  const isCoHost = coHosts.some(ch => ch.co_host_id === user?.supabase_id);
  const canRequestCoHost = !isCreator && !isCoHost && user?.is_creator;

  return (
    <div className={`bg-gray-900 rounded-2xl p-4 space-y-4 shadow-2xl border border-gray-800 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-white text-lg font-bold flex items-center gap-2">
          <UserGroupIcon className="w-5 h-5" />
          Co-Hosts ({coHosts.length}/4)
        </h3>
        <div className="flex items-center gap-2">
          {canRequestCoHost && (
            <button
              onClick={handleJoinRequest}
              disabled={loading}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              <UserPlusIcon className="w-4 h-4" />
              Request Co-Host
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors text-gray-400 hover:text-white"
              title="Close"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Co-Host Requests (Creator Only) */}
      {isCreator && coHostRequests.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-gray-400 text-sm font-semibold uppercase tracking-wider">
            Pending Requests
          </h4>
          {coHostRequests.map((request) => (
            <div
              key={request.id}
              className="bg-gray-800 rounded-lg p-3 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                {request.requester_avatar ? (
                  <img
                    src={request.requester_avatar}
                    alt={request.requester_name}
                    className="w-10 h-10 rounded-full"
                  />
                ) : (
                  <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm">
                      {request.requester_name?.[0]?.toUpperCase()}
                    </span>
                  </div>
                )}
                <span className="text-white font-medium">
                  {request.requester_name}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleAcceptRequest(request.id)}
                  disabled={loading}
                  className="p-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50"
                  title="Accept"
                >
                  <CheckIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleRejectRequest(request.id)}
                  disabled={loading}
                  className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
                  title="Reject"
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Current Co-Hosts */}
      {coHosts.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-gray-400 text-sm font-semibold uppercase tracking-wider">
            Active Co-Hosts
          </h4>
          {coHosts.map((coHost) => (
            <div
              key={coHost.co_host_id}
              className="bg-gray-800 rounded-lg p-3 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                {coHost.avatar ? (
                  <img
                    src={coHost.avatar}
                    alt={coHost.display_name}
                    className="w-10 h-10 rounded-full"
                  />
                ) : (
                  <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm">
                      {coHost.display_name?.[0]?.toUpperCase()}
                    </span>
                  </div>
                )}
                <div>
                  <span className="text-white font-medium block">
                    {coHost.display_name}
                  </span>
                  <span className="text-gray-400 text-xs">
                    Joined {new Date(coHost.joined_at).toLocaleTimeString()}
                  </span>
                </div>
              </div>
              {isCreator && (
                <button
                  onClick={() => handleRemoveCoHost(coHost.co_host_id)}
                  disabled={loading}
                  className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
                  title="Remove Co-Host"
                >
                  <UserMinusIcon className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {coHosts.length === 0 && coHostRequests.length === 0 && (
        <div className="text-center py-8">
          <UserGroupIcon className="w-12 h-12 mx-auto text-gray-600 mb-3" />
          <p className="text-gray-400">
            {isCreator
              ? 'No co-hosts yet. Creators can request to join!'
              : isCoHost
              ? 'You are a co-host!'
              : 'No co-hosts in this stream'}
          </p>
        </div>
      )}
    </div>
  );
};

export default CoHostManager;