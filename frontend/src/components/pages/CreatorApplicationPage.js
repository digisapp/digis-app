import React from 'react';
import { useNavigate } from 'react-router-dom';
import CreatorApplication from '../CreatorApplication';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

const CreatorApplicationPage = ({ user, ...props }) => {
  const navigate = useNavigate();

  const handleClose = () => {
    navigate('/profile');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-yellow-400 to-orange-500 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={handleClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <ArrowLeftIcon className="w-6 h-6" />
          </button>
          <h1 className="text-xl sm:text-2xl font-bold">Become a Creator</h1>
        </div>
        <p className="text-yellow-100">
          Join our creator community and start earning from your content
        </p>
      </div>

      {/* Application Component */}
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <CreatorApplication
            user={user}
            onClose={handleClose}
            {...props}
          />
        </div>
      </div>
    </div>
  );
};

export default CreatorApplicationPage;