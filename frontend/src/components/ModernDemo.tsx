import React from 'react';
import { useAppStore } from '../stores/useAppStore';
import { useCreators } from '../hooks/api/useCreators';
import { motion } from 'framer-motion';

export const ModernDemo: React.FC = () => {
  // Modern state management with Zustand
  const { user, tokenBalance, incrementTokens } = useAppStore();
  
  // Modern data fetching with TanStack Query
  const { data: creators, isLoading } = useCreators();
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-8 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl"
    >
      <h2 className="text-2xl font-bold text-gray-800 mb-4">
        🚀 Modern Stack Demo
      </h2>
      
      {/* Zustand State */}
      <div className="mb-6 p-4 bg-white rounded-lg shadow">
        <h3 className="font-semibold text-purple-600 mb-2">Zustand State Management</h3>
        <p>User: {user?.displayName || 'Not logged in'}</p>
        <p>Token Balance: {tokenBalance}</p>
        <button
          onClick={() => incrementTokens(10)}
          className="mt-2 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
        >
          Add 10 Tokens (Zustand)
        </button>
      </div>
      
      {/* TanStack Query */}
      <div className="p-4 bg-white rounded-lg shadow">
        <h3 className="font-semibold text-pink-600 mb-2">TanStack Query Data Fetching</h3>
        {isLoading ? (
          <p>Loading creators...</p>
        ) : (
          <p>Found {creators?.length || 0} creators (auto-cached!)</p>
        )}
      </div>
      
      <div className="mt-4 text-sm text-gray-600">
        <p>✅ Vite: Instant HMR</p>
        <p>✅ TypeScript: Type safety</p>
        <p>✅ Zustand: Simple state management</p>
        <p>✅ TanStack Query: Smart data fetching</p>
      </div>
    </motion.div>
  );
};