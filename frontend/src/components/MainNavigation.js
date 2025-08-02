import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  HomeIcon,
  ChatBubbleLeftRightIcon,
  UserCircleIcon,
  VideoCameraSlashIcon,
  Bars3Icon,
  XMarkIcon,
  ShoppingBagIcon,
  CurrencyDollarIcon,
  AcademicCapIcon,
  TvIcon
} from '@heroicons/react/24/outline';

const MainNavigation = ({ user, isCreator, isAdmin, tokenBalance, onGoLive, currentView, setCurrentView }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path);

  const navigationItems = isCreator ? [
    // Creator navigation order
    { 
      view: 'dashboard', 
      icon: HomeIcon, 
      label: 'Dashboard',
      active: currentView === 'dashboard'
    },
    { 
      view: 'messages', 
      icon: ChatBubbleLeftRightIcon, 
      label: 'Messages',
      active: currentView === 'messages'
    },
    { 
      view: 'classes', 
      icon: AcademicCapIcon, 
      label: 'Classes',
      active: currentView === 'classes'
    },
    { 
      view: 'tv', 
      icon: TvIcon, 
      label: 'TV',
      active: currentView === 'tv'
    },
    { 
      view: 'explore', 
      icon: HomeIcon, 
      label: 'Explore',
      active: currentView === 'explore'
    }
  ] : [
    // Fan navigation order: TV, Explore, Messages, Classes
    { 
      view: 'tv', 
      icon: TvIcon, 
      label: 'TV',
      active: currentView === 'tv'
    },
    { 
      view: 'explore', 
      icon: HomeIcon, 
      label: 'Explore',
      active: currentView === 'explore'
    },
    { 
      view: 'messages', 
      icon: ChatBubbleLeftRightIcon, 
      label: 'Messages',
      active: currentView === 'messages'
    },
    { 
      view: 'classes', 
      icon: AcademicCapIcon, 
      label: 'Classes',
      active: currentView === 'classes'
    }
  ];

  const quickActions = [
    {
      icon: VideoCameraSlashIcon,
      label: 'Go Live',
      action: onGoLive,
      show: isCreator
    }
  ];

  if (isMobile) {
    return (
      <>
        {/* Mobile Header */}
        <header className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-lg border-b border-gray-200 z-40">
          <div className="px-4 py-3 flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <img 
                src="/digis-logo-black.png" 
                alt="Digis" 
                className="h-8 w-auto"
              />
            </div>

            {/* Token Balance & Profile */}
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setCurrentView('wallet')}
                className="flex items-center gap-2 bg-gradient-to-r from-purple-100 to-pink-100 px-3 py-2 rounded-full"
              >
                <span className="text-sm font-medium text-purple-700">
                  {tokenBalance?.toLocaleString() || 0} tokens
                </span>
              </button>
              <button
                onClick={() => setCurrentView('profile')}
                className="p-2 rounded-full hover:bg-gray-100 transition-colors"
              >
                <UserCircleIcon className="w-6 h-6 text-gray-600" />
              </button>
            </div>

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2"
            >
              {isMobileMenuOpen ? (
                <XMarkIcon className="w-6 h-6" />
              ) : (
                <Bars3Icon className="w-6 h-6" />
              )}
            </button>
          </div>
        </header>

        {/* Mobile Menu Overlay */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setIsMobileMenuOpen(false)}>
            <div className="fixed top-16 right-0 w-64 bg-white h-full p-4">
              {/* Quick Actions */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-500 mb-3">Quick Actions</h3>
                <div className="space-y-2">
                  {quickActions.filter(action => action.show).map((action, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        action.action?.();
                        setIsMobileMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50"
                    >
                      <action.icon className="w-5 h-5 text-gray-600" />
                      <span>{action.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Mobile Bottom Navigation */}
        <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t border-gray-200 z-40">
          <div className="flex items-center justify-around py-3">
            {navigationItems.map((item) => (
              <button
                key={item.view}
                onClick={() => setCurrentView(item.view)}
                className={`flex flex-col items-center gap-1 py-2 px-3 rounded-lg transition-colors ${
                  item.active
                    ? 'text-purple-600 bg-purple-50'
                    : 'text-gray-600 hover:text-purple-600'
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span className="text-xs font-medium">{item.label}</span>
              </button>
            ))}
          </div>
        </nav>
      </>
    );
  }

  // Desktop Navigation
  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-lg border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Left: Logo + Quick Actions */}
          <div className="flex items-center gap-8">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <img 
                src="/digis-logo-black.png" 
                alt="Digis" 
                className="h-8 w-auto"
              />
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-3">
              {quickActions.filter(action => action.show).map((action, index) => (
                <button
                  key={index}
                  onClick={action.action}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all transform hover:scale-105"
                  title={action.label}
                >
                  <action.icon className="w-4 h-4" />
                  <span className="hidden sm:inline text-sm font-medium">{action.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Center: Main Navigation */}
          <nav className="flex items-center gap-2">
            {navigationItems.map((item) => (
              <button
                key={item.view}
                onClick={() => setCurrentView(item.view)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                  item.active
                    ? 'bg-purple-100 text-purple-700 shadow-sm'
                    : 'text-gray-600 hover:text-purple-600 hover:bg-gray-50'
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </button>
            ))}
          </nav>

          {/* Right: Token Balance & Profile */}
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setCurrentView('wallet')}
              className="flex items-center gap-3 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 px-4 py-2 rounded-lg hover:from-purple-100 hover:to-pink-100 transition-all"
            >
              <CurrencyDollarIcon className="w-5 h-5 text-purple-600" />
              <div className="text-right">
                <div className="text-sm font-semibold text-purple-700">
                  {tokenBalance?.toLocaleString() || 0}
                </div>
                <div className="text-xs text-purple-500">tokens</div>
              </div>
            </button>
            <button
              onClick={() => setCurrentView('profile')}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-all"
            >
              <UserCircleIcon className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default MainNavigation;