import React from 'react';
import CreatorStudio from '../CreatorStudio';

const CreatorStudioPage = ({ user, ...props }) => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-500 to-pink-600 rounded-2xl p-6 text-white">
        <h1 className="text-3xl font-bold mb-2">Creator Studio</h1>
        <p className="text-purple-100">
          Manage your content, analytics, and fan interactions
        </p>
      </div>

      {/* Studio Content */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <CreatorStudio 
          user={user}
          onClose={() => window.history.back()}
          {...props}
        />
      </div>
    </div>
  );
};

export default CreatorStudioPage;