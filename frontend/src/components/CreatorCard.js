// src/components/CreatorCard.js
import { motion } from 'framer-motion';
import { useState } from 'react';
import CreatorPresence from './ui/CreatorPresence';

// Enhanced Design System
const designTokens = {
  colors: {
    primary: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    accent: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    success: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    creator: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)'
  },
  shadows: {
    soft: '0 4px 20px rgba(0,0,0,0.08)',
    medium: '0 8px 30px rgba(0,0,0,0.12)',
    strong: '0 12px 40px rgba(0,0,0,0.15)'
  }
};

const CreatorCard = ({ creator, onJoinSession, disabled, showTipButton, onTip, onMessage }) => {
  const [isHovered, setIsHovered] = useState(false);

  const handleServiceClick = (serviceType) => {
    if (!disabled && onJoinSession) {
      onJoinSession(serviceType);
    }
  };

  const handleTipClick = (e) => {
    e.stopPropagation();
    if (onTip) {
      onTip(5); // Default tip amount
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 * (creator.id || 0) }}
      whileHover={{ y: -8, scale: 1.02 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      style={{
        background: 'rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        borderRadius: '24px',
        padding: '24px',
        boxShadow: isHovered ? designTokens.shadows.strong : designTokens.shadows.medium,
        transition: 'all 0.3s ease',
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Live Status Badge */}
      <div style={{
        position: 'absolute',
        top: '16px',
        right: '16px',
        background: 'linear-gradient(45deg, #ff6b6b, #ee5a24)',
        color: 'white',
        padding: '4px 12px',
        borderRadius: '20px',
        fontSize: '12px',
        fontWeight: 'bold',
        display: 'flex',
        alignItems: 'center',
        gap: '4px'
      }}>
        <div style={{
          width: '8px',
          height: '8px',
          background: '#fff',
          borderRadius: '50%',
          animation: 'pulse 2s infinite'
        }} />
        LIVE
      </div>

      {/* Profile Picture - Larger */}
      <div style={{
        textAlign: 'center',
        marginBottom: '20px'
      }}>
        <div style={{
          width: '120px',
          height: '120px',
          margin: '0 auto',
          borderRadius: '50%',
          background: designTokens.colors.creator,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '48px',
          fontWeight: 'bold',
          color: 'white',
          boxShadow: designTokens.shadows.medium,
          border: '4px solid rgba(255, 255, 255, 0.3)',
          overflow: 'hidden',
          position: 'relative'
        }}>
          {creator.profile_pic_url || creator.profilePicUrl ? (
            <img 
              src={creator.profile_pic_url || creator.profilePicUrl} 
              alt={creator.supabase_id || creator.username}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover'
              }}
            />
          ) : (
            (creator.supabase_id || creator.username || '?')[0]?.toUpperCase()
          )}
          
          {/* Online indicator */}
          <div style={{
            position: 'absolute',
            bottom: '8px',
            right: '8px'
          }}>
            <CreatorPresence 
              userId={creator.supabase_id || creator.id}
              size="lg"
            />
          </div>
        </div>
      </div>

      {/* Creator Info */}
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <h3 style={{
          fontSize: '20px',
          fontWeight: 'bold',
          color: '#1f2937',
          margin: '0 0 8px 0'
        }}>
          @{creator.supabase_id || creator.username}
        </h3>
        
        {/* Bio - One row only */}
        {(creator.bio || creator.bio) && (
          <p style={{
            color: '#6b7280',
            fontSize: '14px',
            margin: '0 0 16px 0',
            lineHeight: '1.4',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {creator.bio}
          </p>
        )}

        {/* Location */}
        {(creator.state || creator.country) && (
          <p style={{
            color: '#9ca3af',
            fontSize: '13px',
            margin: '0 0 12px 0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px'
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
            {[creator.state, creator.country].filter(Boolean).join(', ')}
          </p>
        )}

        {/* Skill Tags */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '6px',
          justifyContent: 'center',
          marginBottom: '16px'
        }}>
          <span style={{
            background: 'linear-gradient(45deg, #667eea, #764ba2)',
            color: 'white',
            padding: '4px 12px',
            borderRadius: '16px',
            fontSize: '12px',
            fontWeight: '600'
          }}>
            Creator
          </span>
          <span style={{
            background: 'linear-gradient(45deg, #4facfe, #00f2fe)',
            color: 'white',
            padding: '4px 12px',
            borderRadius: '16px',
            fontSize: '12px',
            fontWeight: '600'
          }}>
            {creator.totalSessions || 0} Sessions
          </span>
        </div>
      </div>

      {/* Pricing Grid with Words */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '12px',
        marginBottom: '20px'
      }}>
        <div 
          onClick={() => handleServiceClick('stream')}
          style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            padding: '16px',
            borderRadius: '16px',
            textAlign: 'center',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.6 : 1,
            transition: 'all 0.2s ease',
            fontSize: '13px',
            fontWeight: '700',
            boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)',
            border: '2px solid rgba(255, 255, 255, 0.3)',
            transform: isHovered ? 'translateY(-2px)' : 'translateY(0)'
          }}
        >
          <div style={{ fontSize: '24px', marginBottom: '4px' }}>📡</div>
          <div style={{ fontWeight: '800', letterSpacing: '0.5px' }}>Stream</div>
          <div style={{ fontSize: '16px', fontWeight: '900', marginTop: '4px' }}>
            ${creator.streamPrice || creator.price_per_min || 5}/min
          </div>
        </div>

        <div 
          onClick={() => handleServiceClick('video')}
          style={{
            background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            color: 'white',
            padding: '16px',
            borderRadius: '16px',
            textAlign: 'center',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.6 : 1,
            transition: 'all 0.2s ease',
            fontSize: '13px',
            fontWeight: '700',
            boxShadow: '0 4px 12px rgba(240, 147, 251, 0.4)',
            border: '2px solid rgba(255, 255, 255, 0.3)',
            transform: isHovered ? 'translateY(-2px)' : 'translateY(0)'
          }}
        >
          <div style={{ fontSize: '24px', marginBottom: '4px' }}>📹</div>
          <div style={{ fontWeight: '800', letterSpacing: '0.5px' }}>Video Call</div>
          <div style={{ fontSize: '16px', fontWeight: '900', marginTop: '4px' }}>
            ${creator.videoPrice || creator.price_per_min || 8}/min
          </div>
        </div>

        <div 
          onClick={() => handleServiceClick('voice')}
          style={{
            background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
            color: 'white',
            padding: '16px',
            borderRadius: '16px',
            textAlign: 'center',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.6 : 1,
            transition: 'all 0.2s ease',
            fontSize: '13px',
            fontWeight: '700',
            boxShadow: '0 4px 12px rgba(79, 172, 254, 0.4)',
            border: '2px solid rgba(255, 255, 255, 0.3)',
            transform: isHovered ? 'translateY(-2px)' : 'translateY(0)'
          }}
        >
          <div style={{ fontSize: '24px', marginBottom: '4px' }}>📱</div>
          <div style={{ fontWeight: '800', letterSpacing: '0.5px' }}>Voice Call</div>
          <div style={{ fontSize: '16px', fontWeight: '900', marginTop: '4px' }}>
            ${creator.voicePrice || creator.price_per_min || 6}/min
          </div>
        </div>

        <div 
          onClick={() => handleServiceClick('message')}
          style={{
            background: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
            color: '#1f2937',
            padding: '16px',
            borderRadius: '16px',
            textAlign: 'center',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.6 : 1,
            transition: 'all 0.2s ease',
            fontSize: '13px',
            fontWeight: '700',
            boxShadow: '0 4px 12px rgba(168, 237, 234, 0.4)',
            border: '2px solid rgba(255, 255, 255, 0.5)',
            transform: isHovered ? 'translateY(-2px)' : 'translateY(0)'
          }}
        >
          <div style={{ fontSize: '24px', marginBottom: '4px' }}>💬</div>
          <div style={{ fontWeight: '800', letterSpacing: '0.5px' }}>Messages</div>
          <div style={{ fontSize: '16px', fontWeight: '900', marginTop: '4px' }}>
            ${creator.messagePrice || creator.price_per_min || 2}/min
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div style={{
        display: 'flex',
        gap: '8px',
        justifyContent: 'center',
        flexWrap: 'wrap'
      }}>
        {showTipButton && (
          <button
            onClick={handleTipClick}
            disabled={disabled}
            style={{
              background: 'linear-gradient(45deg, #ffeaa7, #fdcb6e)',
              color: '#2d3436',
              border: 'none',
              padding: '10px 16px',
              borderRadius: '20px',
              fontSize: '13px',
              fontWeight: 'bold',
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.6 : 1,
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            💰 Tip
          </button>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (onMessage) {
              onMessage(creator);
            }
          }}
          disabled={disabled}
          style={{
            background: 'linear-gradient(45deg, #00d4ff, #0099cc)',
            color: 'white',
            border: 'none',
            padding: '10px 16px',
            borderRadius: '20px',
            fontSize: '13px',
            fontWeight: 'bold',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.6 : 1,
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          💬 Message
        </button>
        <button
          style={{
            background: 'rgba(255, 255, 255, 0.2)',
            color: '#1f2937',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            padding: '10px 16px',
            borderRadius: '20px',
            fontSize: '13px',
            fontWeight: 'bold',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          ❤️ Follow
        </button>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
      `}</style>
    </motion.div>
  );
};

export default CreatorCard;