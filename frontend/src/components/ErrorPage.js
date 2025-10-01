import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  ExclamationTriangleIcon, 
  HomeIcon,
  ArrowLeftIcon 
} from '@heroicons/react/24/outline';

const ErrorPage = ({ 
  errorCode = 404, 
  errorMessage = "Page not found",
  errorDescription = "The page you're looking for doesn't exist or has been moved."
}) => {
  const navigate = useNavigate();

  const errorConfig = {
    404: {
      title: "Page Not Found",
      description: "The page you're looking for doesn't exist or has been moved.",
      icon: "🔍"
    },
    500: {
      title: "Server Error",
      description: "Something went wrong on our end. Please try again later.",
      icon: "🛠️"
    },
    403: {
      title: "Access Denied",
      description: "You don't have permission to access this resource.",
      icon: "🔒"
    }
  };

  const config = errorConfig[errorCode] || {
    title: errorMessage,
    description: errorDescription,
    icon: "⚠️"
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-pink-900 flex items-center justify-center p-4">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            rotate: [0, 90, 0],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "linear"
          }}
          className="absolute -top-20 -left-20 w-60 h-60 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30"
        />
        <motion.div
          animate={{
            scale: [1.2, 1, 1.2],
            rotate: [0, -90, 0],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: "linear"
          }}
          className="absolute -bottom-20 -right-20 w-60 h-60 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30"
        />
      </div>

      {/* Content */}
      <div className="relative z-10 text-center max-w-2xl mx-auto">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <img 
            src="/digis-logo-white.png" 
            alt="Digis" 
            className="h-12 w-auto mx-auto opacity-90"
          />
        </motion.div>

        {/* Error Code */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ 
            type: "spring",
            stiffness: 260,
            damping: 20,
            delay: 0.2 
          }}
          className="mb-8"
        >
          <div className="text-9xl font-bold text-white/20 select-none">
            {errorCode}
          </div>
          <div className="text-6xl absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
            {config.icon}
          </div>
        </motion.div>

        {/* Error Message */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-4xl font-bold text-white mb-4"
        >
          {config.title}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-xl text-white/80 mb-8"
        >
          {config.description}
        </motion.p>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="flex flex-col sm:flex-row gap-4 justify-center"
        >
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate(-1)}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-white/20 backdrop-blur-sm text-white rounded-xl hover:bg-white/30 transition-all duration-200 font-medium"
          >
            <ArrowLeftIcon className="w-5 h-5" />
            Go Back
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/')}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-white text-purple-600 rounded-xl hover:bg-white/90 transition-all duration-200 font-medium shadow-lg"
          >
            <HomeIcon className="w-5 h-5" />
            Go to Home
          </motion.button>
        </motion.div>

        {/* Additional Help Text */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-8 text-sm text-white/60"
        >
          If you believe this is a mistake, please contact our support team.
        </motion.p>
      </div>
    </div>
  );
};

export default ErrorPage;