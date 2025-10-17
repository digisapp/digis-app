import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

/**
 * LiquidGlass Component
 *
 * Implements Telegram-style "Liquid Glass" effect with:
 * - Translucent backdrop blur
 * - Subtle refraction on scroll
 * - Light/white aesthetic
 * - Performance-optimized
 */

const LiquidGlass = ({
  children,
  className = '',
  intensity = 'medium', // 'light' | 'medium' | 'strong'
  enableRefraction = true,
  enableGlow = false,
  style = {},
  ...props
}) => {
  const [scrollY, setScrollY] = useState(0);
  const containerRef = useRef(null);

  // Intensity presets
  const intensityConfig = {
    light: {
      blur: 12,
      saturation: 120,
      opacity: 0.6,
    },
    medium: {
      blur: 20,
      saturation: 180,
      opacity: 0.7,
    },
    strong: {
      blur: 30,
      saturation: 200,
      opacity: 0.8,
    },
  };

  const config = intensityConfig[intensity] || intensityConfig.medium;

  // Scroll-based refraction effect (subtle)
  useEffect(() => {
    if (!enableRefraction) return;

    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      setScrollY(scrollPosition);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [enableRefraction]);

  // Calculate subtle hue rotation based on scroll (max ±2deg for subtlety)
  const hueRotation = enableRefraction ? Math.sin(scrollY / 500) * 2 : 0;

  return (
    <motion.div
      ref={containerRef}
      className={`liquid-glass ${className}`}
      style={{
        position: 'relative',
        backdropFilter: `blur(${config.blur}px) saturate(${config.saturation}%)`,
        WebkitBackdropFilter: `blur(${config.blur}px) saturate(${config.saturation}%)`, // Safari
        backgroundColor: `rgba(255, 255, 255, ${config.opacity})`,
        border: '1px solid rgba(255, 255, 255, 0.3)',
        boxShadow: enableGlow
          ? '0 8px 32px 0 rgba(31, 38, 135, 0.15), inset 0 1px 1px 0 rgba(255, 255, 255, 0.4)'
          : '0 4px 16px 0 rgba(31, 38, 135, 0.1)',
        ...style,
      }}
      {...props}
    >
      {/* Subtle shimmer overlay */}
      {enableRefraction && (
        <div
          className="liquid-glass-shimmer"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0) 50%, rgba(255, 255, 255, 0.1) 100%)',
            filter: `hue-rotate(${hueRotation}deg)`,
            pointerEvents: 'none',
            transition: 'filter 0.3s ease-out',
          }}
        />
      )}

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        {children}
      </div>

      {/* CSS animations */}
      <style jsx>{`
        @keyframes shimmer {
          0%, 100% {
            opacity: 0.3;
          }
          50% {
            opacity: 0.6;
          }
        }

        .liquid-glass-shimmer {
          animation: shimmer 3s ease-in-out infinite;
        }

        /* Fallback for browsers without backdrop-filter support */
        @supports not (backdrop-filter: blur(1px)) {
          .liquid-glass {
            background-color: rgba(255, 255, 255, 0.95) !important;
          }
        }
      `}</style>
    </motion.div>
  );
};

/**
 * LiquidGlassNav - Specialized for navigation bars
 */
export const LiquidGlassNav = ({ children, position = 'bottom', className = '', ...props }) => {
  const positionStyles = {
    bottom: {
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      borderRadius: '24px 24px 0 0',
      borderTop: '1px solid rgba(255, 255, 255, 0.3)',
      borderBottom: 'none',
      paddingBottom: 'env(safe-area-inset-bottom, 0px)', // iOS safe area
    },
    top: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      borderRadius: '0 0 24px 24px',
      borderBottom: '1px solid rgba(255, 255, 255, 0.3)',
      borderTop: 'none',
      paddingTop: 'env(safe-area-inset-top, 0px)',
    },
    left: {
      position: 'fixed',
      top: 0,
      bottom: 0,
      left: 0,
      borderRadius: '0 24px 24px 0',
      borderRight: '1px solid rgba(255, 255, 255, 0.3)',
      borderLeft: 'none',
    },
    right: {
      position: 'fixed',
      top: 0,
      bottom: 0,
      right: 0,
      borderRadius: '24px 0 0 24px',
      borderLeft: '1px solid rgba(255, 255, 255, 0.3)',
      borderRight: 'none',
    },
  };

  return (
    <LiquidGlass
      className={`liquid-glass-nav ${className}`}
      intensity="medium"
      enableRefraction={true}
      style={positionStyles[position]}
      {...props}
    >
      {children}
    </LiquidGlass>
  );
};

/**
 * LiquidGlassModal - Specialized for modals and panels
 */
export const LiquidGlassModal = ({ children, className = '', ...props }) => {
  return (
    <LiquidGlass
      className={`liquid-glass-modal ${className}`}
      intensity="medium"
      enableRefraction={true}
      enableGlow={true}
      style={{
        borderRadius: '24px',
        padding: '24px',
      }}
      {...props}
    >
      {children}
    </LiquidGlass>
  );
};

export default LiquidGlass;
