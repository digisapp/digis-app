import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  SparklesIcon,
  HeartIcon,
  StarIcon,
  FireIcon,
  CurrencyDollarIcon,
  ChatBubbleLeftRightIcon,
  VideoCameraIcon,
  MicrophoneIcon,
  GiftIcon,
  RocketLaunchIcon,
  HandRaisedIcon
} from '@heroicons/react/24/solid';

const HomePage = () => {
  const navigate = useNavigate();

  const features = [
    { icon: VideoCameraIcon, text: "Video Calls", emoji: "📹" },
    { icon: MicrophoneIcon, text: "Voice Chats", emoji: "🎤" },
    { icon: ChatBubbleLeftRightIcon, text: "Live Messaging", emoji: "💬" },
    { icon: GiftIcon, text: "Send Gifts", emoji: "🎁" },
  ];

  const creatorPerks = [
    "💰 Set your own prices",
    "📈 Grow your fanbase",
    "🛡️ Safe & secure platform",
    "💎 Weekly payouts",
    "🚀 Marketing support",
    "💬 Direct fan connections"
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-400 via-purple-500 to-indigo-600 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-yellow-300 rounded-full mix-blend-screen filter blur-3xl opacity-70 animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-pink-300 rounded-full mix-blend-screen filter blur-3xl opacity-70 animate-pulse animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-300 rounded-full mix-blend-screen filter blur-3xl opacity-50 animate-pulse animation-delay-4000"></div>
        
        {/* Floating emojis */}
        <motion.div
          className="absolute top-20 left-10 text-4xl"
          animate={{ 
            y: [0, -20, 0],
            rotate: [-10, 10, -10]
          }}
          transition={{ duration: 3, repeat: Infinity }}
        >
          ✨
        </motion.div>
        <motion.div
          className="absolute top-40 right-20 text-4xl"
          animate={{ 
            y: [0, 20, 0],
            rotate: [10, -10, 10]
          }}
          transition={{ duration: 4, repeat: Infinity }}
        >
          💫
        </motion.div>
        <motion.div
          className="absolute bottom-20 left-20 text-4xl"
          animate={{ 
            y: [0, -30, 0],
            scale: [1, 1.2, 1]
          }}
          transition={{ duration: 5, repeat: Infinity }}
        >
          🌟
        </motion.div>
      </div>

      {/* Navigation */}
      <nav className="relative z-50 px-4 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center space-x-2 group">
            <div className="p-2 bg-white/20 backdrop-blur-sm rounded-xl group-hover:bg-white/30 transition-all">
              <SparklesIcon className="h-6 w-6 text-white" />
            </div>
            <span className="text-2xl font-black text-white">Digis</span>
          </Link>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate('/auth')}
              className="px-6 py-2.5 bg-white/20 backdrop-blur-sm text-white font-bold rounded-full hover:bg-white/30 transform hover:scale-105 transition-all duration-200"
            >
              Log In
            </button>
            <button
              onClick={() => navigate('/auth?mode=signup')}
              className="px-6 py-2.5 bg-white text-purple-600 font-bold rounded-full hover:bg-gray-100 transform hover:scale-105 transition-all duration-200 shadow-lg"
            >
              Sign Up ✨
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative z-40 px-4 py-12 pb-20">
        <div className="max-w-6xl mx-auto text-center">
          {/* Main Headline */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-12"
          >
            <h1 className="text-5xl md:text-7xl font-black text-white mb-6 leading-tight">
              Connect with your
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-pink-300">
                favorite creators
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-white/90 font-medium max-w-2xl mx-auto">
              Video calls, voice chats, live streams & more! 
              <br />
              <span className="text-yellow-300">Join thousands of fans & creators 🎉</span>
            </p>
          </motion.div>

          {/* Feature Pills */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex flex-wrap justify-center gap-3 mb-12"
          >
            {features.map((feature, index) => (
              <div
                key={index}
                className="px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full text-white font-medium text-sm flex items-center space-x-2"
              >
                <span className="text-xl">{feature.emoji}</span>
                <span>{feature.text}</span>
              </div>
            ))}
          </motion.div>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col md:flex-row gap-4 justify-center items-center mb-16"
          >
            <button
              onClick={() => navigate('/auth?mode=signup&type=fan')}
              className="group relative px-8 py-4 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold text-lg rounded-full hover:from-pink-600 hover:to-purple-700 transform hover:scale-105 transition-all duration-200 shadow-xl"
            >
              <span className="flex items-center space-x-2">
                <HeartIcon className="h-5 w-5" />
                <span>I'm a Fan</span>
                <span className="text-2xl">🎉</span>
              </span>
            </button>
            
            <span className="text-white font-bold text-lg">OR</span>
            
            <button
              onClick={() => navigate('/auth?mode=signup&type=creator')}
              className="group relative px-8 py-4 bg-gradient-to-r from-yellow-400 to-orange-500 text-white font-bold text-lg rounded-full hover:from-yellow-500 hover:to-orange-600 transform hover:scale-105 transition-all duration-200 shadow-xl"
            >
              <span className="flex items-center space-x-2">
                <StarIcon className="h-5 w-5" />
                <span>I'm a Creator</span>
                <span className="text-2xl">⭐</span>
              </span>
            </button>
          </motion.div>

          {/* Creator Benefits */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="max-w-4xl mx-auto"
          >
            <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 border border-white/20">
              <h2 className="text-3xl font-black text-white mb-6 flex items-center justify-center">
                <RocketLaunchIcon className="h-8 w-8 mr-2" />
                Why Creators Love Digis
              </h2>
              
              <div className="grid md:grid-cols-2 gap-4 mb-8">
                {creatorPerks.map((perk, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: 0.5 + index * 0.1 }}
                    className="flex items-center space-x-2 text-white text-lg font-medium"
                  >
                    <span>{perk}</span>
                  </motion.div>
                ))}
              </div>

              <div className="flex flex-col md:flex-row items-center justify-center space-y-4 md:space-y-0 md:space-x-8">
                <div className="text-center">
                  <div className="text-4xl font-black text-yellow-300">50K+</div>
                  <div className="text-white font-medium">Active Creators</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-black text-pink-300">$2M+</div>
                  <div className="text-white font-medium">Earned Monthly</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-black text-green-300">4.9/5</div>
                  <div className="text-white font-medium">Creator Rating</div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Bottom CTA */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="mt-16 text-white"
          >
            <p className="text-2xl font-bold mb-4">Ready to join the fun? 🚀</p>
            <button
              onClick={() => navigate('/auth?mode=signup')}
              className="px-10 py-4 bg-white text-purple-600 font-black text-xl rounded-full hover:bg-gray-100 transform hover:scale-105 transition-all duration-200 shadow-2xl"
            >
              Get Started Free
            </button>
            <p className="mt-4 text-white/80 font-medium">
              No credit card required • Start earning/connecting today!
            </p>
          </motion.div>
        </div>
      </div>

      {/* Floating Action Hint */}
      <motion.div
        className="fixed bottom-8 right-8 z-50"
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, delay: 1 }}
      >
        <div className="bg-white rounded-full px-6 py-3 shadow-2xl flex items-center space-x-2">
          <HandRaisedIcon className="h-6 w-6 text-purple-600 animate-bounce" />
          <span className="font-bold text-purple-600">Join 100K+ users!</span>
        </div>
      </motion.div>

      <style>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 0.7;
          }
          50% {
            opacity: 1;
          }
        }
        .animate-pulse {
          animation: pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  );
};

export default HomePage;