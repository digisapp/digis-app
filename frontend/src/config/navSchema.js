import {
  HomeIcon,
  MagnifyingGlassIcon,
  UserGroupIcon,
  WalletIcon,
  UserCircleIcon,
  VideoCameraIcon,
  ChatBubbleLeftRightIcon,
  Cog6ToothIcon,
  ChartBarIcon,
  FolderOpenIcon,
  CalendarDaysIcon,
  CurrencyDollarIcon,
  TvIcon,
  AcademicCapIcon,
  ShoppingBagIcon,
  HeartIcon,
  PhoneIcon,
} from '@heroicons/react/24/outline';

// Role types: 'fan' | 'creator' | 'admin'

// NavItem structure:
// {
//   id: string,
//   label: string,
//   path: string (optional),
//   icon: React component,
//   badgeKey: 'messages' | 'notifications' | 'tokens' (optional),
//   centerAction: boolean (optional),
//   roles: array of Role,
//   mobileOnly: boolean (optional),
//   desktopOnly: boolean (optional),
//   showInMenu: boolean (optional)
// }

export const NAV_ITEMS = [
  // Core navigation items
  {
    id: 'home',
    label: 'Home',
    path: '/dashboard',  // Always go to dashboard for all roles
    icon: HomeIcon,
    roles: ['fan', 'creator', 'admin']
  },
  { 
    id: 'explore', 
    label: 'Explore', 
    path: '/explore', 
    icon: MagnifyingGlassIcon, 
    roles: ['fan', 'creator', 'admin'] 
  },
  { 
    id: 'messages', 
    label: 'Messages', 
    path: '/messages', 
    icon: ChatBubbleLeftRightIcon, 
    badgeKey: 'messages',
    roles: ['fan', 'creator', 'admin'] 
  },
  {
    id: 'wallet',
    label: 'Wallet',
    path: '/wallet',
    icon: WalletIcon,
    roles: ['fan', 'creator', 'admin']
  },

  // Analytics - now a top-level item for creators
  {
    id: 'analytics',
    label: 'Analytics',
    path: '/analytics',
    icon: ChartBarIcon,
    roles: ['creator', 'admin']
  },

  // Creator-specific items
  {
    id: 'dashboard',
    label: 'Dashboard',
    path: '/dashboard',
    icon: ChartBarIcon,
    roles: ['creator', 'admin']
  },
  { 
    id: 'golive', 
    label: 'Go Live', 
    icon: VideoCameraIcon, 
    centerAction: true, 
    roles: ['creator'],
    mobileOnly: true 
  },
  { 
    id: 'earnings', 
    label: 'Earnings', 
    path: '/earnings', 
    icon: CurrencyDollarIcon, 
    roles: ['creator', 'admin'] 
  },
  { 
    id: 'content', 
    label: 'Content', 
    path: '/content', 
    icon: FolderOpenIcon, 
    roles: ['creator'] 
  },
  { 
    id: 'schedule', 
    label: 'Schedule', 
    path: '/schedule', 
    icon: CalendarDaysIcon, 
    roles: ['creator'] 
  },
  
  // Fan/User items
  { 
    id: 'tv', 
    label: 'TV', 
    path: '/tv', 
    icon: TvIcon, 
    roles: ['fan', 'creator', 'admin'] 
  },
  { 
    id: 'classes', 
    label: 'Classes', 
    path: '/classes', 
    icon: AcademicCapIcon, 
    roles: ['fan', 'creator', 'admin'] 
  },
  { 
    id: 'shop', 
    label: 'Shop', 
    path: '/shop', 
    icon: ShoppingBagIcon, 
    roles: ['fan', 'creator', 'admin'] 
  },
  { 
    id: 'collections', 
    label: 'Collections', 
    path: '/collections', 
    icon: HeartIcon, 
    roles: ['fan', 'creator', 'admin'] 
  },
  { 
    id: 'calls', 
    label: 'Calls', 
    path: '/calls', 
    icon: PhoneIcon, 
    roles: ['fan', 'creator'] 
  },
  
  // Profile & Settings (always last)
  {
    id: 'profile',
    label: 'Profile',
    path: '/profile',
    icon: UserCircleIcon,
    roles: ['fan', 'creator', 'admin']
  },
  { 
    id: 'settings', 
    label: 'Settings', 
    path: '/settings', 
    icon: Cog6ToothIcon, 
    roles: ['fan', 'creator', 'admin'],
    showInMenu: true 
  },
];

// Helper functions
export const getNavItemsForRole = (role, isMobile = false) => {
  return NAV_ITEMS.filter(item => {
    if (!item.roles.includes(role)) return false;
    if (isMobile && item.desktopOnly) return false;
    if (!isMobile && item.mobileOnly) return false;
    return true;
  });
};

export const getMobileBottomItems = (role) => {
  const items = getNavItemsForRole(role, true);
  // Return home, explore, messages, and profile for bottom nav (4 items total)
  const bottomItems = items.filter(item =>
    ['home', 'explore', 'messages', 'profile'].includes(item.id)
  );

  // Ensure home always goes to dashboard for all users on mobile
  const mappedItems = bottomItems.map(item => {
    if (item.id === 'home') {
      return { ...item, path: '/dashboard' };
    }
    if (item.id === 'profile') {
      return { ...item, label: 'Menu' }; // Changed label to Menu for clarity, but no path since it's a dropdown
    }
    return item;
  });

  return mappedItems.slice(0, 4); // Only 4 items in bottom nav
};

export const getMobileCenterAction = (role) => {
  return NAV_ITEMS.find(item => 
    item.centerAction && item.roles.includes(role)
  );
};

export const getDesktopMenuItems = (role) => {
  return getNavItemsForRole(role, false).filter(item => !item.centerAction);
};