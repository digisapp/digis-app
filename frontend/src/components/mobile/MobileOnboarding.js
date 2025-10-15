import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  SparklesIcon,
  VideoCameraIcon,
  ChatBubbleLeftRightIcon,
  CurrencyDollarIcon,
  ChevronRightIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';

const MobileOnboarding = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    {
      icon: SparklesIcon,
      title: "Welcome to Digis!",
      description: "Connect with your favorite creators through video calls, live streams, and more.",
      color: "from-purple-600 to-pink-600"
    },
    {
      icon: VideoCameraIcon,
      title: "Video Calls & Streaming",
      description: "Join live streams or have one-on-one video calls with creators.",
      color: "from-blue-600 to-cyan-600"
    },
    {
      icon: ChatBubbleLeftRightIcon,
      title: "Real-time Interaction",
      description: "Chat, send reactions, and interact during live sessions.",
      color: "from-green-600 to-teal-600"
    },
    {
      icon: CurrencyDollarIcon,
      title: "Token Economy",
      description: "Purchase tokens to support creators and unlock exclusive content.",
      color: "from-orange-600 to-red-600"
    }
  ];

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const skipOnboarding = () => {
    onComplete();
  };

  const currentStepData = steps[currentStep];
  const Icon = currentStepData.icon;

  return (
    <div className="fixed inset-0 bg-white dark:bg-white z-50 flex flex-col" style={{ backgroundColor: '#ffffff' }}>
      {/* Skip Button */}
      <div className="absolute top-4 right-4 mobile-safe-top z-10">
        <button
          onClick={skipOnboarding}
          className="text-gray-500 hover:text-gray-700 text-sm font-medium px-4 py-2"
        >
          Skip
        </button>
      </div>

      {/* Progress Dots */}
      <div className="absolute top-16 left-0 right-0 flex justify-center gap-2">
        {steps.map((_, index) => (
          <motion.div
            key={index}
            className={`h-2 rounded-full transition-all duration-300 ${
              index === currentStep ? 'w-8 bg-purple-600' : 'w-2 bg-gray-300'
            }`}
          />
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.3 }}
            className="text-center max-w-sm mx-auto"
          >
            {/* Icon */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ 
                type: "spring",
                stiffness: 200,
                damping: 15,
                delay: 0.1
              }}
              className={`w-32 h-32 mx-auto mb-8 rounded-full bg-gradient-to-br ${currentStepData.color} flex items-center justify-center`}
            >
              <Icon className="w-16 h-16 text-white" />
            </motion.div>

            {/* Title */}
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-2xl font-bold text-gray-900 mb-4"
            >
              {currentStepData.title}
            </motion.h2>

            {/* Description */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-gray-600 mb-8"
            >
              {currentStepData.description}
            </motion.p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom Actions */}
      <div className="px-8 pb-8 mobile-safe-bottom">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={nextStep}
          className={`w-full py-4 rounded-2xl bg-gradient-to-r ${currentStepData.color} text-white font-semibold flex items-center justify-center gap-2`}
        >
          {currentStep === steps.length - 1 ? (
            <>
              Get Started
              <CheckCircleIcon className="w-5 h-5" />
            </>
          ) : (
            <>
              Next
              <ChevronRightIcon className="w-5 h-5" />
            </>
          )}
        </motion.button>
      </div>

      {/* Background Decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{
            x: [0, 100, 0],
            y: [0, -100, 0],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "linear"
          }}
          className="absolute -top-20 -right-20 w-80 h-80 bg-purple-200 rounded-full opacity-20 blur-3xl"
        />
        <motion.div
          animate={{
            x: [0, -100, 0],
            y: [0, 100, 0],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: "linear"
          }}
          className="absolute -bottom-20 -left-20 w-80 h-80 bg-pink-200 rounded-full opacity-20 blur-3xl"
        />
      </div>
    </div>
  );
};

export default MobileOnboarding;