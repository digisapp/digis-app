import React from 'react';
import { motion } from 'framer-motion';
import {
  PencilIcon,
  TrashIcon,
  EyeIcon,
  ShoppingBagIcon,
  StarIcon,
  TagIcon
} from '@heroicons/react/24/outline';
import { formatTokenAmount, tokensToUSD } from '../../config/constants';

/**
 * Reusable Product Card Component
 * Can be used in both CreatorShopManagement and CreatorShopSection
 */
const ProductCard = ({
  product,
  onEdit,
  onDelete,
  onView,
  showActions = true,
  compact = false,
  className = ''
}) => {
  const {
    id,
    name,
    description,
    price,
    type = 'digital',
    category,
    stock,
    sales = 0,
    rating = 0,
    thumbnail,
    images = []
  } = product;

  const displayImage = thumbnail || images[0] || getPlaceholderImage(type, category);
  const isOutOfStock = type === 'physical' && stock === 0;

  return (
    <motion.div
      whileHover={{ y: -2, scale: 1.01 }}
      className={`bg-white rounded-xl shadow-sm hover:shadow-lg transition-all ${
        isOutOfStock ? 'opacity-75' : ''
      } ${className}`}
      role="article"
      aria-label={`Product: ${name}`}
    >
      {/* Product Image */}
      <div className="relative aspect-square bg-gray-100 rounded-t-xl overflow-hidden">
        <img
          src={displayImage}
          alt={name}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        
        {/* Type Badge */}
        <div className={`absolute top-2 left-2 px-2 py-1 rounded-lg text-xs font-medium ${
          type === 'digital' 
            ? 'bg-blue-100 text-blue-700' 
            : 'bg-green-100 text-green-700'
        }`}>
          {type === 'digital' ? '💾' : '📦'} {type}
        </div>

        {/* Out of Stock Badge */}
        {isOutOfStock && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="bg-red-500 text-white px-3 py-1 rounded-lg font-medium">
              Out of Stock
            </span>
          </div>
        )}

        {/* Quick Actions (visible on hover) */}
        {showActions && (
          <div className="absolute top-2 right-2 flex gap-1 opacity-0 hover:opacity-100 transition-opacity">
            {onView && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onView(product);
                }}
                className="p-1.5 bg-white rounded-lg shadow hover:bg-gray-50 transition-colors"
                aria-label="View product details"
              >
                <EyeIcon className="w-4 h-4 text-gray-600" />
              </button>
            )}
            {onEdit && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(product);
                }}
                className="p-1.5 bg-white rounded-lg shadow hover:bg-gray-50 transition-colors"
                aria-label="Edit product"
              >
                <PencilIcon className="w-4 h-4 text-blue-600" />
              </button>
            )}
            {onDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(product);
                }}
                className="p-1.5 bg-white rounded-lg shadow hover:bg-gray-50 transition-colors"
                aria-label="Delete product"
              >
                <TrashIcon className="w-4 h-4 text-red-600" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className={`p-${compact ? '3' : '4'}`}>
        <h3 className="font-semibold text-gray-900 truncate" title={name}>
          {name}
        </h3>
        
        {!compact && description && (
          <p className="text-sm text-gray-600 mt-1 line-clamp-2">
            {description}
          </p>
        )}

        {/* Price and Stats */}
        <div className="mt-3 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1">
              <TagIcon className="w-4 h-4 text-purple-600" />
              <span className="font-bold text-purple-600">
                {formatTokenAmount(price)}
              </span>
            </div>
            <span className="text-xs text-gray-500">
              ≈ ${tokensToUSD(price)}
            </span>
          </div>

          {!compact && (
            <div className="flex items-center gap-3 text-xs text-gray-500">
              {/* Sales */}
              <div className="flex items-center gap-1">
                <ShoppingBagIcon className="w-3.5 h-3.5" />
                <span>{sales}</span>
              </div>
              
              {/* Rating */}
              {rating > 0 && (
                <div className="flex items-center gap-1">
                  <StarIcon className="w-3.5 h-3.5 text-yellow-500 fill-current" />
                  <span>{rating.toFixed(1)}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Stock Info for Physical Products */}
        {type === 'physical' && !compact && (
          <div className="mt-2 text-xs text-gray-500">
            Stock: {stock || 0} units
          </div>
        )}

        {/* Category */}
        {category && !compact && (
          <div className="mt-2">
            <span className="inline-block px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-lg">
              {category}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
};

/**
 * Get placeholder image based on product type and category
 */
const getPlaceholderImage = (type, category) => {
  const placeholders = {
    digital: {
      default: '💾',
      ebook: '📚',
      course: '🎓',
      music: '🎵',
      video: '🎬',
      software: '💻',
      design: '🎨'
    },
    physical: {
      default: '📦',
      clothing: '👕',
      accessories: '💍',
      electronics: '📱',
      books: '📖',
      art: '🖼️',
      home: '🏠'
    }
  };

  const typeMap = placeholders[type] || placeholders.digital;
  const emoji = typeMap[category?.toLowerCase()] || typeMap.default;
  
  // Return a data URL with the emoji as placeholder
  return `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="50%" x="50%" text-anchor="middle" font-size="40">${emoji}</text></svg>`;
};

export default ProductCard;