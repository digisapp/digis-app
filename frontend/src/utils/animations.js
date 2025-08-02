// Advanced Animation Utilities for Digis Platform

export const easing = {
  // Natural motion curves
  easeInOut: [0.4, 0, 0.2, 1],
  easeOut: [0, 0, 0.2, 1],
  easeIn: [0.4, 0, 1, 1],
  
  // Bouncy animations
  bounce: [0.68, -0.6, 0.32, 1.6],
  elastic: [0.68, -0.55, 0.265, 1.55],
  
  // Smooth curves
  smooth: [0.25, 0.46, 0.45, 0.94],
  snappy: [0.215, 0.61, 0.355, 1]
};

export const durations = {
  instant: 0,
  fast: 0.15,
  normal: 0.3,
  slow: 0.5,
  slower: 0.8,
  slowest: 1.2
};

// Page transition animations
export const pageTransitions = {
  slideInRight: {
    initial: { opacity: 0, x: 100 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -100 },
    transition: { duration: durations.normal, ease: easing.easeInOut }
  },
  
  slideInLeft: {
    initial: { opacity: 0, x: -100 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 100 },
    transition: { duration: durations.normal, ease: easing.easeInOut }
  },
  
  slideUp: {
    initial: { opacity: 0, y: 30 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -30 },
    transition: { duration: durations.normal, ease: easing.easeOut }
  },
  
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: durations.fast }
  },
  
  scale: {
    initial: { opacity: 0, scale: 0.8 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.8 },
    transition: { duration: durations.normal, ease: easing.elastic }
  },
  
  flipY: {
    initial: { opacity: 0, rotateY: -90 },
    animate: { opacity: 1, rotateY: 0 },
    exit: { opacity: 0, rotateY: 90 },
    transition: { duration: durations.slow, ease: easing.easeOut }
  }
};

// List item animations
export const listAnimations = {
  stagger: {
    animate: {
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  },
  
  item: {
    initial: { opacity: 0, y: 20, scale: 0.9 },
    animate: { 
      opacity: 1, 
      y: 0, 
      scale: 1,
      transition: { duration: durations.normal, ease: easing.easeOut }
    },
    exit: { 
      opacity: 0, 
      y: -10, 
      scale: 0.9,
      transition: { duration: durations.fast }
    }
  },
  
  itemHover: {
    scale: 1.03,
    y: -2,
    transition: { duration: durations.fast, ease: easing.easeOut }
  },
  
  itemTap: {
    scale: 0.98,
    transition: { duration: 0.1 }
  }
};

// Button animations
export const buttonAnimations = {
  primary: {
    whileHover: {
      scale: 1.02,
      y: -1,
      boxShadow: "0 10px 25px rgba(0, 0, 0, 0.15)",
      transition: { duration: durations.fast, ease: easing.easeOut }
    },
    whileTap: {
      scale: 0.98,
      y: 0,
      transition: { duration: 0.1 }
    }
  },
  
  ghost: {
    whileHover: {
      backgroundColor: "rgba(255, 255, 255, 0.1)",
      transition: { duration: durations.fast }
    },
    whileTap: {
      scale: 0.95,
      transition: { duration: 0.1 }
    }
  },
  
  floating: {
    animate: {
      y: [-2, 2, -2],
      transition: {
        duration: 2,
        repeat: Infinity,
        ease: "easeInOut"
      }
    }
  },
  
  pulse: {
    animate: {
      scale: [1, 1.05, 1],
      transition: {
        duration: 1.5,
        repeat: Infinity,
        ease: "easeInOut"
      }
    }
  }
};

// Card animations
export const cardAnimations = {
  hover: {
    y: -8,
    scale: 1.02,
    rotateX: 5,
    boxShadow: "0 20px 40px rgba(0, 0, 0, 0.15)",
    transition: { duration: durations.normal, ease: easing.easeOut }
  },
  
  tap: {
    scale: 0.98,
    transition: { duration: 0.1 }
  },
  
  float: {
    animate: {
      y: [-5, 5, -5],
      rotateX: [-2, 2, -2],
      transition: {
        duration: 4,
        repeat: Infinity,
        ease: "easeInOut"
      }
    }
  },
  
  shimmer: {
    animate: {
      backgroundPosition: ['200% 0', '-200% 0'],
      transition: {
        duration: 2,
        repeat: Infinity,
        ease: "linear"
      }
    }
  }
};

// Modal animations
export const modalAnimations = {
  backdrop: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: durations.normal }
  },
  
  slideUp: {
    initial: { opacity: 0, y: 50, scale: 0.9 },
    animate: { 
      opacity: 1, 
      y: 0, 
      scale: 1,
      transition: { duration: durations.normal, ease: easing.easeOut }
    },
    exit: { 
      opacity: 0, 
      y: 30, 
      scale: 0.95,
      transition: { duration: durations.fast, ease: easing.easeIn }
    }
  },
  
  scale: {
    initial: { opacity: 0, scale: 0.5 },
    animate: { 
      opacity: 1, 
      scale: 1,
      transition: { duration: durations.normal, ease: easing.elastic }
    },
    exit: { 
      opacity: 0, 
      scale: 0.8,
      transition: { duration: durations.fast }
    }
  },
  
  flip: {
    initial: { opacity: 0, rotateY: -90 },
    animate: { 
      opacity: 1, 
      rotateY: 0,
      transition: { duration: durations.slow, ease: easing.easeOut }
    },
    exit: { 
      opacity: 0, 
      rotateY: 90,
      transition: { duration: durations.normal }
    }
  }
};

// Loading animations
export const loadingAnimations = {
  spinner: {
    animate: {
      rotate: 360,
      transition: {
        duration: 1,
        repeat: Infinity,
        ease: "linear"
      }
    }
  },
  
  dots: {
    animate: {
      scale: [1, 1.2, 1],
      opacity: [0.5, 1, 0.5],
      transition: {
        duration: 1,
        repeat: Infinity,
        ease: "easeInOut"
      }
    }
  },
  
  pulse: {
    animate: {
      opacity: [0.4, 1, 0.4],
      scale: [0.95, 1.05, 0.95],
      transition: {
        duration: 1.5,
        repeat: Infinity,
        ease: "easeInOut"
      }
    }
  },
  
  wave: {
    animate: {
      scaleY: [1, 1.5, 1],
      transition: {
        duration: 0.8,
        repeat: Infinity,
        ease: "easeInOut"
      }
    }
  }
};

// Notification animations
export const notificationAnimations = {
  slideInRight: {
    initial: { opacity: 0, x: 300, scale: 0.9 },
    animate: { 
      opacity: 1, 
      x: 0, 
      scale: 1,
      transition: { duration: durations.normal, ease: easing.easeOut }
    },
    exit: { 
      opacity: 0, 
      x: 300, 
      scale: 0.9,
      transition: { duration: durations.fast, ease: easing.easeIn }
    }
  },
  
  slideInTop: {
    initial: { opacity: 0, y: -100, scale: 0.9 },
    animate: { 
      opacity: 1, 
      y: 0, 
      scale: 1,
      transition: { duration: durations.normal, ease: easing.bounce }
    },
    exit: { 
      opacity: 0, 
      y: -100, 
      scale: 0.9,
      transition: { duration: durations.fast }
    }
  }
};

// Micro-interaction helpers
export const microInteractions = {
  // Hover glow effect
  glow: {
    whileHover: {
      boxShadow: "0 0 20px rgba(99, 102, 241, 0.4)",
      transition: { duration: durations.fast }
    }
  },
  
  // Magnetic effect
  magnetic: {
    whileHover: {
      scale: 1.05,
      transition: { 
        type: "spring", 
        stiffness: 300, 
        damping: 10 
      }
    }
  },
  
  // Shake on error
  shake: {
    animate: {
      x: [-2, 2, -2, 2, 0],
      transition: { duration: 0.4 }
    }
  },
  
  // Success bounce
  successBounce: {
    animate: {
      scale: [1, 1.1, 1],
      transition: { duration: 0.3, ease: easing.bounce }
    }
  },
  
  // Ripple effect
  ripple: {
    initial: { scale: 0, opacity: 1 },
    animate: { 
      scale: 4, 
      opacity: 0,
      transition: { duration: 0.6, ease: easing.easeOut }
    }
  }
};

// Utility function to create staggered animations
export const createStaggerAnimation = (delay = 0.1, children = 0.2) => ({
  animate: {
    transition: {
      staggerChildren: delay,
      delayChildren: children
    }
  }
});

// Utility function for scroll-triggered animations
export const scrollAnimations = {
  fadeInUp: {
    initial: { opacity: 0, y: 30 },
    whileInView: { opacity: 1, y: 0 },
    transition: { duration: durations.normal, ease: easing.easeOut },
    viewport: { once: true, margin: "-100px" }
  },
  
  fadeInLeft: {
    initial: { opacity: 0, x: -30 },
    whileInView: { opacity: 1, x: 0 },
    transition: { duration: durations.normal, ease: easing.easeOut },
    viewport: { once: true, margin: "-100px" }
  },
  
  fadeInRight: {
    initial: { opacity: 0, x: 30 },
    whileInView: { opacity: 1, x: 0 },
    transition: { duration: durations.normal, ease: easing.easeOut },
    viewport: { once: true, margin: "-100px" }
  },
  
  scaleIn: {
    initial: { opacity: 0, scale: 0.8 },
    whileInView: { opacity: 1, scale: 1 },
    transition: { duration: durations.normal, ease: easing.easeOut },
    viewport: { once: true, margin: "-100px" }
  }
};