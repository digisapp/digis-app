import { APP_CONFIG } from '../config/constants';

/**
 * Shop-related utility functions
 */

/**
 * Calculate creator earnings after platform commission
 */
export const calculateCreatorEarnings = (totalAmount) => {
  const commission = APP_CONFIG.SHOP_CONFIG.PLATFORM_COMMISSION;
  return totalAmount * (1 - commission);
};

/**
 * Calculate platform fee from total amount
 */
export const calculatePlatformFee = (totalAmount) => {
  return totalAmount * APP_CONFIG.SHOP_CONFIG.PLATFORM_COMMISSION;
};

/**
 * Format order status for display
 */
export const formatOrderStatus = (status) => {
  const statusMap = {
    pending: { label: 'Pending', color: 'yellow', icon: '⏳' },
    processing: { label: 'Processing', color: 'blue', icon: '📦' },
    shipped: { label: 'Shipped', color: 'purple', icon: '🚚' },
    delivered: { label: 'Delivered', color: 'green', icon: '✅' },
    cancelled: { label: 'Cancelled', color: 'red', icon: '❌' },
    refunded: { label: 'Refunded', color: 'gray', icon: '💸' }
  };
  
  return statusMap[status] || { label: status, color: 'gray', icon: '📋' };
};

/**
 * Get status color classes for Tailwind
 */
export const getStatusColorClasses = (status) => {
  const colors = {
    pending: 'bg-yellow-100 text-yellow-800',
    processing: 'bg-blue-100 text-blue-800',
    shipped: 'bg-purple-100 text-purple-800',
    delivered: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
    refunded: 'bg-gray-100 text-gray-800'
  };
  
  return colors[status] || 'bg-gray-100 text-gray-800';
};

/**
 * Validate product data
 */
export const validateProduct = (product) => {
  const errors = [];
  
  if (!product.name || product.name.trim().length < 3) {
    errors.push('Product name must be at least 3 characters');
  }
  
  if (!product.price || product.price < APP_CONFIG.SHOP_CONFIG.MIN_PRODUCT_PRICE) {
    errors.push(`Price must be at least ${APP_CONFIG.SHOP_CONFIG.MIN_PRODUCT_PRICE} tokens`);
  }
  
  if (product.price > APP_CONFIG.SHOP_CONFIG.MAX_PRODUCT_PRICE) {
    errors.push(`Price cannot exceed ${APP_CONFIG.SHOP_CONFIG.MAX_PRODUCT_PRICE} tokens`);
  }
  
  if (product.type === 'physical' && (!product.stock || product.stock < 0)) {
    errors.push('Physical products must have valid stock quantity');
  }
  
  if (!product.type || !APP_CONFIG.SHOP_CONFIG.PRODUCT_TYPES.includes(product.type)) {
    errors.push('Invalid product type');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Generate shop URL for a creator
 */
export const generateShopUrl = (username) => {
  return `${APP_CONFIG.SHOP_CONFIG.SHOP_URL_PREFIX}${username}`;
};

/**
 * Calculate shipping estimate
 */
export const calculateShippingEstimate = (items) => {
  const hasPhysicalItems = items.some(item => item.type === 'physical');
  
  if (!hasPhysicalItems) {
    return {
      cost: 0,
      estimatedDays: 0,
      method: 'Digital Delivery'
    };
  }
  
  // Simple shipping calculation (can be enhanced)
  const baseShipping = 50; // 50 tokens base shipping
  const perItemShipping = 10; // 10 tokens per additional item
  const physicalItemCount = items.filter(item => item.type === 'physical').length;
  
  return {
    cost: baseShipping + (physicalItemCount - 1) * perItemShipping,
    estimatedDays: '3-5',
    method: 'Standard Shipping'
  };
};

/**
 * Format product for display
 */
export const formatProductForDisplay = (product) => {
  return {
    ...product,
    displayPrice: `${product.price} tokens`,
    displayType: product.type === 'digital' ? '💾 Digital' : '📦 Physical',
    isAvailable: product.type === 'digital' || product.stock > 0,
    stockStatus: getStockStatus(product)
  };
};

/**
 * Get stock status
 */
export const getStockStatus = (product) => {
  if (product.type === 'digital') {
    return { label: 'Unlimited', color: 'green' };
  }
  
  if (product.stock === 0) {
    return { label: 'Out of Stock', color: 'red' };
  }
  
  if (product.stock < 10) {
    return { label: `Low Stock (${product.stock})`, color: 'yellow' };
  }
  
  return { label: `In Stock (${product.stock})`, color: 'green' };
};

/**
 * Sort products by various criteria
 */
export const sortProducts = (products, sortBy = 'newest') => {
  const sorted = [...products];
  
  switch (sortBy) {
    case 'newest':
      return sorted.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    case 'oldest':
      return sorted.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    case 'price-low':
      return sorted.sort((a, b) => a.price - b.price);
    case 'price-high':
      return sorted.sort((a, b) => b.price - a.price);
    case 'popular':
      return sorted.sort((a, b) => (b.sales || 0) - (a.sales || 0));
    case 'rating':
      return sorted.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    case 'name':
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    default:
      return sorted;
  }
};

/**
 * Filter products by criteria
 */
export const filterProducts = (products, filters = {}) => {
  let filtered = [...products];
  
  if (filters.type) {
    filtered = filtered.filter(p => p.type === filters.type);
  }
  
  if (filters.category) {
    filtered = filtered.filter(p => p.category === filters.category);
  }
  
  if (filters.minPrice) {
    filtered = filtered.filter(p => p.price >= filters.minPrice);
  }
  
  if (filters.maxPrice) {
    filtered = filtered.filter(p => p.price <= filters.maxPrice);
  }
  
  if (filters.inStock) {
    filtered = filtered.filter(p => p.type === 'digital' || p.stock > 0);
  }
  
  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    filtered = filtered.filter(p => 
      p.name.toLowerCase().includes(searchLower) ||
      p.description?.toLowerCase().includes(searchLower) ||
      p.category?.toLowerCase().includes(searchLower)
    );
  }
  
  return filtered;
};

/**
 * Calculate shop statistics
 */
export const calculateShopStats = (products, orders = []) => {
  const totalProducts = products.length;
  const digitalProducts = products.filter(p => p.type === 'digital').length;
  const physicalProducts = products.filter(p => p.type === 'physical').length;
  
  const totalSales = products.reduce((sum, p) => sum + (p.sales || 0), 0);
  const totalRevenue = orders.reduce((sum, o) => sum + o.totalAmount, 0);
  const creatorEarnings = calculateCreatorEarnings(totalRevenue);
  
  const ratings = products.filter(p => p.rating).map(p => p.rating);
  const averageRating = ratings.length > 0 
    ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length 
    : 0;
  
  return {
    totalProducts,
    digitalProducts,
    physicalProducts,
    totalSales,
    totalRevenue,
    creatorEarnings,
    platformFees: calculatePlatformFee(totalRevenue),
    averageRating: averageRating.toFixed(1),
    totalOrders: orders.length,
    averageOrderValue: orders.length > 0 ? totalRevenue / orders.length : 0
  };
};