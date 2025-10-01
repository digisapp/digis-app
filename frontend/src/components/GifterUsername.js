import React from 'react';

/**
 * GifterUsername Component
 * Displays username with color based on their gifter tier (lifetime tokens spent)
 * 
 * Medieval Nobility Tier System:
 * - Supporter (0-2,499): #5C4033 (Earthy Brown)
 * - Squire (2,500+): #008080 (Teal)
 * - Knight (10,000+): #B22222 (Firebrick Red)
 * - Baron (20,000+): #FFD700 (Golden Yellow)
 * - Count (50,000+): #4169E1 (Royal Blue)
 * - Duke (100,000+): #9B59B6 (Amethyst Purple)
 * - Crown (1,000,000+): #FF4500 (Orange Red)
 */

const GifterUsername = ({ 
  user, 
  className = '', 
  showTier = false, 
  onClick = null,
  style = {}
}) => {
  // Get tier color from user object or default to Supporter color
  const tierColor = user?.gifter_tier_color || '#5C4033';
  const tierName = user?.gifter_tier || 'Supporter';
  const username = user?.username || user?.display_name || 'User';
  
  // Build title text for hover
  const titleText = `${tierName === 'Supporter' ? '' : tierName + ' '}Gifter${user?.lifetime_tokens_spent ? ` • ${user.lifetime_tokens_spent.toLocaleString()} tokens spent` : ''}`;
  
  const usernameStyle = {
    color: tierColor,
    fontWeight: '500',
    cursor: onClick ? 'pointer' : 'default',
    ...style
  };
  
  return (
    <span 
      className={`gifter-username ${className}`}
      style={usernameStyle}
      title={titleText}
      onClick={onClick}
    >
      {showTier && tierName !== 'Supporter' && (
        <span className="tier-badge" style={{ color: tierColor, marginRight: '4px' }}>
          [{tierName}]
        </span>
      )}
      {username}
    </span>
  );
};

export default GifterUsername;