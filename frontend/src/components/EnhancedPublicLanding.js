import React, { useState, useEffect } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { 
  StarIcon,
  PlayIcon,
  UserGroupIcon,
  ChatBubbleLeftRightIcon,
  VideoCameraIcon,
  SparklesIcon,
  BoltIcon,
  HeartIcon,
  CurrencyDollarIcon,
  ShieldCheckIcon,
  GlobeAltIcon,
  ArrowRightIcon,
  CheckIcon
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';

const EnhancedPublicLanding = ({ onSignIn, onSignUp }) => {
  const [isVisible, setIsVisible] = useState(false);
  const { scrollY } = useScroll();
  const y1 = useTransform(scrollY, [0, 300], [0, 50]);
  const y2 = useTransform(scrollY, [0, 300], [0, -50]);
  const opacity = useTransform(scrollY, [0, 300], [1, 0.3]);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: 0.8,
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { 
        duration: 0.6,
        ease: "easeOut"
      }
    }
  };

  const floatingAnimation = {
    y: [0, -20, 0],
    transition: {
      duration: 3,
      repeat: Infinity,
      ease: "easeInOut"
    }
  };

  const features = [
    {
      title: 'HD Video Calls',
      description: 'Crystal clear 1080p video quality for immersive one-on-one experiences',
      icon: VideoCameraIcon,
      gradient: 'from-blue-500 to-cyan-500',
      shadowColor: 'shadow-blue-500/50'
    },
    {
      title: 'Live Streaming',
      description: 'Watch exclusive live content and interact in real-time',
      icon: PlayIcon,
      gradient: 'from-purple-500 to-pink-500',
      shadowColor: 'shadow-purple-500/50'
    },
    {
      title: 'Voice Calls',
      description: 'Private voice conversations with your favorite creators',
      icon: ChatBubbleLeftRightIcon,
      gradient: 'from-pink-500 to-rose-500',
      shadowColor: 'shadow-pink-500/50'
    },
    {
      title: 'Token Economy',
      description: 'Transparent, secure payments with our token system',
      icon: CurrencyDollarIcon,
      gradient: 'from-yellow-500 to-orange-500',
      shadowColor: 'shadow-yellow-500/50'
    },
    {
      title: 'Safe & Secure',
      description: 'Bank-level security to protect your privacy and transactions',
      icon: ShieldCheckIcon,
      gradient: 'from-green-500 to-emerald-500',
      shadowColor: 'shadow-green-500/50'
    },
    {
      title: 'Global Creators',
      description: 'Connect with creators from around the world',
      icon: GlobeAltIcon,
      gradient: 'from-indigo-500 to-purple-500',
      shadowColor: 'shadow-indigo-500/50'
    }
  ];

  const testimonials = [
    {
      name: "Sarah M.",
      role: "Fan",
      content: "The video quality is amazing! I feel like I'm having a real conversation with my favorite creators.",
      rating: 5,
      avatar: "https://ui-avatars.com/api/?name=Sarah+M&background=7c3aed&color=fff"
    },
    {
      name: "Alex K.",
      role: "Creator",
      content: "Digis has transformed how I connect with my audience. The platform is intuitive and the payouts are instant!",
      rating: 5,
      avatar: "https://ui-avatars.com/api/?name=Alex+K&background=ec4899&color=fff"
    },
    {
      name: "Jamie L.",
      role: "Fan",
      content: "I love the token system - it's transparent and I always know exactly what I'm spending.",
      rating: 5,
      avatar: "https://ui-avatars.com/api/?name=Jamie+L&background=3b82f6&color=fff"
    }
  ];

  const pricingTiers = [
    {
      name: "Starter",
      tokens: 100,
      price: "$4.99",
      popular: false,
      features: ["100 Tokens", "Basic Support", "HD Video Quality"]
    },
    {
      name: "Popular",
      tokens: 500,
      price: "$19.99",
      popular: true,
      features: ["500 Tokens", "Priority Support", "HD Video Quality", "5% Bonus Tokens"]
    },
    {
      name: "Premium",
      tokens: 1000,
      price: "$39.99",
      popular: false,
      features: ["1000 Tokens", "VIP Support", "HD Video Quality", "10% Bonus Tokens", "Exclusive Access"]
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white overflow-hidden">
      {/* Animated Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div 
          className="absolute top-20 left-10 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20"
          animate={{
            x: [0, 100, 0],
            y: [0, -100, 0],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "linear"
          }}
        />
        <motion.div 
          className="absolute bottom-20 right-10 w-96 h-96 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20"
          animate={{
            x: [0, -100, 0],
            y: [0, 100, 0],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: "linear"
          }}
        />
        <motion.div 
          className="absolute top-1/2 left-1/2 w-64 h-64 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20"
          animate={{
            x: [-50, 50, -50],
            y: [-50, 50, -50],
          }}
          transition={{
            duration: 30,
            repeat: Infinity,
            ease: "linear"
          }}
        />
      </div>

      {/* Navigation Header */}
      <motion.header 
        className="fixed top-0 left-0 right-0 z-50 bg-gray-900/80 backdrop-blur-lg border-b border-white/10"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <motion.div 
            className="flex items-center space-x-3"
            whileHover={{ scale: 1.05 }}
            transition={{ type: "spring", stiffness: 400 }}
          >
            <img src="/digis-logo-white.png" alt="Digis" className="h-10 w-auto" />
          </motion.div>
          
          <nav className="hidden md:flex items-center space-x-8">
            <a href="#features" className="hover:text-purple-400 transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-purple-400 transition-colors">How it Works</a>
            <a href="#pricing" className="hover:text-purple-400 transition-colors">Pricing</a>
            <a href="#testimonials" className="hover:text-purple-400 transition-colors">Reviews</a>
          </nav>

          <div className="flex items-center space-x-4">
            <motion.button
              onClick={onSignIn}
              className="px-6 py-2 text-white hover:text-purple-400 transition-colors"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Sign In
            </motion.button>
            <motion.button
              onClick={onSignUp}
              className="px-6 py-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full font-semibold shadow-lg hover:shadow-purple-500/50 transition-all"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Get Started
            </motion.button>
          </div>
        </div>
      </motion.header>

      {/* Hero Section */}
      <motion.section 
        className="relative min-h-screen flex items-center justify-center px-6 pt-20"
        variants={containerVariants}
        initial="hidden"
        animate={isVisible ? "visible" : "hidden"}
      >
        <div className="container mx-auto text-center z-10">
          <motion.div variants={itemVariants}>
            <motion.div 
              className="inline-flex items-center px-4 py-2 bg-purple-500/20 backdrop-blur-sm rounded-full border border-purple-500/50 mb-8"
              animate={floatingAnimation}
            >
              <SparklesIcon className="w-5 h-5 mr-2 text-purple-400" />
              <span className="text-purple-300 font-medium">Join 50,000+ fans connecting with creators</span>
            </motion.div>
          </motion.div>

          <motion.h1 
            className="text-5xl md:text-7xl font-bold mb-6"
            variants={itemVariants}
          >
            <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
              Connect With Your
            </span>
            <br />
            <span className="bg-gradient-to-r from-pink-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Favorite Creators
            </span>
          </motion.h1>

          <motion.p 
            className="text-xl md:text-2xl text-gray-300 mb-12 max-w-3xl mx-auto"
            variants={itemVariants}
          >
            Experience exclusive video calls, voice chats, and live streams. 
            Build meaningful connections in a safe, token-based economy.
          </motion.p>

          <motion.div 
            className="flex flex-col sm:flex-row gap-4 justify-center mb-16"
            variants={itemVariants}
          >
            <motion.button
              onClick={onSignUp}
              className="px-8 py-4 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full font-bold text-lg shadow-2xl hover:shadow-purple-500/50 transition-all flex items-center justify-center"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Start Free Today
              <ArrowRightIcon className="w-5 h-5 ml-2" />
            </motion.button>
            
            <motion.button
              className="px-8 py-4 bg-white/10 backdrop-blur-sm rounded-full font-bold text-lg border border-white/20 hover:bg-white/20 transition-all flex items-center justify-center"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <PlayIcon className="w-5 h-5 mr-2" />
              Watch Demo
            </motion.button>
          </motion.div>

          {/* Trust Indicators */}
          <motion.div 
            className="flex flex-wrap justify-center gap-8 text-gray-400"
            variants={itemVariants}
          >
            <div className="flex items-center">
              <ShieldCheckIcon className="w-5 h-5 mr-2 text-green-400" />
              <span>Bank-level Security</span>
            </div>
            <div className="flex items-center">
              <BoltIcon className="w-5 h-5 mr-2 text-yellow-400" />
              <span>Instant Payouts</span>
            </div>
            <div className="flex items-center">
              <HeartIcon className="w-5 h-5 mr-2 text-pink-400" />
              <span>50K+ Happy Users</span>
            </div>
          </motion.div>
        </div>

        {/* Hero Image/Animation */}
        <motion.div 
          className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-full max-w-6xl"
          style={{ y: y1, opacity }}
        >
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-t from-gray-900 to-transparent z-10" />
            <img 
              src="/digis-coin.png" 
              alt="Digis Platform" 
              className="w-32 h-32 mx-auto opacity-20"
            />
          </div>
        </motion.div>
      </motion.section>

      {/* Features Section */}
      <section id="features" className="py-20 px-6 relative z-10">
        <div className="container mx-auto">
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                Everything You Need
              </span>
            </h2>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
              Connect with creators through our feature-rich platform designed for meaningful interactions
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                className="relative group"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all opacity-0 group-hover:opacity-100" />
                <div className="relative bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-white/10 hover:border-purple-500/50 transition-all h-full">
                  <div className={`w-16 h-16 bg-gradient-to-r ${feature.gradient} rounded-xl flex items-center justify-center mb-6 ${feature.shadowColor} shadow-lg`}>
                    <feature.icon className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold mb-3">{feature.title}</h3>
                  <p className="text-gray-400">{feature.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20 px-6 relative z-10 bg-gray-900/50">
        <div className="container mx-auto">
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                How It Works
              </span>
            </h2>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
              Get started in just 3 simple steps
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              {
                step: "01",
                title: "Sign Up",
                description: "Create your free account in seconds",
                icon: UserGroupIcon
              },
              {
                step: "02",
                title: "Buy Tokens",
                description: "Purchase tokens securely with any payment method",
                icon: CurrencyDollarIcon
              },
              {
                step: "03",
                title: "Connect",
                description: "Start video calls and chats with creators",
                icon: VideoCameraIcon
              }
            ].map((item, index) => (
              <motion.div
                key={index}
                className="text-center"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.2 }}
              >
                <div className="relative mb-6">
                  <div className="w-24 h-24 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto">
                    <item.icon className="w-12 h-12 text-white" />
                  </div>
                  <div className="absolute -top-4 -right-4 w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center border-4 border-gray-900 font-bold text-purple-400">
                    {item.step}
                  </div>
                </div>
                <h3 className="text-2xl font-bold mb-3">{item.title}</h3>
                <p className="text-gray-400">{item.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-6 relative z-10">
        <div className="container mx-auto">
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                Simple, Transparent Pricing
              </span>
            </h2>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
              Choose the token package that works best for you
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {pricingTiers.map((tier, index) => (
              <motion.div
                key={index}
                className={`relative ${tier.popular ? 'scale-105' : ''}`}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
              >
                {tier.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full text-sm font-bold">
                    MOST POPULAR
                  </div>
                )}
                <div className={`bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border ${tier.popular ? 'border-purple-500' : 'border-white/10'} hover:border-purple-500/50 transition-all h-full`}>
                  <h3 className="text-2xl font-bold mb-2">{tier.name}</h3>
                  <div className="flex items-baseline mb-6">
                    <span className="text-4xl font-bold">{tier.price}</span>
                    <span className="text-gray-400 ml-2">/ {tier.tokens} tokens</span>
                  </div>
                  <ul className="space-y-3 mb-8">
                    {tier.features.map((feature, i) => (
                      <li key={i} className="flex items-center">
                        <CheckIcon className="w-5 h-5 text-green-400 mr-3 flex-shrink-0" />
                        <span className="text-gray-300">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <motion.button
                    onClick={onSignUp}
                    className={`w-full py-3 rounded-full font-bold transition-all ${
                      tier.popular 
                        ? 'bg-gradient-to-r from-purple-500 to-pink-500 shadow-lg hover:shadow-purple-500/50' 
                        : 'bg-white/10 hover:bg-white/20 border border-white/20'
                    }`}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Get Started
                  </motion.button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-20 px-6 relative z-10 bg-gray-900/50">
        <div className="container mx-auto">
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                Loved by Thousands
              </span>
            </h2>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
              See what our community is saying about Digis
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {testimonials.map((testimonial, index) => (
              <motion.div
                key={index}
                className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-white/10 hover:border-purple-500/50 transition-all"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
              >
                <div className="flex mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <StarIconSolid key={i} className="w-5 h-5 text-yellow-400" />
                  ))}
                </div>
                <p className="text-gray-300 mb-6 italic">"{testimonial.content}"</p>
                <div className="flex items-center">
                  <img 
                    src={testimonial.avatar} 
                    alt={testimonial.name} 
                    className="w-12 h-12 rounded-full mr-4"
                  />
                  <div>
                    <h4 className="font-bold">{testimonial.name}</h4>
                    <p className="text-gray-400 text-sm">{testimonial.role}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-20 px-6 relative z-10">
        <motion.div 
          className="container mx-auto text-center"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="max-w-4xl mx-auto bg-gradient-to-r from-purple-500/20 to-pink-500/20 backdrop-blur-sm rounded-3xl p-12 border border-purple-500/50">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                Ready to Get Started?
              </span>
            </h2>
            <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
              Join thousands of fans connecting with their favorite creators every day
            </p>
            <motion.button
              onClick={onSignUp}
              className="px-10 py-4 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full font-bold text-lg shadow-2xl hover:shadow-purple-500/50 transition-all inline-flex items-center"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Create Free Account
              <ArrowRightIcon className="w-5 h-5 ml-2" />
            </motion.button>
            <p className="text-gray-400 mt-4">No credit card required</p>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-white/10">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center mb-4 md:mb-0">
              <img src="/digis-logo-white.png" alt="Digis" className="h-8 w-auto" />
            </div>
            <p className="text-gray-400 text-sm">
              © 2024 Digis. All rights reserved. Made with ❤️ for creators and fans.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default EnhancedPublicLanding;