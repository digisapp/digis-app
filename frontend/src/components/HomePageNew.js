import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { RocketLaunchIcon } from '@heroicons/react/24/solid';

const HomePageNew = () => {
  const [logoFailed, setLogoFailed] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-400 via-purple-500 to-indigo-600">
      {/* Navigation */}
      <nav className="relative z-50 px-4 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center">
            {logoFailed ? (
              <span className="text-2xl font-black text-white">DIGIS</span>
            ) : (
              <img
                src="/digis-logo-white.png"
                alt="Digis"
                className="h-10 w-auto"
                onError={() => setLogoFailed(true)}
              />
            )}
          </Link>

          {/* Auth Buttons */}
          <div className="flex items-center gap-3">
            <Link
              to="/auth?mode=signin"
              className="px-6 py-2.5 bg-white/20 backdrop-blur-sm text-white font-bold rounded-full hover:bg-white/30 transition-colors"
            >
              Sign in
            </Link>
            <Link
              to="/auth?mode=signup"
              className="px-6 py-2.5 bg-white text-purple-600 font-bold rounded-full hover:bg-gray-100 transition-colors shadow-lg"
            >
              Sign Up
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Content */}
      <div className="relative px-4 py-12">
        <div className="max-w-6xl mx-auto text-center">
          {/* Headline */}
          <h1 className="text-5xl md:text-7xl font-black text-white mb-6 leading-tight">
            Connect with your
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-pink-300">
              favorite creators
            </span>
          </h1>

          <p className="text-xl md:text-2xl text-white/90 font-medium max-w-3xl mx-auto mb-8">
            Monetize with live streams, video and voice calls, content, and creator collabs.
          </p>

          {/* CTA Button */}
          <Link
            to="/auth?mode=signup"
            className="inline-flex items-center gap-2 px-10 py-4 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold text-xl rounded-full hover:from-pink-600 hover:to-purple-700 transition-all shadow-xl"
          >
            <RocketLaunchIcon className="h-6 w-6" />
            <span>Get Started Now</span>
          </Link>

          {/* Video Gallery */}
          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {/* Video 1 */}
            <div className="w-full max-w-sm mx-auto">
              <div className="bg-white/10 backdrop-blur-md rounded-3xl p-2 border border-white/20 shadow-2xl">
                <div className="relative rounded-2xl overflow-hidden aspect-[9/16] bg-gradient-to-br from-purple-600 to-pink-600">
                  <video
                    className="absolute inset-0 w-full h-full object-cover"
                    autoPlay
                    muted
                    loop
                    playsInline
                    poster="/digis-video-intro-poster.jpg"
                  >
                    <source src="/digis-video-intro.mp4" type="video/mp4" />
                    <source src="/digis-video-intro.mov" type="video/quicktime" />
                  </video>
                </div>
              </div>
            </div>

            {/* Video 2 */}
            <div className="w-full max-w-sm mx-auto">
              <div className="bg-white/10 backdrop-blur-md rounded-3xl p-2 border border-white/20 shadow-2xl">
                <div className="relative rounded-2xl overflow-hidden aspect-[9/16] bg-gradient-to-br from-yellow-500 to-orange-500">
                  <video
                    className="absolute inset-0 w-full h-full object-cover"
                    autoPlay
                    muted
                    loop
                    playsInline
                    poster="/digis-video-celebs-poster.jpg"
                  >
                    <source src="/digis-video-celebs.mp4" type="video/mp4" />
                    <source src="/digis-video-celebs.mov" type="video/quicktime" />
                  </video>
                </div>
              </div>
            </div>

            {/* Video 3 */}
            <div className="w-full max-w-sm mx-auto">
              <div className="bg-white/10 backdrop-blur-md rounded-3xl p-2 border border-white/20 shadow-2xl">
                <div className="relative rounded-2xl overflow-hidden aspect-[9/16] bg-gradient-to-br from-pink-500 to-purple-600">
                  <video
                    className="absolute inset-0 w-full h-full object-cover"
                    autoPlay
                    muted
                    loop
                    playsInline
                    poster="/digis-video-alix-poster.jpg"
                  >
                    <source src="/digis-video-alix.mp4" type="video/mp4" />
                    <source src="/digis-video-alix.mov" type="video/quicktime" />
                  </video>
                </div>
              </div>
            </div>
          </div>

          <p className="text-center text-white/80 mt-6 text-lg">
            Join thousands of creators building thriving communities on Digis
          </p>

          {/* Features */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-16 max-w-6xl mx-auto">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
              <h3 className="text-xl font-bold text-pink-300 mb-2">Streams & Video Calls</h3>
              <p className="text-white/80 text-sm">Go live, host co-streams with fellow creators, or offer private sessions.</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
              <h3 className="text-xl font-bold text-yellow-300 mb-2">Fan Chat</h3>
              <p className="text-white/80 text-sm">Build loyal connections with real time Chat Messaging!</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
              <h3 className="text-xl font-bold text-green-300 mb-2">Tips & Gifts</h3>
              <p className="text-white/80 text-sm">Earn from Streams, Classes, Content, and Messages.</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
              <h3 className="text-xl font-bold text-purple-300 mb-2">Classes</h3>
              <p className="text-white/80 text-sm">Host your Pilates Class or Online Coach your Students!</p>
            </div>
          </div>

          {/* Why Creators Love Digis */}
          <div className="max-w-5xl mx-auto mt-16">
            <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 border border-white/20">
              <h2 className="text-3xl font-black text-white mb-8 text-center">
                Why Creators Love Digis
              </h2>

              <div className="grid md:grid-cols-2 gap-6 mb-8">
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">💰</span>
                    <div>
                      <h3 className="text-lg font-bold text-white">Financially Independent</h3>
                      <p className="text-white/80 text-sm">Set your prices and get paid fast and reliably.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">🚀</span>
                    <div>
                      <h3 className="text-lg font-bold text-white">Discoverability</h3>
                      <p className="text-white/80 text-sm">Get organic exposure via Digis TV and Creator Explore Page.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">👩‍💼</span>
                    <div>
                      <h3 className="text-lg font-bold text-white">Empowering Tools</h3>
                      <p className="text-white/80 text-sm">Latest tools for Stream, Video and Calls, and Messaging designed for your success.</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">💬</span>
                    <div>
                      <h3 className="text-lg font-bold text-white">Direct Fan Connections</h3>
                      <p className="text-white/80 text-sm">Build genuine relationships with chats, gifts, and exclusive content.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">📈</span>
                    <div>
                      <h3 className="text-lg font-bold text-white">Proven Earnings</h3>
                      <p className="text-white/80 text-sm">Join creators earning monthly with our supportive community.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">✈️</span>
                    <div>
                      <h3 className="text-lg font-bold text-white">Travel</h3>
                      <p className="text-white/80 text-sm">Join Creator Experiences! Connect, Create, and Travel with Digis Creators!</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col md:flex-row items-center justify-center gap-12 pt-6 border-t border-white/20">
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
          </div>

          {/* Bottom CTA */}
          <div className="mt-16 pb-12">
            <p className="text-2xl font-bold text-white mb-4">Ready to join the fun? 🚀</p>
            <Link
              to="/auth?mode=signup"
              className="inline-block px-10 py-4 bg-white text-purple-600 font-black text-xl rounded-full hover:bg-gray-100 transition-colors shadow-2xl"
            >
              Join Digis
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePageNew;
