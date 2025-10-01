import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingBagIcon,
  PlusIcon,
  StarIcon,
  BoltIcon,
  ChartBarIcon,
  XMarkIcon,
  ClockIcon,
  QuestionMarkCircleIcon,
  CurrencyDollarIcon
} from '@heroicons/react/24/outline';
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';
import { apiClient } from '../../services/api';
import { toast } from 'react-hot-toast';

const CreatorShoppingControls = ({ streamId, user, hideToggleButton = false, onClose }) => {
  const [showPanel, setShowPanel] = useState(hideToggleButton);
  const [products, setProducts] = useState([]);
  const [myProducts, setMyProducts] = useState([]);
  const [streamProducts, setStreamProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [flashSaleSettings, setFlashSaleSettings] = useState({
    discountPercentage: 20,
    durationMinutes: 5,
    maxQuantity: null
  });
  const [analytics, setAnalytics] = useState(null);
  const [activeTab, setActiveTab] = useState('products');
  const [loading, setLoading] = useState(false);
  const [bulkSelectMode, setBulkSelectMode] = useState(false);
  const [selectedForBulk, setSelectedForBulk] = useState(new Set());

  useEffect(() => {
    if (streamId && showPanel) {
      fetchMyProducts();
      fetchStreamProducts();
      fetchAnalytics();
    }
  }, [streamId, showPanel]);

  // Auto-refresh analytics every 30 seconds
  useEffect(() => {
    if (!showPanel || activeTab !== 'analytics') return;

    const interval = setInterval(fetchAnalytics, 30000);
    return () => clearInterval(interval);
  }, [showPanel, activeTab]);

  const fetchMyProducts = async () => {
    try {
      const response = await apiClient.get('/shop/creator/products');
      setMyProducts(response.data.products || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const fetchStreamProducts = async () => {
    try {
      const response = await apiClient.get(`/live-shopping/streams/${streamId}/products`);
      setStreamProducts(response.data.products || []);
    } catch (error) {
      console.error('Error fetching stream products:', error);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const response = await apiClient.get(`/live-shopping/streams/${streamId}/shopping-analytics`);
      setAnalytics(response.data.analytics);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    }
  };

  const addProductToStream = async (product) => {
    setLoading(true);
    try {
      await apiClient.post(`/live-shopping/streams/${streamId}/products`, {
        productId: product.id,
        featured: false,
        discountPercentage: 0
      });
      
      toast.success(`Added ${product.name} to stream`);
      fetchStreamProducts();
    } catch (error) {
      toast.error('Failed to add product');
    } finally {
      setLoading(false);
    }
  };

  const addBulkProductsToStream = async () => {
    if (selectedForBulk.size === 0) {
      toast.error('Please select products first');
      return;
    }

    setLoading(true);
    try {
      const promises = Array.from(selectedForBulk).map(productId =>
        apiClient.post(`/live-shopping/streams/${streamId}/products`, {
          productId,
          featured: false,
          discountPercentage: 0
        })
      );

      await Promise.all(promises);
      
      toast.success(`Added ${selectedForBulk.size} products to stream!`);
      setSelectedForBulk(new Set());
      setBulkSelectMode(false);
      fetchStreamProducts();
    } catch (error) {
      toast.error('Failed to add some products');
    } finally {
      setLoading(false);
    }
  };

  const toggleBulkSelect = (productId) => {
    const newSelection = new Set(selectedForBulk);
    if (newSelection.has(productId)) {
      newSelection.delete(productId);
    } else {
      newSelection.add(productId);
    }
    setSelectedForBulk(newSelection);
  };

  const removeProductFromStream = async (productId) => {
    try {
      await apiClient.delete(`/live-shopping/streams/${streamId}/products/${productId}`);
      toast.success('Product removed');
      fetchStreamProducts();
    } catch (error) {
      toast.error('Failed to remove product');
    }
  };

  const featureProduct = async (productId, featured) => {
    try {
      await apiClient.put(`/live-shopping/streams/${streamId}/products/${productId}/feature`, {
        featured
      });

      toast.success(featured ? 'Product featured!' : 'Product unfeatured');
      fetchStreamProducts();
    } catch (error) {
      toast.error('Failed to update product');
    }
  };

  const startFlashSale = async () => {
    if (!selectedProduct) {
      toast.error('Please select a product');
      return;
    }

    setLoading(true);
    try {
      await apiClient.post('/live-shopping/flash-sales', {
        streamId,
        productId: selectedProduct.product_id || selectedProduct.id,
        ...flashSaleSettings
      });
      
      toast.success('🔥 Flash sale started!');
      setSelectedProduct(null);
      setFlashSaleSettings({
        discountPercentage: 20,
        durationMinutes: 5,
        maxQuantity: null
      });
    } catch (error) {
      toast.error('Failed to start flash sale');
    } finally {
      setLoading(false);
    }
  };

  const [showPollModal, setShowPollModal] = useState(false);
  const [pollData, setPollData] = useState({
    question: '',
    options: ['', '', '', ''],
    duration: 3
  });

  const createPoll = async () => {
    const validOptions = pollData.options.filter(opt => opt.trim());

    if (!pollData.question.trim()) {
      toast.error('Please enter a question');
      return;
    }

    if (validOptions.length < 2) {
      toast.error('Please provide at least 2 options');
      return;
    }

    try {
      await apiClient.post('/live-shopping/shopping-interactions', {
        streamId,
        interactionType: 'poll',
        productId: selectedProduct?.product_id,
        question: pollData.question,
        options: validOptions.map(opt => ({ option: opt, votes: 0 })),
        expiresInMinutes: pollData.duration
      });

      toast.success('Poll created!');
      setShowPollModal(false);
      setPollData({ question: '', options: ['', '', '', ''], duration: 3 });
    } catch (error) {
      toast.error('Failed to create poll');
    }
  };

  return (
    <>
      {/* Toggle Button - Smaller and better positioned */}
      {!hideToggleButton && (
        <button
          onClick={() => setShowPanel(!showPanel)}
          className="fixed bottom-28 left-4 z-40 bg-purple-600/90 backdrop-blur-sm text-white p-2.5 rounded-full shadow-lg hover:bg-purple-700 transition-all group"
          title="Shopping Controls"
        >
          <ShoppingBagIcon className="w-5 h-5" />
          <span className="absolute left-full ml-2 px-2 py-1 bg-black/70 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            Shopping Controls
          </span>
        </button>
      )}

      {/* Control Panel */}
      <AnimatePresence>
        {showPanel && (
          <motion.div
            initial={{ opacity: 0, x: -100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -100 }}
            className="bg-gray-900 rounded-2xl p-4 w-80 max-h-[600px] shadow-2xl border border-gray-800 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-white text-lg font-bold flex items-center gap-2">
                  <ShoppingBagIcon className="w-5 h-5" />
                  Shop Controls
                </h3>
                <button
                  onClick={() => {
                    setShowPanel(false);
                    if (onClose) onClose();
                  }}
                  className="p-1 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors text-gray-400 hover:text-white"
                  title="Close"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
              
              {/* Tabs */}
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveTab('products')}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    activeTab === 'products'
                      ? 'bg-purple-600 text-white font-semibold'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
                  }`}
                >
                  Products
                </button>
                <button
                  onClick={() => setActiveTab('flash')}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    activeTab === 'flash'
                      ? 'bg-purple-600 text-white font-semibold'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
                  }`}
                >
                  Flash Sale
                </button>
                <button
                  onClick={() => setActiveTab('analytics')}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    activeTab === 'analytics'
                      ? 'bg-purple-600 text-white font-semibold'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
                  }`}
                >
                  Analytics
                </button>
              </div>
            </div>

            {/* Compact Content */}
            <div className="flex-1 overflow-y-auto">
              {activeTab === 'products' && (
                <div className="p-3">
                  {/* Bulk Actions */}
                  {bulkSelectMode && (
                    <div className="mb-4 p-3 bg-gray-800 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-purple-700">
                          {selectedForBulk.size} products selected
                        </span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setSelectedForBulk(new Set(myProducts.map(p => p.id)));
                            }}
                            className="text-xs px-2 py-1 bg-purple-600 text-white rounded hover:bg-purple-700"
                          >
                            Select All
                          </button>
                          <button
                            onClick={() => setSelectedForBulk(new Set())}
                            className="text-xs px-2 py-1 bg-gray-8000 text-white rounded hover:bg-gray-600"
                          >
                            Clear
                          </button>
                        </div>
                      </div>
                      <button
                        onClick={addBulkProductsToStream}
                        disabled={selectedForBulk.size === 0 || loading}
                        className="w-full py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Add {selectedForBulk.size} Products to Stream
                      </button>
                    </div>
                  )}

                  {/* Stream Products */}
                  <div className="mb-4">
                    <h3 className="font-semibold text-sm mb-2 text-white">Active Products</h3>
                    {streamProducts.length === 0 ? (
                      <p className="text-gray-400 text-sm">No products added yet</p>
                    ) : (
                      <div className="space-y-1">
                        {streamProducts.map((product) => (
                          <div
                            key={product.product_id}
                            className="flex items-center justify-between p-2 border border-gray-700 rounded hover:bg-gray-800 transition-colors"
                          >
                            <div className="flex items-center space-x-2">
                              <img
                                src={product.image_url}
                                alt={product.name}
                                className="w-10 h-10 object-cover rounded"
                              />
                              <div>
                                <p className="font-medium text-sm line-clamp-1 text-white">{product.name}</p>
                                <p className="text-xs text-gray-400">
                                  {product.price} tokens
                                </p>
                              </div>
                            </div>
                            
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => featureProduct(product.product_id, !product.featured)}
                                className={`p-2 rounded-lg transition-colors ${
                                  product.featured 
                                    ? 'bg-yellow-100 text-yellow-600' 
                                    : 'hover:bg-gray-100'
                                }`}
                              >
                                {product.featured ? (
                                  <StarSolidIcon className="w-5 h-5" />
                                ) : (
                                  <StarIcon className="w-5 h-5" />
                                )}
                              </button>
                              <button
                                onClick={() => removeProductFromStream(product.product_id)}
                                className="p-2 hover:bg-red-100 rounded-lg text-red-500"
                              >
                                <XMarkIcon className="w-5 h-5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Add Products */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-lg text-white">Add Products</h3>
                      <button
                        onClick={() => {
                          setBulkSelectMode(!bulkSelectMode);
                          setSelectedForBulk(new Set());
                        }}
                        className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                          bulkSelectMode 
                            ? 'bg-purple-600 text-white' 
                            : 'bg-gray-200 hover:bg-gray-300'
                        }`}
                      >
                        {bulkSelectMode ? 'Cancel Bulk' : 'Bulk Select'}
                      </button>
                    </div>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {myProducts.filter(p => 
                        !streamProducts.find(sp => sp.product_id === p.id)
                      ).map((product) => (
                        <div
                          key={product.id}
                          onClick={() => {
                            if (bulkSelectMode) {
                              toggleBulkSelect(product.id);
                            } else {
                              addProductToStream(product);
                            }
                          }}
                          className={`w-full flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-all ${
                            bulkSelectMode && selectedForBulk.has(product.id)
                              ? 'bg-gray-800 border-purple-500'
                              : 'hover:bg-gray-700'
                          } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <div className="flex items-center space-x-3">
                            {bulkSelectMode && (
                              <input
                                type="checkbox"
                                checked={selectedForBulk.has(product.id)}
                                onChange={() => {}}
                                className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
                              />
                            )}
                            <img
                              src={product.image_url}
                              alt={product.name}
                              className="w-12 h-12 object-cover rounded-lg"
                            />
                            <div className="text-left">
                              <p className="font-medium text-white">{product.name}</p>
                              <p className="text-sm text-gray-400">
                                {product.price} tokens • Stock: {product.stock_quantity || '∞'}
                              </p>
                            </div>
                          </div>
                          {!bulkSelectMode && <PlusIcon className="w-5 h-5 text-purple-600" />}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'flash' && (
                <div className="p-4">
                  <h3 className="font-semibold text-lg mb-4 text-white">Start Flash Sale</h3>
                  
                  {/* Product Selection */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Select Product
                    </label>
                    <select
                      value={selectedProduct?.product_id || ''}
                      onChange={(e) => {
                        const product = streamProducts.find(p => p.product_id === e.target.value);
                        setSelectedProduct(product);
                      }}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="" className="bg-gray-900">Choose a product...</option>
                      {streamProducts.map((product) => (
                        <option key={product.product_id} value={product.product_id} className="bg-gray-900">
                          {product.name} - {product.price} tokens
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Discount Percentage */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Discount Percentage
                    </label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="range"
                        min="5"
                        max="90"
                        value={flashSaleSettings.discountPercentage}
                        onChange={(e) => setFlashSaleSettings({
                          ...flashSaleSettings,
                          discountPercentage: parseInt(e.target.value)
                        })}
                        className="flex-1 accent-red-500"
                      />
                      <span className="w-12 text-center font-bold text-white bg-red-600 px-2 py-1 rounded">
                        {flashSaleSettings.discountPercentage}%
                      </span>
                    </div>
                  </div>

                  {/* Duration */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Duration (minutes)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="60"
                      value={flashSaleSettings.durationMinutes}
                      onChange={(e) => setFlashSaleSettings({
                        ...flashSaleSettings,
                        durationMinutes: parseInt(e.target.value)
                      })}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  {/* Max Quantity */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Max Quantity (optional)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={flashSaleSettings.maxQuantity || ''}
                      onChange={(e) => setFlashSaleSettings({
                        ...flashSaleSettings,
                        maxQuantity: e.target.value ? parseInt(e.target.value) : null
                      })}
                      placeholder="Unlimited"
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-lg focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  {/* Preview - Enhanced visibility */}
                  {selectedProduct && (
                    <div className="mb-6 p-4 bg-gradient-to-r from-red-900/30 to-orange-900/30 rounded-lg border border-red-600/50 backdrop-blur-sm">
                      <h4 className="font-semibold mb-2 text-white">Flash Sale Preview</h4>
                      <p className="text-sm text-gray-300 mb-1">{selectedProduct.name}</p>
                      <div className="flex items-center space-x-2">
                        <span className="text-lg font-bold text-green-400">
                          {Math.floor(selectedProduct.price * (1 - flashSaleSettings.discountPercentage / 100))} tokens
                        </span>
                        <span className="text-sm line-through text-gray-500">
                          {selectedProduct.price} tokens
                        </span>
                        <span className="text-xs bg-red-600 text-white font-bold px-2 py-1 rounded shadow">
                          -{flashSaleSettings.discountPercentage}%
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-2">
                        Duration: {flashSaleSettings.durationMinutes} minutes
                        {flashSaleSettings.maxQuantity && ` • Limited to ${flashSaleSettings.maxQuantity} items`}
                      </p>
                    </div>
                  )}

                  <button
                    onClick={startFlashSale}
                    disabled={!selectedProduct || loading}
                    className="w-full py-3 bg-gradient-to-r from-red-500 to-orange-500 text-white font-bold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    <div className="flex items-center justify-center space-x-2">
                      <BoltIcon className="w-5 h-5" />
                      <span>Start Flash Sale</span>
                    </div>
                  </button>

                  {/* Interactive Poll - Single button */}
                  <div className="mt-6 pt-6 border-t">
                    <button
                      onClick={() => setShowPollModal(true)}
                      className="w-full py-3 bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-700 transition-colors"
                    >
                      <div className="flex items-center justify-center space-x-2">
                        <QuestionMarkCircleIcon className="w-5 h-5" />
                        <span>Create Poll</span>
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'analytics' && (
                <div className="p-4">
                  <h3 className="font-semibold text-lg mb-4 text-white">Live Analytics</h3>
                  
                  {analytics ? (
                    <>
                      {/* Summary Stats */}
                      <div className="grid grid-cols-2 gap-3 mb-6">
                        <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-3 rounded-lg">
                          <p className="text-xs text-gray-400 mb-1">Total Sales</p>
                          <p className="text-2xl font-bold text-green-600">
                            {analytics.total_revenue || 0} tokens
                          </p>
                        </div>
                        <div className="bg-gradient-to-r from-blue-50 to-cyan-50 p-3 rounded-lg">
                          <p className="text-xs text-gray-400 mb-1">Orders</p>
                          <p className="text-2xl font-bold text-blue-600">
                            {analytics.total_purchases || 0}
                          </p>
                        </div>
                        <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-3 rounded-lg">
                          <p className="text-xs text-gray-400 mb-1">Avg Order</p>
                          <p className="text-2xl font-bold text-purple-600">
                            {Math.round(analytics.avg_purchase_value || 0)} tokens
                          </p>
                        </div>
                        <div className="bg-gradient-to-r from-yellow-50 to-orange-50 p-3 rounded-lg">
                          <p className="text-xs text-gray-400 mb-1">Buyers</p>
                          <p className="text-2xl font-bold text-orange-600">
                            {analytics.unique_buyers || 0}
                          </p>
                        </div>
                      </div>

                      {/* Top Products */}
                      {analytics.topProducts && analytics.topProducts.length > 0 && (
                        <div className="mb-6">
                          <h4 className="font-semibold mb-3">Top Products</h4>
                          <div className="space-y-2">
                            {analytics.topProducts.map((product, index) => (
                              <div
                                key={index}
                                className="flex items-center justify-between p-2 bg-gray-800 rounded-lg"
                              >
                                <div className="flex items-center space-x-2">
                                  <span className="w-6 h-6 bg-purple-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                                    {index + 1}
                                  </span>
                                  <div>
                                    <p className="font-medium text-sm">{product.name}</p>
                                    <p className="text-xs text-gray-400">
                                      {product.sales_count} sales
                                    </p>
                                  </div>
                                </div>
                                <span className="font-bold text-sm">
                                  {product.total_revenue} tokens
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Engagement Stats */}
                      {analytics.engagement && analytics.engagement.length > 0 && (
                        <div>
                          <h4 className="font-semibold mb-3">Engagement</h4>
                          <div className="space-y-2">
                            {analytics.engagement.map((stat) => (
                              <div
                                key={stat.event_type}
                                className="flex items-center justify-between p-2 bg-gray-800 rounded-lg"
                              >
                                <span className="text-sm capitalize">
                                  {stat.event_type.replace('_', ' ')}
                                </span>
                                <span className="font-bold text-sm">
                                  {stat.count}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center text-gray-400 py-8">
                      Loading analytics...
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Quick Actions Bar - Simplified */}
            <div className="p-4 border-t border-gray-700 bg-gray-800/50">
              <button
                onClick={() => {
                  const featured = streamProducts.find(p => !p.featured);
                  if (featured) {
                    featureProduct(featured.product_id, true);
                  } else {
                    toast('No products to feature');
                  }
                }}
                className="w-full py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors text-sm font-medium"
              >
                Feature Next Product
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Poll Creation Modal */}
      <AnimatePresence>
        {showPollModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowPollModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-gray-900 rounded-xl p-6 max-w-md w-full shadow-2xl border border-gray-800"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <QuestionMarkCircleIcon className="w-6 h-6 text-purple-500" />
                  Create Poll
                </h3>
                <button
                  onClick={() => setShowPollModal(false)}
                  className="p-1 hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <XMarkIcon className="w-6 h-6 text-gray-400" />
                </button>
              </div>

              {/* Poll Question */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Poll Question
                </label>
                <textarea
                  value={pollData.question}
                  onChange={(e) => setPollData({ ...pollData, question: e.target.value })}
                  placeholder="What would you like to ask your viewers?"
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                  rows="2"
                />
              </div>

              {/* Poll Options */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Options (minimum 2)
                </label>
                <div className="space-y-2">
                  {pollData.options.map((option, index) => (
                    <input
                      key={index}
                      type="text"
                      value={option}
                      onChange={(e) => {
                        const newOptions = [...pollData.options];
                        newOptions[index] = e.target.value;
                        setPollData({ ...pollData, options: newOptions });
                      }}
                      placeholder={`Option ${index + 1}${index < 2 ? ' (required)' : ' (optional)'}`}
                      className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  ))}
                </div>
              </div>

              {/* Duration */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Duration: {pollData.duration} minutes
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={pollData.duration}
                  onChange={(e) => setPollData({ ...pollData, duration: parseInt(e.target.value) })}
                  className="w-full accent-purple-600"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>1 min</span>
                  <span>5 min</span>
                  <span>10 min</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowPollModal(false)}
                  className="flex-1 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={createPoll}
                  className="flex-1 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
                >
                  Create Poll
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default CreatorShoppingControls;