import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  PlayIcon, 
  PauseIcon, 
  XMarkIcon, 
  ArrowPathIcon,
  EyeSlashIcon,
  CogIcon
} from '@heroicons/react/24/outline';
import OnboardingTooltip from './OnboardingTooltip';

// Onboarding data structure
const onboardingSteps = {
  newUser: [
    {
      id: 'welcome',
      target: '[data-onboarding="logo"]',
      title: 'Welcome to Digis! 🎉',
      description: 'Connect with amazing creators through video calls, live streams, and personal interactions.',
      position: 'bottom',
      theme: 'info'
    },
    {
      id: 'discover',
      target: '[data-onboarding="discover"]',
      title: 'Discover Creators',
      description: 'Browse through thousands of creators across different categories. Find your favorites!',
      position: 'bottom',
      theme: 'default'
    },
    {
      id: 'tokens',
      target: '[data-onboarding="wallet"]',
      title: 'Token System 💰',
      description: 'Purchase tokens to interact with creators. Tokens are used for video calls, messages, and tips.',
      position: 'bottom',
      theme: 'success'
    },
    {
      id: 'messages',
      target: '[data-onboarding="messages"]',
      title: 'Stay Connected',
      description: 'Chat with creators, manage conversations, and never miss important messages.',
      position: 'bottom',
      theme: 'default'
    }
  ],
  creator: [
    {
      id: 'studio',
      target: '[data-onboarding="studio"]',
      title: 'Creator Studio 🎬',
      description: 'Access all your creator tools, analytics, and settings from your studio dashboard.',
      position: 'bottom',
      theme: 'info'
    },
    {
      id: 'go-live',
      target: '[data-onboarding="go-live"]',
      title: 'Go Live',
      description: 'Start live streams, set up video calls, and engage with your audience in real-time.',
      position: 'bottom',
      theme: 'success'
    },
    {
      id: 'analytics',
      target: '[data-onboarding="analytics"]',
      title: 'Track Performance',
      description: 'Monitor your earnings, session history, and fan engagement metrics.',
      position: 'bottom',
      theme: 'default'
    }
  ],
  tokenPurchase: [
    {
      id: 'packages',
      target: '[data-onboarding="token-packages"]',
      title: 'Choose Your Package',
      description: 'Select from different token packages. Larger packages offer better value!',
      position: 'left',
      theme: 'success'
    },
    {
      id: 'payment',
      target: '[data-onboarding="payment-form"]',
      title: 'Secure Payment',
      description: 'Your payment is processed securely through Stripe. We never store your card details.',
      position: 'top',
      theme: 'info'
    }
  ]
};

// Storage key for onboarding state
const ONBOARDING_STORAGE_KEY = 'digis_onboarding_state';

const OnboardingManager = ({ 
  user, 
  isCreator = false, 
  currentRoute = '/', 
  children,
  autoStart = true,
  showControls = true,
  onComplete,
  onSkip
}) => {
  const [isActive, setIsActive] = useState(false);
  const [currentFlow, setCurrentFlow] = useState(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [completedFlows, setCompletedFlows] = useState(new Set());
  const [isPaused, setIsPaused] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const observerRef = useRef(null);
  const highlightRef = useRef(null);

  // Load saved state
  useEffect(() => {
    try {
      const saved = localStorage.getItem(ONBOARDING_STORAGE_KEY);
      if (saved) {
        const state = JSON.parse(saved);
        setCompletedFlows(new Set(state.completedFlows || []));
      }
    } catch (error) {
      console.error('Error loading onboarding state:', error);
    }
  }, []);

  // Save state
  const saveState = useCallback((flows) => {
    try {
      localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify({
        completedFlows: Array.from(flows),
        lastUpdated: Date.now()
      }));
    } catch (error) {
      console.error('Error saving onboarding state:', error);
    }
  }, []);

  // Determine which flow to show
  const determineFlow = useCallback(() => {
    if (!user) return null;

    // Check route-specific flows first
    if (currentRoute.includes('/tokens') && !completedFlows.has('tokenPurchase')) {
      return 'tokenPurchase';
    }

    // Check user type flows
    if (isCreator && !completedFlows.has('creator')) {
      return 'creator';
    }

    if (!isCreator && !completedFlows.has('newUser')) {
      return 'newUser';
    }

    return null;
  }, [user, isCreator, currentRoute, completedFlows]);

  // Auto-start onboarding
  useEffect(() => {
    if (autoStart && user) {
      const flow = determineFlow();
      if (flow) {
        setTimeout(() => startOnboarding(flow), 1000); // Delay to ensure DOM is ready
      }
    }
  }, [user, isCreator, currentRoute, autoStart, determineFlow]);

  // Start onboarding flow
  const startOnboarding = useCallback((flowName) => {
    if (completedFlows.has(flowName)) return;

    const steps = onboardingSteps[flowName];
    if (!steps || steps.length === 0) return;

    setCurrentFlow(flowName);
    setCurrentStepIndex(0);
    setIsActive(true);
    setIsPaused(false);
  }, [completedFlows]);

  // Navigate steps
  const nextStep = useCallback(() => {
    const steps = onboardingSteps[currentFlow];
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      completeOnboarding();
    }
  }, [currentFlow, currentStepIndex]);

  const prevStep = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  }, [currentStepIndex]);

  // Complete onboarding
  const completeOnboarding = useCallback(() => {
    const newCompletedFlows = new Set(completedFlows);
    newCompletedFlows.add(currentFlow);
    setCompletedFlows(newCompletedFlows);
    saveState(newCompletedFlows);
    
    setIsActive(false);
    setCurrentFlow(null);
    setCurrentStepIndex(0);
    
    onComplete?.(currentFlow);
  }, [currentFlow, completedFlows, saveState, onComplete]);

  // Skip onboarding
  const skipOnboarding = useCallback(() => {
    const newCompletedFlows = new Set(completedFlows);
    newCompletedFlows.add(currentFlow);
    setCompletedFlows(newCompletedFlows);
    saveState(newCompletedFlows);
    
    setIsActive(false);
    setCurrentFlow(null);
    setCurrentStepIndex(0);
    
    onSkip?.(currentFlow);
  }, [currentFlow, completedFlows, saveState, onSkip]);

  // Reset onboarding (for testing/settings)
  const resetOnboarding = useCallback((flowName = null) => {
    if (flowName) {
      const newCompletedFlows = new Set(completedFlows);
      newCompletedFlows.delete(flowName);
      setCompletedFlows(newCompletedFlows);
      saveState(newCompletedFlows);
    } else {
      setCompletedFlows(new Set());
      localStorage.removeItem(ONBOARDING_STORAGE_KEY);
    }
    
    setIsActive(false);
    setCurrentFlow(null);
    setCurrentStepIndex(0);
  }, [completedFlows, saveState]);

  // Highlight target element
  useEffect(() => {
    if (!isActive || !currentFlow || isPaused) return;

    const steps = onboardingSteps[currentFlow];
    const currentStep = steps[currentStepIndex];
    
    if (currentStep) {
      const targetElement = document.querySelector(currentStep.target);
      
      if (targetElement) {
        // Add highlight class
        targetElement.classList.add('onboarding-highlight');
        
        // Scroll into view
        targetElement.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center',
          inline: 'center' 
        });

        // Create highlight overlay
        const rect = targetElement.getBoundingClientRect();
        const highlight = highlightRef.current;
        
        if (highlight) {
          highlight.style.top = `${rect.top + window.scrollY - 8}px`;
          highlight.style.left = `${rect.left + window.scrollX - 8}px`;
          highlight.style.width = `${rect.width + 16}px`;
          highlight.style.height = `${rect.height + 16}px`;
          highlight.style.display = 'block';
        }

        return () => {
          targetElement.classList.remove('onboarding-highlight');
          if (highlight) {
            highlight.style.display = 'none';
          }
        };
      }
    }
  }, [isActive, currentFlow, currentStepIndex, isPaused]);

  // Get current step data
  const getCurrentStep = () => {
    if (!currentFlow) return null;
    const steps = onboardingSteps[currentFlow];
    return steps[currentStepIndex];
  };

  const currentStep = getCurrentStep();

  // Control panel component
  const ControlPanel = () => (
    <AnimatePresence>
      {showControls && isActive && (
        <motion.div
          className="fixed bottom-6 right-6 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-4 z-[1001]"
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.9 }}
        >
          <div className="flex items-center gap-3">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Onboarding ({currentStepIndex + 1}/{onboardingSteps[currentFlow]?.length || 0})
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsPaused(!isPaused)}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title={isPaused ? 'Resume' : 'Pause'}
              >
                {isPaused ? <PlayIcon className="w-4 h-4" /> : <PauseIcon className="w-4 h-4" />}
              </button>
              
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title="Settings"
              >
                <CogIcon className="w-4 h-4" />
              </button>
              
              <button
                onClick={skipOnboarding}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title="Skip onboarding"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Settings Panel */}
          <AnimatePresence>
            {showSettings && (
              <motion.div
                className="absolute bottom-full right-0 mb-2 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-4 w-64"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
              >
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
                  Onboarding Settings
                </h3>
                
                <div className="space-y-3">
                  <button
                    onClick={() => resetOnboarding(currentFlow)}
                    className="w-full flex items-center gap-2 p-2 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <ArrowPathIcon className="w-4 h-4" />
                    Restart current flow
                  </button>
                  
                  <button
                    onClick={() => resetOnboarding()}
                    className="w-full flex items-center gap-2 p-2 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <EyeSlashIcon className="w-4 h-4" />
                    Reset all onboarding
                  </button>
                  
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Available flows:
                    </div>
                    {Object.keys(onboardingSteps).map(flowName => (
                      <button
                        key={flowName}
                        onClick={() => {
                          setShowSettings(false);
                          resetOnboarding(flowName);
                          startOnboarding(flowName);
                        }}
                        className="block w-full text-left text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 py-1"
                        disabled={completedFlows.has(flowName)}
                      >
                        {flowName} {completedFlows.has(flowName) ? '✓' : ''}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      {/* Highlight overlay */}
      <div
        ref={highlightRef}
        className="fixed pointer-events-none z-[999] rounded-lg border-2 border-blue-500 shadow-[0_0_0_4px_rgba(59,130,246,0.3)] animate-pulse"
        style={{ display: 'none' }}
      />

      {/* Backdrop overlay */}
      <AnimatePresence>
        {isActive && !isPaused && (
          <motion.div
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[998] pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
        )}
      </AnimatePresence>

      {/* Tooltip */}
      {isActive && currentStep && !isPaused && (
        <OnboardingTooltip
          isVisible={true}
          trigger="manual"
          step={currentStepIndex + 1}
          totalSteps={onboardingSteps[currentFlow]?.length || 0}
          title={currentStep.title}
          description={currentStep.description}
          position={currentStep.position}
          theme={currentStep.theme}
          onNext={nextStep}
          onPrev={prevStep}
          onSkip={skipOnboarding}
          onComplete={completeOnboarding}
        >
          <div className="hidden" />
        </OnboardingTooltip>
      )}

      {/* Control Panel */}
      <ControlPanel />

      {/* Children with onboarding data attributes */}
      {children}
    </>
  );
};

// Hook for using onboarding
export const useOnboarding = () => {
  const startFlow = (flowName) => {
    window.dispatchEvent(new CustomEvent('startOnboardingFlow', { detail: { flowName } }));
  };

  const addDataAttribute = (elementId, onboardingId) => {
    const element = document.getElementById(elementId);
    if (element) {
      element.setAttribute('data-onboarding', onboardingId);
    }
  };

  return {
    startFlow,
    addDataAttribute,
    flows: Object.keys(onboardingSteps)
  };
};

export default OnboardingManager;