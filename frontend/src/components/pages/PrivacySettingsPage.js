import React from 'react';
import { useNavigate } from 'react-router-dom';
import PrivacySettings from '../PrivacySettings';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

const PrivacySettingsPage = ({ user, ...props }) => {
  const navigate = useNavigate();

  const handleClose = () => {
    navigate('/profile');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={handleClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <ArrowLeftIcon className="w-6 h-6" />
          </button>
          <h1 className="text-xl sm:text-2xl font-bold">Privacy & Security</h1>
        </div>
        <p className="text-blue-100">
          Manage your privacy settings and security preferences
        </p>
      </div>

      {/* Privacy Settings Component */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <PrivacySettings
          user={user}
          onClose={handleClose}
          {...props}
        />
      </div>
    </div>
  );
};

export default PrivacySettingsPage;