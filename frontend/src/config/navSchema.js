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
  StarIcon,
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
    id: 'dashboard',
    label: 'Dashboard',
    path: '/dashboard',
    icon: HomeIcon,
    roles: ['creator', 'admin']
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
    roles: ['creator', 'admin']  // Removed 'fan' - fans use popup only
  },
  {
    id: 'wallet-popup',
    label: 'Wallet',
    icon: WalletIcon,
    roles: ['fan'],  // Fan-specific wallet (popup only, no path)
    mobileOnly: true
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
    icon: StarIcon,
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

  // For fans: explore, messages, tv, wallet-popup, profile
  // For creators/admin: dashboard, explore, messages, wallet, profile
  const navIds = role === 'fan'
    ? ['explore', 'messages', 'tv', 'wallet-popup', 'profile']
    : ['dashboard', 'explore', 'messages', 'wallet', 'profile'];

  // Filter items and sort them according to navIds order
  const filteredItems = items.filter(item => navIds.includes(item.id));
  const bottomItems = navIds
    .map(id => filteredItems.find(item => item.id === id))
    .filter(Boolean); // Remove any undefined items

  const mappedItems = bottomItems.map(item => {
    if (item.id === 'profile') {
      return { ...item, label: 'Menu' }; // Changed label to Menu for clarity
    }
    return item;
  });

  return mappedItems.slice(0, 5); // 5 items for both fans and creators
};

export const getMobileCenterAction = (role) => {
  return NAV_ITEMS.find(item => 
    item.centerAction && item.roles.includes(role)
  );
};

export const getDesktopMenuItems = (role) => {
  return getNavItemsForRole(role, false).filter(item => !item.centerAction);
};