// Modern UI Utilities for Next-Level UX

// Haptic Feedback
export const haptic = {
  light: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }
  },
  medium: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(20);
    }
  },
  heavy: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(30);
    }
  },
  success: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate([10, 10, 20]);
    }
  },
  error: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate([20, 10, 20, 10, 20]);
    }
  }
};

// Sound Effects
const audioCache = new Map();

export const playSound = async (soundType) => {
  const sounds = {
    success: '/sounds/success.mp3',
    error: '/sounds/error.mp3',
    notification: '/sounds/notification.mp3',
    click: '/sounds/click.mp3',
    coin: '/sounds/coin.mp3',
    message: '/sounds/message.mp3',
    like: '/sounds/like.mp3',
  };

  try {
    const soundUrl = sounds[soundType];
    if (!soundUrl) return;

    let audio = audioCache.get(soundType);
    if (!audio) {
      audio = new Audio(soundUrl);
      audio.volume = 0.3;
      audioCache.set(soundType, audio);
    }

    // Clone audio to allow multiple simultaneous plays
    const audioClone = audio.cloneNode();
    audioClone.volume = 0.3;
    await audioClone.play();
  } catch (error) {
    console.log('Sound playback failed:', error);
  }
};

// Confetti Animation
export const confetti = async (options = {}) => {
  const { x = 0.5, y = 0.5, spread = 45, particleCount = 100 } = options;
  
  // Dynamic import for performance
  const { default: confettiLib } = await import('canvas-confetti');
  
  confettiLib({
    particleCount,
    spread,
    origin: { x, y },
    colors: ['#6366f1', '#a855f7', '#ec4899', '#f59e0b'],
  });
};

// View Transition API
export const viewTransition = (callback) => {
  if (!document.startViewTransition) {
    callback();
    return;
  }
  
  document.startViewTransition(() => {
    callback();
  });
};

// Reduced Motion Check
export const prefersReducedMotion = () => {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

// Progressive Image Loading
export class ProgressiveImage {
  constructor(lowQualitySrc, highQualitySrc) {
    this.lowQualitySrc = lowQualitySrc;
    this.highQualitySrc = highQualitySrc;
  }

  load() {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = this.highQualitySrc;
      
      img.onload = () => resolve(this.highQualitySrc);
      img.onerror = reject;
    });
  }
}

// Modern Scroll Lock
export const scrollLock = {
  enable: () => {
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.paddingRight = `${scrollbarWidth}px`;
    document.body.style.overflow = 'hidden';
  },
  disable: () => {
    document.body.style.paddingRight = '';
    document.body.style.overflow = '';
  }
};

// Copy to Clipboard with Feedback
export const copyToClipboard = async (text, options = {}) => {
  const { showToast = true, hapticFeedback = true } = options;
  
  try {
    await navigator.clipboard.writeText(text);
    
    if (hapticFeedback) haptic.light();
    if (showToast) {
      // You can integrate with your toast system
      console.log('Copied to clipboard!');
    }
    
    return true;
  } catch (error) {
    console.error('Failed to copy:', error);
    return false;
  }
};

// Modern Intersection Observer Hook Factory
export const createIntersectionObserver = (callback, options = {}) => {
  const defaultOptions = {
    root: null,
    rootMargin: '50px',
    threshold: 0.1,
    ...options
  };

  return new IntersectionObserver(callback, defaultOptions);
};

// Performance Mark
export const perfMark = {
  start: (name) => {
    if (performance.mark) {
      performance.mark(`${name}-start`);
    }
  },
  end: (name) => {
    if (performance.mark && performance.measure) {
      performance.mark(`${name}-end`);
      performance.measure(name, `${name}-start`, `${name}-end`);
      
      const measure = performance.getEntriesByName(name)[0];
      console.log(`⚡ ${name}: ${measure.duration.toFixed(2)}ms`);
    }
  }
};

// Device Detection
export const device = {
  isMobile: () => /iPhone|iPad|iPod|Android/i.test(navigator.userAgent),
  isIOS: () => /iPhone|iPad|iPod/i.test(navigator.userAgent),
  isAndroid: () => /Android/i.test(navigator.userAgent),
  isTouchDevice: () => 'ontouchstart' in window || navigator.maxTouchPoints > 0,
  isStandalone: () => window.matchMedia('(display-mode: standalone)').matches,
};

// Modern Animation Controller
export class AnimationController {
  constructor() {
    this.animations = new Map();
  }

  register(name, animation) {
    this.animations.set(name, animation);
  }

  play(name) {
    const animation = this.animations.get(name);
    if (animation && !prefersReducedMotion()) {
      animation.play();
    }
  }

  playAll() {
    if (prefersReducedMotion()) return;
    
    this.animations.forEach(animation => {
      animation.play();
    });
  }

  pauseAll() {
    this.animations.forEach(animation => {
      animation.pause();
    });
  }
}