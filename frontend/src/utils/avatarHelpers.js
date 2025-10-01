/**
 * Avatar Helper Functions
 * Generates better default avatars instead of question marks
 */

// Generate initials from a name
export const getInitials = (name) => {
  if (!name) return 'U';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};

// Generate a consistent color based on the name/id
export const getAvatarColor = (identifier) => {
  const colors = [
    'bg-gradient-to-br from-purple-400 to-purple-600',
    'bg-gradient-to-br from-blue-400 to-blue-600',
    'bg-gradient-to-br from-green-400 to-green-600',
    'bg-gradient-to-br from-pink-400 to-pink-600',
    'bg-gradient-to-br from-indigo-400 to-indigo-600',
    'bg-gradient-to-br from-red-400 to-red-600',
    'bg-gradient-to-br from-yellow-400 to-yellow-600',
    'bg-gradient-to-br from-teal-400 to-teal-600',
  ];
  
  if (!identifier) return colors[0];
  
  // Generate a hash from the identifier
  let hash = 0;
  for (let i = 0; i < identifier.length; i++) {
    hash = identifier.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Use the hash to pick a color
  const index = Math.abs(hash) % colors.length;
  return colors[index];
};

// Get SVG data URL for a default avatar
export const getDefaultAvatarUrl = (name, size = 100) => {
  const initials = getInitials(name);
  const colors = [
    ['#9333ea', '#c084fc'], // Purple
    ['#3b82f6', '#60a5fa'], // Blue
    ['#10b981', '#34d399'], // Green
    ['#ec4899', '#f472b6'], // Pink
    ['#6366f1', '#818cf8'], // Indigo
    ['#ef4444', '#f87171'], // Red
    ['#f59e0b', '#fbbf24'], // Yellow
    ['#14b8a6', '#2dd4bf'], // Teal
  ];
  
  // Generate consistent color index from name
  let hash = 0;
  const nameStr = name || 'User';
  for (let i = 0; i < nameStr.length; i++) {
    hash = nameStr.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colorIndex = Math.abs(hash) % colors.length;
  const [color1, color2] = colors[colorIndex];
  
  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${color1};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${color2};stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="${size}" height="${size}" fill="url(#grad)" />
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" 
            fill="white" font-family="system-ui, sans-serif" font-size="${size * 0.35}" 
            font-weight="600">
        ${initials}
      </text>
    </svg>
  `;
  
  return `data:image/svg+xml;base64,${btoa(svg)}`;
};

// React component for default avatar
export const DefaultAvatar = ({ name, className = '', size = 40 }) => {
  const initials = getInitials(name);
  const colorClass = getAvatarColor(name);
  
  return (
    <div 
      className={`${colorClass} ${className} flex items-center justify-center text-white font-semibold`}
      style={{ width: size, height: size }}
    >
      <span style={{ fontSize: size * 0.4 }}>{initials}</span>
    </div>
  );
};

// Helper to get avatar URL with fallback
export const getAvatarUrl = (user, size = 100) => {
  // If user has an avatar URL, return it
  if (user?.avatar_url || user?.avatarUrl || user?.profile_pic_url) {
    return user.avatar_url || user.avatarUrl || user.profile_pic_url;
  }
  
  // Generate default avatar from name or email
  const name = user?.name || user?.username || user?.email?.split('@')[0] || 'User';
  return getDefaultAvatarUrl(name, size);
};

export default {
  getInitials,
  getAvatarColor,
  getDefaultAvatarUrl,
  DefaultAvatar,
  getAvatarUrl
};