// Avatar Generator Utility
// Generates avatars locally without external dependencies

/**
 * Category color mappings for consistent theming
 */
const CATEGORY_COLORS = {
  'Fitness': { primary: '#FF6B6B', secondary: '#FF8E53' },
  'Wellness': { primary: '#10B981', secondary: '#34D399' },
  'Fashion': { primary: '#EC4899', secondary: '#F472B6' },
  'Business': { primary: '#3B82F6', secondary: '#60A5FA' },
  'Creative': { primary: '#8B5CF6', secondary: '#A78BFA' },
  'Cooking': { primary: '#F59E0B', secondary: '#FBBF24' },
  'Tech': { primary: '#06B6D4', secondary: '#22D3EE' },
  'Music': { primary: '#8B5CF6', secondary: '#A855F7' },
  'Gaming': { primary: '#6366F1', secondary: '#818CF8' },
  'Education': { primary: '#10B981', secondary: '#34D399' },
  'Entertainment': { primary: '#F43F5E', secondary: '#FB7185' },
  'Lifestyle': { primary: '#F59E0B', secondary: '#FCD34D' },
  'Sports': { primary: '#EF4444', secondary: '#F87171' },
  'Travel': { primary: '#0EA5E9', secondary: '#38BDF8' },
  'Beauty': { primary: '#F472B6', secondary: '#F9A8D4' },
  'Art': { primary: '#6366F1', secondary: '#818CF8' },
  'Photography': { primary: '#6B7280', secondary: '#9CA3AF' },
  'Dance': { primary: '#D946EF', secondary: '#E879F9' },
  'Comedy': { primary: '#FCD34D', secondary: '#FDE047' },
  'Other': { primary: '#6B7280', secondary: '#9CA3AF' },
  'default': { primary: '#14B8A6', secondary: '#2DD4BF' }
};

/**
 * Generate initials from username or full name
 */
function getInitials(name) {
  if (!name) return '?';
  
  const cleaned = name.trim();
  const parts = cleaned.split(/[\s_-]+/);
  
  if (parts.length > 1) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  
  return cleaned.slice(0, 2).toUpperCase();
}

/**
 * Generate a deterministic color based on username
 * This ensures the same user always gets the same color
 */
function getUserColor(username) {
  if (!username) return CATEGORY_COLORS.default;
  
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const colors = Object.values(CATEGORY_COLORS);
  const index = Math.abs(hash) % colors.length;
  return colors[index];
}

/**
 * Generate avatar as data URL
 * @param {string} username - User's username
 * @param {string} category - Creator category for theming
 * @param {number} size - Avatar size in pixels
 * @param {string} shape - 'circle' or 'square'
 * @returns {string} Data URL of generated avatar
 */
export function generateAvatar(username = '', category = null, size = 200, shape = 'circle') {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  
  // Enable anti-aliasing
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  
  // Get colors based on category or username
  const colors = category && CATEGORY_COLORS[category] 
    ? CATEGORY_COLORS[category] 
    : getUserColor(username);
  
  // Create gradient background
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, colors.primary);
  gradient.addColorStop(1, colors.secondary);
  
  // Draw background shape
  if (shape === 'circle') {
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
  } else {
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  }
  
  // Add subtle inner shadow for depth
  if (shape === 'circle') {
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.lineWidth = 4;
    ctx.stroke();
  }
  
  // Draw initials
  const initials = getInitials(username);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `bold ${size * 0.4}px Inter, system-ui, -apple-system, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetY = 2;
  ctx.fillText(initials, size / 2, size / 2);
  
  return canvas.toDataURL('image/png');
}

/**
 * Generate avatar and save to blob for upload
 */
export function generateAvatarBlob(username, category, size = 200, shape = 'circle') {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    
    // Enable anti-aliasing
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    // Get colors
    const colors = category && CATEGORY_COLORS[category] 
      ? CATEGORY_COLORS[category] 
      : getUserColor(username);
    
    // Create gradient
    const gradient = ctx.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, colors.primary);
    gradient.addColorStop(1, colors.secondary);
    
    // Draw background
    if (shape === 'circle') {
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();
    } else {
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);
    }
    
    // Draw initials
    const initials = getInitials(username);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold ${size * 0.4}px Inter, system-ui, -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 2;
    ctx.fillText(initials, size / 2, size / 2);
    
    canvas.toBlob(resolve, 'image/png');
  });
}

/**
 * Generate identicon-style pattern (like GitHub)
 */
export function generateIdenticon(identifier, size = 200) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  
  // Generate hash from identifier
  let hash = 0;
  for (let i = 0; i < identifier.length; i++) {
    hash = identifier.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Use hash to generate pattern
  const cellSize = size / 5;
  const color = getUserColor(identifier);
  
  // Background
  ctx.fillStyle = '#F3F4F6';
  ctx.fillRect(0, 0, size, size);
  
  // Generate symmetric pattern
  for (let x = 0; x < 3; x++) {
    for (let y = 0; y < 5; y++) {
      if ((hash >> (x * 5 + y)) & 1) {
        ctx.fillStyle = color.primary;
        // Draw on both sides for symmetry
        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
        ctx.fillRect((4 - x) * cellSize, y * cellSize, cellSize, cellSize);
      }
    }
  }
  
  return canvas.toDataURL('image/png');
}

/**
 * Get avatar URL with fallback logic
 */
export function getAvatarUrl(user, size = 200) {
  // Priority: uploaded image -> generated avatar
  if (user?.profile_pic_url || user?.profilePicUrl || user?.avatar_url) {
    return user.profile_pic_url || user.profilePicUrl || user.avatar_url;
  }
  
  // Generate avatar based on user data
  const username = user?.username || user?.display_name || 'User';
  const category = user?.creator_type || user?.category || null;
  
  return generateAvatar(username, category, size);
}

/**
 * Preload avatar to browser cache
 */
export function preloadAvatar(url) {
  if (!url || url.startsWith('data:')) return;
  
  const img = new Image();
  img.src = url;
}

/**
 * Generate blurhash placeholder (simplified version)
 * For production, use the blurhash library
 */
export function generatePlaceholder(dominantColor = '#14B8A6') {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  
  // Simple gradient placeholder
  const gradient = ctx.createLinearGradient(0, 0, 32, 32);
  gradient.addColorStop(0, dominantColor);
  gradient.addColorStop(1, dominantColor + '40');
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 32, 32);
  
  return canvas.toDataURL('image/png');
}

export default {
  generateAvatar,
  generateAvatarBlob,
  generateIdenticon,
  getAvatarUrl,
  preloadAvatar,
  generatePlaceholder,
  CATEGORY_COLORS
};