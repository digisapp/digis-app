import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
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
  const videoRef1 = useRef(null);
  const videoRef2 = useRef(null);
  const videoRef3 = useRef(null);
  const [logoFailed, setLogoFailed] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  // Reset page title and meta tags on mount
  useEffect(() => {
    document.title = 'Digis - Connect with Creators';

    // Reset OG tags to default
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.content = 'Digis - Connect with Creators';

    const ogDescription = document.querySelector('meta[property="og:description"]');
    if (ogDescription) ogDescription.content = 'Connect with your favorite creators through video calls, live streams, and exclusive content.';

    const ogImage = document.querySelector('meta[property="og:image"]');
    if (ogImage) ogImage.content = 'https://digis.cc/og-image.png';

    console.log('📄 HomePage: Reset page title and meta tags');
  }, []);

  useEffect(() => {
    // Viewport-aware video autoplay with IntersectionObserver
    const videoRefs = [videoRef1.current, videoRef2.current, videoRef3.current].filter(Boolean);

    const playVideo = (video) => {
      if (video && video.paused) {
        video.play().catch(() => {});
      }
    };

    const pauseVideo = (video) => {
      if (video && !video.paused) {
        try { video.pause(); } catch(e) {}
      }
    };

    // Create IntersectionObserver for viewport-aware playback
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(({ isIntersecting, target }) => {
          if (isIntersecting) {
            playVideo(target);
          } else {
            pauseVideo(target);
          }
        });
      },
      { threshold: 0.5 } // Play when 50% visible
    );

    // Set up videos with preload and observer
    videoRefs.forEach(video => {
      if (video) {
        video.preload = 'metadata';
        observer.observe(video);
      }
    });

    // Fallback for initial interaction if needed
    let interactionHandler = null;
    const hasPlayed = new Set();

    interactionHandler = () => {
      videoRefs.forEach(video => {
        if (video && !hasPlayed.has(video)) {
          playVideo(video);
          hasPlayed.add(video);
        }
      });
      if (hasPlayed.size === videoRefs.length && interactionHandler) {
        document.removeEventListener('pointerup', interactionHandler);
        interactionHandler = null;
      }
    };

    // Only add listener if videos need interaction to play
    const checkAutoplay = setTimeout(() => {
      const needsInteraction = videoRefs.some(v => v && v.paused);
      if (needsInteraction && interactionHandler) {
        document.addEventListener('pointerup', interactionHandler, { once: false });
      }
    }, 1000);

    return () => {
      observer.disconnect();
      clearTimeout(checkAutoplay);
      if (interactionHandler) {
        document.removeEventListener('pointerup', interactionHandler);
      }
    };
  }, []);

  const features = [
    { icon: VideoCameraIcon, text: "Video Calls", emoji: "📹" },
    { icon: MicrophoneIcon, text: "Voice Chats", emoji: "🎤" },
    { icon: ChatBubbleLeftRightIcon, text: "Live Messaging", emoji: "💬" },
    { icon: GiftIcon, text: "Send Gifts", emoji: "🎁" },
  ];

  const creatorPerks = [
    "💰 Set your own prices",
    "💎 Weekly payouts",
    "🚀 Marketing support",
    "💬 Direct fan connections",
    "📸 Creator Collabs"
  ];

  return (
    <div className="bg-gradient-to-br from-pink-400 via-purple-500 to-indigo-600">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true" role="presentation">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-yellow-300 rounded-full mix-blend-screen filter blur-3xl opacity-70 animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-pink-300 rounded-full mix-blend-screen filter blur-3xl opacity-70 animate-pulse animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-300 rounded-full mix-blend-screen filter blur-3xl opacity-50 animate-pulse animation-delay-4000"></div>
        
        {/* Floating emojis with reduced motion support */}
        <motion.div
          className="absolute top-20 left-10 text-4xl"
          animate={shouldReduceMotion ? undefined : {
            y: [0, -20, 0],
            rotate: [-10, 10, -10]
          }}
          transition={{ duration: 3, repeat: Infinity }}
          style={{ willChange: shouldReduceMotion ? 'auto' : 'transform' }}
        >
          ✨
        </motion.div>
        <motion.div
          className="absolute top-40 right-20 text-4xl"
          animate={shouldReduceMotion ? undefined : {
            y: [0, 20, 0],
            rotate: [10, -10, 10]
          }}
          transition={{ duration: 4, repeat: Infinity }}
          style={{ willChange: shouldReduceMotion ? 'auto' : 'transform' }}
        >
          💫
        </motion.div>
        <motion.div
          className="absolute bottom-20 left-20 text-4xl"
          animate={shouldReduceMotion ? undefined : {
            y: [0, -30, 0],
            scale: [1, 1.2, 1]
          }}
          transition={{ duration: 5, repeat: Infinity }}
          style={{ willChange: shouldReduceMotion ? 'auto' : 'transform' }}
        >
          🌟
        </motion.div>
      </div>

      {/* Navigation */}
      <nav className="relative z-50 px-4 py-4" style={{ pointerEvents: 'auto' }}>
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center group ml-6" style={{ pointerEvents: 'auto', position: 'relative', zIndex: 100 }}>
            {logoFailed ? (
              <span className="text-2xl font-black text-white">DIGIS</span>
            ) : (
              <img
                src="/digis-logo-white.png"
                alt="Digis"
                className="h-10 w-auto hover:scale-105 transition-transform duration-200"
                onError={() => setLogoFailed(true)}
              />
            )}
          </Link>

          <div className="flex items-center space-x-3" style={{ pointerEvents: 'auto', position: 'relative', zIndex: 100 }}>
            <Link
              to="/auth?mode=signin"
              className="px-6 py-2.5 bg-white/20 backdrop-blur-sm text-white font-bold rounded-full hover:bg-white/30 transform hover:scale-105 transition-all duration-200 cursor-pointer inline-block"
              style={{ pointerEvents: 'auto', position: 'relative', zIndex: 100 }}
            >
              Sign in
            </Link>
            <Link
              to="/auth?mode=signup"
              className="px-6 py-2.5 bg-white text-purple-600 font-bold rounded-full hover:bg-gray-100 transform hover:scale-105 transition-all duration-200 shadow-lg cursor-pointer inline-block"
              style={{ pointerEvents: 'auto', position: 'relative', zIndex: 100 }}
            >
              Sign Up
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative z-40 px-4 pt-4 pb-6 md:py-12">
        <div className="max-w-6xl mx-auto text-center w-full">
          {/* Main Headline */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-6 md:mb-12"
          >
            <h1 className="text-5xl md:text-7xl font-black text-white mb-6 leading-tight">
              Connect with your
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-pink-300">
                favorite creators
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-white/90 font-medium max-w-3xl mx-auto">
              Monetize with live streams, video and voice calls, content, and creator collabs.
            </p>
          </motion.div>

          {/* CTA Button */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex justify-center items-center mb-8 md:mb-16 relative z-10"
          >
            <Link
              to="/auth?mode=signup"
              className="group relative px-10 py-4 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold text-xl rounded-full hover:from-pink-600 hover:to-purple-700 transform hover:scale-105 transition-all duration-200 shadow-xl cursor-pointer inline-block"
              style={{ pointerEvents: 'auto', position: 'relative', zIndex: 100 }}
            >
              <span className="flex items-center space-x-2">
                <RocketLaunchIcon className="h-6 w-6" />
                <span>Get Started Now</span>
              </span>
            </Link>
          </motion.div>

          {/* Video Gallery Section - 3 Vertical Videos */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.35 }}
            className="mb-8 md:mb-16 px-2 md:px-4"
          >
            <div className="max-w-6xl mx-auto">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 justify-items-center">
                {/* Video 1 - Intro */}
                <div className="w-full max-w-sm">
                  <div className="bg-white/10 backdrop-blur-md rounded-3xl p-2 border border-white/20 shadow-2xl">
                    <div className="relative rounded-2xl overflow-hidden aspect-[9/16] bg-gradient-to-br from-purple-600 to-pink-600">
                      <video
                        ref={videoRef1}
                        className="absolute inset-0 w-full h-full object-cover rounded-2xl"
                        autoPlay
                        muted
                        loop
                        playsInline
                        preload="metadata"
                        style={{ pointerEvents: 'none' }}
                        aria-label="Digis platform introduction video"
                      >
                        <source src="/digis-video-intro.mp4" type="video/mp4" />
                        <source src="/digis-video-intro.mov" type="video/quicktime" />
                        Your browser does not support the video tag.
                      </video>
                    </div>
                  </div>
                </div>

                {/* Video 2 - Celebs (Middle) */}
                <div className="w-full max-w-sm">
                  <div className="bg-white/10 backdrop-blur-md rounded-3xl p-2 border border-white/20 shadow-2xl">
                    <div className="relative rounded-2xl overflow-hidden aspect-[9/16] bg-gradient-to-br from-yellow-500 to-orange-500">
                      <video
                        ref={videoRef2}
                        className="absolute inset-0 w-full h-full object-cover rounded-2xl"
                        autoPlay
                        muted
                        loop
                        playsInline
                        preload="metadata"
                        style={{ pointerEvents: 'none' }}
                        aria-label="Featured creators on Digis"
                      >
                        <source src="/digis-video-celebs.mp4" type="video/mp4" />
                        <source src="/digis-video-celebs.mov" type="video/quicktime" />
                        Your browser does not support the video tag.
                      </video>
                    </div>
                  </div>
                </div>

                {/* Video 3 - Alix */}
                <div className="w-full max-w-sm">
                  <div className="bg-white/10 backdrop-blur-md rounded-3xl p-2 border border-white/20 shadow-2xl">
                    <div className="relative rounded-2xl overflow-hidden aspect-[9/16] bg-gradient-to-br from-pink-500 to-purple-600">
                      <video
                        ref={videoRef3}
                        className="absolute inset-0 w-full h-full object-cover rounded-2xl"
                        autoPlay
                        muted
                        loop
                        playsInline
                        preload="metadata"
                        style={{ pointerEvents: 'none' }}
                        aria-label="Creator showcase video"
                      >
                        <source src="/digis-video-alix.mp4" type="video/mp4" />
                        <source src="/digis-video-alix.mov" type="video/quicktime" />
                        Your browser does not support the video tag.
                      </video>
                    </div>
                  </div>
                </div>
              </div>
              
              <p className="text-center text-white/80 mt-4 md:mt-6 text-base md:text-lg">
                Join thousands of creators building thriving communities on Digis
              </p>
            </div>
          </motion.div>

          {/* Key Features Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6 mb-8 md:mb-16 max-w-6xl mx-auto px-2 md:px-4"
          >
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 md:p-6 border border-white/20">
              <h2 className="text-lg md:text-xl font-bold text-pink-300 mb-2">Streams & Video Calls</h2>
              <p className="text-white/80 text-xs md:text-sm">Go live, host co-streams with fellow creators, or offer private sessions.</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 md:p-6 border border-white/20">
              <h2 className="text-lg md:text-xl font-bold text-yellow-300 mb-2">Fan Chat</h2>
              <p className="text-white/80 text-xs md:text-sm">Build loyal connections with real time Chat Messaging! Chat in Streams & Privately!</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 md:p-6 border border-white/20">
              <h2 className="text-lg md:text-xl font-bold text-green-300 mb-2">Tips & Gifts</h2>
              <p className="text-white/80 text-xs md:text-sm">Earn from Streams, Classes, Content, and Messages.</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 md:p-6 border border-white/20">
              <h2 className="text-lg md:text-xl font-bold text-purple-300 mb-2">Classes</h2>
              <p className="text-white/80 text-xs md:text-sm">Host your Pilates Class or Online Coach your Students through interactive classes!</p>
            </div>
          </motion.div>

          {/* Why Creators Love Digis */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="max-w-5xl mx-auto mb-8 md:mb-12"
          >
            <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 border border-white/20">
              <h2 className="text-3xl font-black text-white mb-8 text-center">
                Why Creators Love Digis
              </h2>
              
              <div className="grid md:grid-cols-2 gap-6 mb-8">
                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <span className="text-2xl">💰</span>
                    <div>
                      <h3 className="text-lg font-bold text-white">Financially Independent</h3>
                      <p className="text-white/80 text-sm">Set your prices and get paid fast and reliably.</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <span className="text-2xl">🚀</span>
                    <div>
                      <h3 className="text-lg font-bold text-white">Discoverability</h3>
                      <p className="text-white/80 text-sm">Get organic exposure via Digis TV and Creator Explore Page.</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <span className="text-2xl">👩‍💼</span>
                    <div>
                      <h3 className="text-lg font-bold text-white">Empowering Tools</h3>
                      <p className="text-white/80 text-sm">Latest tools for Stream, Video and Calls, and Messaging designed for your success.</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <span className="text-2xl">💬</span>
                    <div>
                      <h3 className="text-lg font-bold text-white">Direct Fan Connections</h3>
                      <p className="text-white/80 text-sm">Build genuine relationships with chats, gifts, and exclusive content.</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <span className="text-2xl">📈</span>
                    <div>
                      <h3 className="text-lg font-bold text-white">Proven Earnings</h3>
                      <p className="text-white/80 text-sm">Join creators earning monthly with our supportive community.</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <span className="text-2xl">✈️</span>
                    <div>
                      <h3 className="text-lg font-bold text-white">Travel</h3>
                      <p className="text-white/80 text-sm">Join Creator Experiences! Connect, Create, and Travel with Digis Creators!</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col md:flex-row items-center justify-center space-y-4 md:space-y-0 md:space-x-12 pt-6 border-t border-white/20">
                <div className="text-center">
                  <div className="text-4xl font-black text-yellow-300">10K+</div>
                  <div className="text-white font-medium">Active Creators</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-black text-pink-300">$100K+</div>
                  <div className="text-white font-medium">Top Monthly Earnings</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-black text-green-300">98%</div>
                  <div className="text-white font-medium">Creator Satisfaction</div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Bottom CTA */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="mt-8 md:mt-16 pb-6 md:pb-12 text-white relative z-10"
          >
            <p className="text-xl md:text-2xl font-bold mb-4">Ready to join the fun? 🚀</p>
            <Link
              to="/auth?mode=signup"
              className="px-10 py-4 bg-white text-purple-600 font-black text-xl rounded-full hover:bg-gray-100 transform hover:scale-105 transition-all duration-200 shadow-2xl cursor-pointer inline-block"
              style={{ pointerEvents: 'auto', position: 'relative', zIndex: 100 }}
            >
              Join Digis
            </Link>
          </motion.div>
        </div>
      </div>


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