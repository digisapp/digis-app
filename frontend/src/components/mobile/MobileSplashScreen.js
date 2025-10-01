import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

const MobileSplashScreen = () => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(timer);
          return 100;
        }
        return prev + 10;
      });
    }, 100);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="mobile-splash-screen">
      <motion.div
        className="mobile-splash-content"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <motion.div
          className="mobile-splash-logo"
          animate={{
            rotate: [0, 360],
            scale: [1, 1.1, 1]
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut'
          }}
        >
          <img src="/digis-logo-white.png" alt="Digis" className="w-32 h-32" />
        </motion.div>

        <motion.h1
          className="mobile-splash-title"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          Digis
        </motion.h1>

        <motion.p
          className="mobile-splash-subtitle"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          Connect with Creators
        </motion.p>

        <motion.div
          className="mobile-splash-progress"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
        >
          <div className="mobile-splash-progress-bar">
            <motion.div
              className="mobile-splash-progress-fill"
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </motion.div>

        <motion.div
          className="mobile-splash-dots"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
        >
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="mobile-splash-dot"
              animate={{
                scale: [1, 1.5, 1],
                opacity: [0.5, 1, 0.5]
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                delay: i * 0.2
              }}
            />
          ))}
        </motion.div>
      </motion.div>

      <style jsx>{`
        .mobile-splash-screen {
          position: fixed;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          z-index: 9999;
        }

        .mobile-splash-content {
          text-align: center;
          padding: 40px;
        }

        .mobile-splash-logo {
          display: flex;
          justify-content: center;
          margin-bottom: 30px;
        }

        .mobile-splash-title {
          font-size: 48px;
          font-weight: 800;
          color: white;
          margin-bottom: 10px;
          letter-spacing: -1px;
        }

        .mobile-splash-subtitle {
          font-size: 18px;
          color: rgba(255, 255, 255, 0.9);
          margin-bottom: 40px;
        }

        .mobile-splash-progress {
          max-width: 200px;
          margin: 0 auto 30px;
        }

        .mobile-splash-progress-bar {
          height: 4px;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 2px;
          overflow: hidden;
        }

        .mobile-splash-progress-fill {
          height: 100%;
          background: white;
          border-radius: 2px;
        }

        .mobile-splash-dots {
          display: flex;
          justify-content: center;
          gap: 8px;
        }

        .mobile-splash-dot {
          width: 8px;
          height: 8px;
          background: white;
          border-radius: 50%;
        }
      `}</style>
    </div>
  );
};

export default MobileSplashScreen;