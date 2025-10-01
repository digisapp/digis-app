import React, { useState } from 'react';
import { XMarkIcon, PaperAirplaneIcon, UserGroupIcon } from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';

const SimpleBroadcastModal = ({ isOpen, onClose, user }) => {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!message.trim()) {
      toast.error('Please enter a message');
      return;
    }

    setSending(true);

    // Simulate sending for now
    setTimeout(() => {
      toast.success('Broadcast sent to all fans!');
      setMessage('');
      setSending(false);
      onClose();
    }, 1000);
  };

  if (!isOpen) return null;

  // Simple full-screen overlay without Portal
  return (
    <div
      className="fixed inset-0 z-[9999]"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 999999,
        backgroundColor: 'rgba(0, 0, 0, 0.5)'
      }}
    >
      {/* Modal Content */}
      <div
        className="absolute inset-0 bg-white flex flex-col"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'white',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Header */}
        <div
          className="bg-purple-600 text-white p-4 flex items-center justify-between"
          style={{
            backgroundColor: '#9333ea',
            color: 'white',
            padding: '1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div className="flex items-center gap-2">
            <UserGroupIcon className="w-5 h-5" />
            <span className="font-semibold">Broadcast Message</span>
          </div>
          <button
            onClick={onClose}
            className="p-1"
            style={{ padding: '0.25rem' }}
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Message Input */}
        <div className="flex-1 p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Message to all fans
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full h-32 p-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
            placeholder="What's on your mind?"
            disabled={sending}
            style={{
              width: '100%',
              height: '8rem',
              padding: '0.75rem',
              border: '1px solid #d1d5db',
              borderRadius: '0.5rem',
              resize: 'none'
            }}
          />
          <div className="mt-2 text-sm text-gray-500">
            {message.length}/500 characters
          </div>
        </div>

        {/* Send Button */}
        <div className="p-4 border-t">
          <button
            onClick={handleSend}
            disabled={sending || !message.trim()}
            className="w-full bg-purple-600 text-white py-3 rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50"
            style={{
              width: '100%',
              backgroundColor: sending || !message.trim() ? '#d1d5db' : '#9333ea',
              color: 'white',
              padding: '0.75rem',
              borderRadius: '0.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              opacity: sending || !message.trim() ? 0.5 : 1
            }}
          >
            {sending ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <PaperAirplaneIcon className="w-5 h-5" />
                Send Broadcast
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SimpleBroadcastModal;