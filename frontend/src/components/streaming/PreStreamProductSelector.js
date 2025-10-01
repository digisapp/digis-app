import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingBagIcon,
  CheckCircleIcon,
  XMarkIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowRightIcon,
  SparklesIcon,
  TagIcon,
  PhotoIcon,
  PlusIcon,
  MinusIcon
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolidIcon } from '@heroicons/react/24/solid';
import { api } from '../../services/api';
import { toast } from 'react-hot-toast';

const PreStreamProductSelector = ({
  streamId,
  onComplete,
  onSkip,
  showInModal = false
}) => {
  const [products, setProducts] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bulkSelectMode, setBulkSelectMode] = useState(false);
  const [categories, setCategories] = useState(['all']);

  useEffect(() => {
    console.log('PreStreamProductSelector mounted, showInModal:', showInModal);
    if (showInModal) {
      console.log('PreStreamProductSelector modal should be visible');
      // Ensure body scroll is locked when modal is open
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
    fetchProducts();
  }, [showInModal]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      console.log('Fetching products from /shop/creator/products...');
      const response = await api.get('/shop/creator/products');
      console.log('Products response:', response);
      const productsData = response.data?.products || [];
      setProducts(productsData);

      // Extract unique categories
      const uniqueCategories = ['all', ...new Set(productsData.map(p => p.category).filter(Boolean))];
      setCategories(uniqueCategories);
    } catch (error) {
      console.error('Error fetching products:', error);
      // Don't show error toast, just set empty products
      // This allows the modal to still open even if there are no products
      setProducts([]);
      setCategories(['all']);
    } finally {
      setLoading(false);
    }
  };

  const toggleProductSelection = (productId) => {
    const newSelection = new Set(selectedProducts);
    if (newSelection.has(productId)) {
      newSelection.delete(productId);
    } else {
      newSelection.add(productId);
    }
    setSelectedProducts(newSelection);
  };

  const selectAll = () => {
    const filteredProducts = getFilteredProducts();
    const allIds = new Set(filteredProducts.map(p => p.id));
    setSelectedProducts(allIds);
  };

  const deselectAll = () => {
    setSelectedProducts(new Set());
  };

  const getFilteredProducts = () => {
    return products.filter(product => {
      const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           product.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = filterCategory === 'all' || product.category === filterCategory;
      return matchesSearch && matchesCategory;
    });
  };

  const saveProductSelection = async () => {
    if (selectedProducts.size === 0) {
      toast.error('Please select at least one product');
      return;
    }

    setSaving(true);
    try {
      // Add all selected products to the stream
      const promises = Array.from(selectedProducts).map(productId => 
        api.post(`/live-shopping/streams/${streamId}/products`, {
          productId,
          featured: false,
          discountPercentage: 0
        })
      );

      await Promise.all(promises);
      
      toast.success(`Added ${selectedProducts.size} products to your stream!`);
      
      if (onComplete) {
        onComplete(Array.from(selectedProducts));
      }
    } catch (error) {
      console.error('Error saving products:', error);
      toast.error('Failed to add products to stream');
    } finally {
      setSaving(false);
    }
  };

  const ProductCard = ({ product }) => {
    const isSelected = selectedProducts.has(product.id);
    
    return (
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }} // Add touch feedback
        onClick={() => toggleProductSelection(product.id)}
        className={`relative cursor-pointer rounded-lg border-2 transition-all touch-manipulation ${
          isSelected
            ? 'border-purple-500 bg-purple-50'
            : 'border-gray-200 hover:border-gray-300 bg-white'
        }`}
      >
        {/* Selection indicator */}
        <div className={`absolute top-1 right-1 sm:top-2 sm:right-2 z-10 transition-all ${
          isSelected ? 'scale-100' : 'scale-0'
        }`}>
          <CheckCircleSolidIcon className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600" />
        </div>

        <div className="p-2 sm:p-3 md:p-4">
          {/* Product image - Mobile optimized */}
          <div className="aspect-square mb-2 sm:mb-3 bg-gray-100 rounded-md sm:rounded-lg overflow-hidden">
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={product.name}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <PhotoIcon className="w-6 h-6 sm:w-8 sm:h-8 md:w-12 md:h-12 text-gray-400" />
              </div>
            )}
          </div>

          {/* Product details - Mobile optimized */}
          <h3 className="font-semibold text-xs sm:text-sm mb-1 line-clamp-1">{product.name}</h3>
          <p className="text-xs text-gray-500 mb-1 sm:mb-2 line-clamp-1 sm:line-clamp-2 hidden sm:block">{product.description}</p>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
            <span className="text-xs sm:text-sm font-bold text-purple-600">
              {product.price_tokens} tokens
            </span>
            {product.stock_quantity !== null && product.stock_quantity >= 0 && (
              <span className="text-xs text-gray-500">
                Stock: {product.stock_quantity}
              </span>
            )}
          </div>

          {product.category && (
            <span className="inline-block mt-1 sm:mt-2 px-2 py-0.5 sm:py-1 text-xs bg-gray-100 text-gray-600 rounded-full hidden sm:inline-block">
              {product.category}
            </span>
          )}
        </div>
      </motion.div>
    );
  };

  const content = (
    <div className="flex flex-col h-full">
      {/* Header - Mobile optimized */}
      <div className="p-4 sm:p-6 border-b">
        <div className="flex items-start sm:items-center justify-between mb-3 sm:mb-4">
          <div>
            <h2 className="text-lg sm:text-2xl font-bold flex items-center gap-2">
              <ShoppingBagIcon className="w-5 h-5 sm:w-7 sm:h-7 text-purple-600" />
              <span className="hidden sm:inline">Select Products for Live Shopping</span>
              <span className="sm:hidden">Select Products</span>
            </h2>
            <p className="text-gray-600 mt-1 text-sm sm:text-base hidden sm:block">
              Choose products to showcase during your stream
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs sm:text-sm text-gray-500">
              {selectedProducts.size} selected
            </span>
            {onSkip && (
              <button
                onClick={onSkip}
                className="p-1 sm:p-0 text-gray-500 hover:text-gray-700"
              >
                <XMarkIcon className="w-6 h-6 sm:hidden" />
                <span className="hidden sm:inline">Skip</span>
              </button>
            )}
          </div>
        </div>

        {/* Search and filters - Mobile optimized */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-base"
            />
          </div>

          <div className="flex gap-2">
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="flex-1 sm:flex-none px-3 sm:px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm sm:text-base"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>
                  {cat === 'all' ? 'All' : cat}
                </option>
              ))}
            </select>

            <button
              onClick={() => setBulkSelectMode(!bulkSelectMode)}
              className={`px-3 sm:px-4 py-2 rounded-lg border transition-colors text-sm sm:text-base whitespace-nowrap ${
                bulkSelectMode
                  ? 'bg-purple-600 text-white border-purple-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              <span className="hidden sm:inline">Bulk Select</span>
              <span className="sm:hidden">Bulk</span>
            </button>
          </div>
        </div>

        {/* Bulk actions */}
        {bulkSelectMode && (
          <div className="mt-3 flex gap-2">
            <button
              onClick={selectAll}
              className="px-3 py-1 text-sm bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200"
            >
              Select All Filtered ({getFilteredProducts().length})
            </button>
            <button
              onClick={deselectAll}
              className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              Deselect All
            </button>
          </div>
        )}
      </div>

      {/* Products grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
          </div>
        ) : getFilteredProducts().length === 0 ? (
          <div className="text-center py-12">
            <ShoppingBagIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg mb-2">
              {searchQuery || filterCategory !== 'all'
                ? 'No products match your filters'
                : 'No products in your shop yet'}
            </p>
            {!searchQuery && filterCategory === 'all' && (
              <div className="mt-4">
                <p className="text-sm text-gray-400 mb-4">
                  Create products in your shop to showcase during live streams
                </p>
                <button
                  onClick={() => {
                    if (onSkip) onSkip();
                    window.location.href = '/shop';
                  }}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  Go to Shop Management
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3 md:gap-4">
            <AnimatePresence>
              {getFilteredProducts().map(product => (
                <ProductCard key={product.id} product={product} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Footer actions - Mobile optimized */}
      <div className="sticky bottom-0 left-0 right-0 p-4 sm:p-6 border-t bg-white shadow-lg safe-area-bottom">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-xs sm:text-sm text-gray-600 text-center sm:text-left">
            {selectedProducts.size > 0 && (
              <span className="font-medium">
                {selectedProducts.size} product{selectedProducts.size !== 1 ? 's' : ''} selected
              </span>
            )}
          </div>
          <div className="flex gap-2 sm:gap-3">
            {onSkip && (
              <button
                onClick={onSkip}
                className="flex-1 sm:flex-none px-4 sm:px-6 py-3 sm:py-2 text-gray-700 bg-white border rounded-lg hover:bg-gray-50 text-sm sm:text-base font-medium"
              >
                <span className="hidden sm:inline">Skip This Step</span>
                <span className="sm:hidden">Skip</span>
              </button>
            )}
            <button
              onClick={saveProductSelection}
              disabled={selectedProducts.size === 0 || saving}
              className="flex-1 sm:flex-none px-4 sm:px-6 py-3 sm:py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm sm:text-base font-medium"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Adding Products...
                </>
              ) : (
                <>
                  Add to Stream
                  <ArrowRightIcon className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // For mobile, just return the content directly since GoLiveSetup wraps it
  // For desktop, use portal for better z-index management
  if (showInModal) {
    console.log('Creating product selector modal, showInModal:', showInModal);
    console.log('Window dimensions:', window.innerWidth, 'x', window.innerHeight);
    console.log('Is Mobile:', window.innerWidth < 768);

    // Just return the content wrapped in a simple container
    // The parent component (GoLiveSetup) handles the modal wrapper
    return (
      <motion.div
        initial={{ opacity: 0, y: window.innerWidth < 768 ? 100 : 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: window.innerWidth < 768 ? 100 : 20, scale: 0.95 }}
        transition={{ duration: 0.3, type: "spring", damping: 25 }}
        className="bg-white rounded-t-2xl sm:rounded-xl shadow-2xl w-full h-[90vh] sm:h-[85vh] sm:max-w-5xl overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
      >
        {content}
      </motion.div>
    );
  }

  return content;
};

export default PreStreamProductSelector;