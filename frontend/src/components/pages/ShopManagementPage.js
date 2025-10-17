import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../utils/supabase-auth';
import {
  ShoppingBagIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  PhotoIcon,
  CurrencyDollarIcon,
  TagIcon,
  ArchiveBoxIcon,
  ChartBarIcon,
  XMarkIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ClockIcon,
  TruckIcon,
  GiftIcon,
  SparklesIcon,
  CogIcon,
  EyeIcon,
  EyeSlashIcon,
  ArrowLeftIcon,
  ShoppingCartIcon,
  StarIcon,
  HeartIcon,
  ArrowTrendingUpIcon,
  BanknotesIcon,
  CalendarIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowUpTrayIcon,
  ChevronDownIcon,
  VideoCameraIcon,
  BoltIcon
} from '@heroicons/react/24/outline';
import { getAuthToken } from '../../utils/supabase-auth';
import { fetchWithRetry } from '../../utils/fetchWithRetry';
import toast from 'react-hot-toast';
import Button from '../ui/Button';
import Card from '../ui/Card';

const ShopManagementPage = ({ user }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('products');
  const [shopSettings, setShopSettings] = useState(null);
  const [shopItems, setShopItems] = useState([]);
  const [orders, setOrders] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [shopEnabled, setShopEnabled] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [selectedTimeRange, setSelectedTimeRange] = useState('week');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showOrderDetails, setShowOrderDetails] = useState(false);
  const [streamAnalytics, setStreamAnalytics] = useState(null);
  const [loadingStreamAnalytics, setLoadingStreamAnalytics] = useState(false);

  // New product form state
  const [productForm, setProductForm] = useState({
    name: '',
    description: '',
    price_tokens: '',
    category: 'digital',
    image_url: '',
    stock_quantity: null,
    is_active: true
  });
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchInitialData();
  }, [user]);

  useEffect(() => {
    if (activeTab === 'stream-analytics') {
      fetchStreamAnalytics();
    }
  }, [activeTab]);

  const fetchInitialData = async () => {
    if (!user) return;
    
    try {
      const authToken = await getAuthToken();
      
      // Fetch all data in parallel
      const [settingsRes, itemsRes, ordersRes, analyticsRes] = await Promise.all([
        fetchWithRetry(
          `${import.meta.env.VITE_BACKEND_URL}/api/shop/settings`,
          { headers: { Authorization: `Bearer ${authToken}` } }
        ),
        fetchWithRetry(
          `${import.meta.env.VITE_BACKEND_URL}/api/shop/items/manage?includeInactive=true`,
          { headers: { Authorization: `Bearer ${authToken}` } }
        ),
        fetchWithRetry(
          `${import.meta.env.VITE_BACKEND_URL}/api/shop/orders?limit=50`,
          { headers: { Authorization: `Bearer ${authToken}` } }
        ),
        fetchWithRetry(
          `${import.meta.env.VITE_BACKEND_URL}/api/shop/analytics`,
          { headers: { Authorization: `Bearer ${authToken}` } }
        )
      ]);

      if (settingsRes.ok) {
        const data = await settingsRes.json();
        setShopSettings(data.settings);
        setShopEnabled(data.settings?.is_enabled || false);
      }

      if (itemsRes.ok) {
        const data = await itemsRes.json();
        setShopItems(data.items || []);
      }

      if (ordersRes.ok) {
        const data = await ordersRes.json();
        setOrders(data.orders || []);
      }

      if (analyticsRes.ok) {
        const data = await analyticsRes.json();
        setAnalytics(data.analytics || {});
      }

      setLoading(false);
    } catch (error) {
      console.error('Error fetching shop data:', error);
      toast.error('Failed to load shop data');
      setLoading(false);
    }
  };

  const fetchStreamAnalytics = async () => {
    if (!user) return;
    
    setLoadingStreamAnalytics(true);
    try {
      const authToken = await getAuthToken();
      const response = await fetchWithRetry(
        `${import.meta.env.VITE_BACKEND_URL}/api/live-shopping/creator/stream-analytics`,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      
      if (response.ok) {
        const data = await response.json();
        setStreamAnalytics(data);
      }
    } catch (error) {
      console.error('Error fetching stream analytics:', error);
      toast.error('Failed to load stream analytics');
    } finally {
      setLoadingStreamAnalytics(false);
    }
  };

  const toggleShopStatus = async () => {
    try {
      const authToken = await getAuthToken();
      const response = await fetchWithRetry(
        `${import.meta.env.VITE_BACKEND_URL}/api/shop/settings`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`
          },
          body: JSON.stringify({ is_enabled: !shopEnabled })
        }
      );
      
      if (response.ok) {
        setShopEnabled(!shopEnabled);
        toast.success(shopEnabled ? 'Shop disabled' : 'Shop enabled');
      }
    } catch (error) {
      console.error('Error toggling shop:', error);
      toast.error('Failed to update shop status');
    }
  };

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image size must be less than 5MB');
        return;
      }
      
      // Check file type
      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file');
        return;
      }
      
      setSelectedImage(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadImageToSupabase = async (file) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `shop-products/${fileName}`;
      
      const { data, error } = await supabase.storage
        .from('shop-products')
        .upload(filePath, file);
      
      if (error) throw error;
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('shop-products')
        .getPublicUrl(filePath);
      
      return publicUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      throw error;
    }
  };

  const handleSaveProduct = async () => {
    // Validation
    if (!productForm.name.trim()) {
      toast.error('Product name is required');
      return;
    }
    if (!productForm.price || productForm.price <= 0) {
      toast.error('Please enter a valid price');
      return;
    }
    if (!productForm.image_url && !selectedImage) {
      toast.error('Please add a product image');
      return;
    }
    
    try {
      setUploadingImage(true);
      const authToken = await getAuthToken();
      
      let imageUrl = productForm.image_url;
      
      // Upload image if selected
      if (selectedImage) {
        imageUrl = await uploadImageToSupabase(selectedImage);
      }
      
      const endpoint = editingProduct 
        ? `${import.meta.env.VITE_BACKEND_URL}/api/shop/items/${editingProduct.id}`
        : `${import.meta.env.VITE_BACKEND_URL}/api/shop/items`;
      
      const response = await fetchWithRetry(endpoint, {
        method: editingProduct ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
          ...productForm,
          image_url: imageUrl,
          price_tokens: productForm.price
        })
      });

      if (response.ok) {
        toast.success(editingProduct ? 'Product updated' : 'Product added');
        setShowAddProduct(false);
        setEditingProduct(null);
        setProductForm({
          name: '',
          description: '',
          price: '',
          category: 'digital',
          image_url: '',
          stock_quantity: null,
          is_active: true
        });
        setSelectedImage(null);
        setImagePreview(null);
        fetchInitialData();
      }
    } catch (error) {
      console.error('Error saving product:', error);
      toast.error('Failed to save product');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleDeleteProduct = async (productId) => {
    if (!confirm('Are you sure you want to delete this product?')) return;

    try {
      const authToken = await getAuthToken();
      const response = await fetchWithRetry(
        `${import.meta.env.VITE_BACKEND_URL}/api/shop/items/${productId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${authToken}` }
        }
      );

      if (response.ok) {
        toast.success('Product deleted');
        fetchInitialData();
      }
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error('Failed to delete product');
    }
  };

  const updateOrderStatus = async (orderId, status) => {
    try {
      const authToken = await getAuthToken();
      await fetchWithRetry(
        `${import.meta.env.VITE_BACKEND_URL}/api/shop/orders/${orderId}/status`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`
          },
          body: JSON.stringify({ status })
        }
      );
      
      setOrders(orders.map(order => 
        order.id === orderId ? { ...order, status } : order
      ));
      toast.success('Order status updated');
    } catch (error) {
      console.error('Error updating order:', error);
      toast.error('Failed to update order status');
    }
  };

  // Filter products based on search
  const filteredProducts = shopItems.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Filter orders based on status
  const filteredOrders = orders.filter(order => 
    filterStatus === 'all' || order.status === filterStatus
  );

  // Calculate active listings
  const activeListings = shopItems.filter(item => item.is_active).length;

  const stats = [
    {
      label: 'Week Revenue',
      value: `${analytics?.total_week_tokens || 0} tokens`,
      change: analytics?.week_change || '+0%',
      trend: analytics?.week_trend || 'up',
      icon: CurrencyDollarIcon,
      color: 'green'
    },
    {
      label: 'Month Revenue',
      value: `${analytics?.total_month_tokens || 0} tokens`,
      change: analytics?.month_change || '+0%',
      trend: analytics?.month_trend || 'up',
      icon: BanknotesIcon,
      color: 'blue'
    },
    {
      label: 'Total Orders',
      value: orders.length,
      change: `${orders.filter(o => o.status === 'pending').length} pending`,
      trend: orders.length > 0 ? 'up' : 'neutral',
      icon: ShoppingCartIcon,
      color: 'purple'
    },
    {
      label: 'Active Listings',
      value: activeListings,
      change: `${shopItems.length} total`,
      trend: 'neutral',
      icon: ShoppingBagIcon,
      color: 'indigo'
    }
  ];

  const tabs = [
    { id: 'products', label: 'Products', mobileLabel: 'Products', icon: ShoppingBagIcon, count: shopItems.length },
    { id: 'analytics', label: 'Shop Analytics', mobileLabel: 'Analytics', icon: ChartBarIcon },
    { id: 'orders', label: 'Orders', mobileLabel: 'Orders', icon: TruckIcon, count: orders.length },
    { id: 'stream-analytics', label: 'Stream Sales', mobileLabel: 'Stream', icon: VideoCameraIcon },
    { id: 'settings', label: 'Settings', mobileLabel: 'Settings', icon: CogIcon }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading shop...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-24 md:pb-0">
      {/* Enhanced Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" style={{ maxWidth: '100vw' }}>
          <div className="py-4 sm:py-6">
            <div className="flex items-center justify-between">
              {/* Shop header */}
              <div className="flex items-center gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Shop Management
                  </h1>
                </div>
              </div>

              {/* Shop Status Toggle - Desktop only */}
              <div className="hidden md:flex items-center gap-3">
                <Button
                  onClick={() => {
                    const shopUrl = `${window.location.origin}/${user?.username}/shop`;
                    window.open(shopUrl, '_blank');
                  }}
                  variant="secondary"
                  className="flex items-center gap-2"
                >
                  <EyeIcon className="w-5 h-5" />
                  View Shop
                </Button>
                <Button
                  onClick={toggleShopStatus}
                  variant={shopEnabled ? 'primary' : 'secondary'}
                  className="flex items-center gap-2"
                >
                  {shopEnabled ? (
                    <>
                      <CheckCircleIcon className="w-5 h-5" />
                      Shop Enabled
                    </>
                  ) : (
                    <>
                      <EyeSlashIcon className="w-5 h-5" />
                      Shop Disabled
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Stats Grid - Hidden, moved to Analytics tab */}
          </div>
        </div>
      </div>

      {/* Navigation Tabs - Mobile Optimized */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8" style={{ maxWidth: '100vw' }}>
          <div className="grid grid-cols-5 md:flex md:gap-1 gap-1 py-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  relative
                  flex flex-col md:flex-row items-center justify-center
                  gap-0.5 md:gap-2
                  px-1 md:px-4 py-2 md:py-2.5
                  rounded-lg
                  transition-all
                  min-h-[52px] md:min-h-0
                  ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg transform scale-105'
                    : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600'
                }`}
                aria-label={tab.label}
              >
                <tab.icon className="w-5 h-5 md:w-5 md:h-5 flex-shrink-0" strokeWidth={activeTab === tab.id ? 2 : 1.5} />
                <span className="text-[9px] md:text-sm font-medium leading-tight text-center">
                  <span className="md:hidden">{tab.mobileLabel}</span>
                  <span className="hidden md:inline">{tab.label}</span>
                </span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span className={`
                    absolute -top-1 -right-1 md:relative md:top-0 md:right-0
                    inline-flex items-center justify-center
                    min-w-[18px] h-[18px] px-1 md:px-1.5
                    text-[10px] md:text-xs rounded-full
                    font-bold
                    ${
                    activeTab === tab.id
                      ? 'bg-white text-purple-600'
                      : 'bg-purple-600 text-white'
                  }`}>
                    {tab.count > 99 ? '99+' : tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6" style={{ maxWidth: '100vw', overflowX: 'hidden' }}>
        <AnimatePresence mode="wait">
          {/* Products Tab */}
          {activeTab === 'products' && (
            <motion.div
              key="products"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              {/* Products Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4 flex-1">
                  <div className="relative flex-1 max-w-md">
                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search products..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                  <button className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                    <FunnelIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  </button>
                </div>
              </div>

              {/* Products Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {/* Add Product Card */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setEditingProduct(null);
                    setProductForm({
                      name: '',
                      description: '',
                      price: '',
                      category: 'digital',
                      image_url: '',
                      stock_quantity: null,
                      is_active: true
                    });
                    setShowAddProduct(true);
                  }}
                  className="bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl shadow-md hover:shadow-xl transition-all cursor-pointer group border-2 border-dashed border-purple-300 dark:border-purple-700 hover:border-purple-400 dark:hover:border-purple-600 overflow-hidden"
                >
                  <div className="w-full h-48 flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/10 dark:to-pink-900/10">
                    <div className="text-center">
                      <div className="p-4 bg-white dark:bg-gray-800 rounded-full shadow-lg mb-4 inline-block group-hover:scale-110 transition-transform">
                        <PlusIcon className="w-10 h-10 text-purple-600 dark:text-purple-400" />
                      </div>
                      <p className="text-sm font-semibold text-purple-700 dark:text-purple-300">Add Product</p>
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900 dark:text-white">List a New Item</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Click to add a product to your shop
                    </p>
                    <div className="flex items-center justify-between mt-4">
                      <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">
                        Quick & Easy Setup
                      </span>
                      <SparklesIcon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    </div>
                  </div>
                </motion.div>

                {/* Existing Products */}
                {filteredProducts.map((product) => (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ y: -4 }}
                    className="bg-white dark:bg-gray-800 rounded-xl shadow-md hover:shadow-xl transition-all overflow-hidden"
                  >
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-full h-48 object-cover"
                      />
                    ) : (
                      <div className="w-full h-48 bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/20 dark:to-pink-900/20 flex items-center justify-center">
                        <PhotoIcon className="w-16 h-16 text-gray-400" />
                      </div>
                    )}
                    <div className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 dark:text-white">{product.name}</h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                            {product.description}
                          </p>
                        </div>
                        <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                          product.is_active 
                            ? 'bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400' 
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                        }`}>
                          {product.is_active ? 'Active' : 'Inactive'}
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-4">
                        <span className="text-xl font-bold text-purple-600 dark:text-purple-400">
                          {product.price} tokens
                        </span>
                        <div className="flex gap-1">
                          <button
                            onClick={() => {
                              // Store product for quick streaming
                              localStorage.setItem('quickStreamProduct', JSON.stringify(product));
                              toast.success('Product ready for streaming!');
                              navigate('/streaming');
                            }}
                            className="p-2 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors group relative"
                            title="Add to Live Stream"
                          >
                            <VideoCameraIcon className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                            <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                              Quick Add to Stream
                            </span>
                          </button>
                          <button
                            onClick={() => {
                              setEditingProduct(product);
                              setProductForm({
                                name: product.name,
                                description: product.description || '',
                                price: product.price || product.price_tokens || '',
                                category: product.category || 'digital',
                                image_url: product.image_url || '',
                                stock_quantity: product.stock_quantity,
                                is_active: product.is_active !== undefined ? product.is_active : true
                              });
                              setImagePreview(product.image_url || null);
                              setSelectedImage(null);
                              setShowAddProduct(true);
                            }}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                          >
                            <PencilIcon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(product.id)}
                            className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          >
                            <TrashIcon className="w-4 h-4 text-red-600 dark:text-red-400" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {filteredProducts.length === 0 && searchQuery && (
                <div className="col-span-full text-center py-12">
                  <MagnifyingGlassIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">No products found matching "{searchQuery}"</p>
                  <button
                    onClick={() => setSearchQuery('')}
                    className="mt-4 text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-medium"
                  >
                    Clear search
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {/* Orders Tab */}
          {activeTab === 'orders' && (
            <motion.div
              key="orders"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              {/* Orders Filter */}
              <div className="flex items-center gap-4">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value="all">All Orders</option>
                  <option value="pending">Pending</option>
                  <option value="processing">Processing</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <div className="flex-1">
                  <div className="relative">
                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search orders..."
                      className="w-full max-w-md pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              {/* Orders Table */}
              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Order ID
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Customer
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Product
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Total
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Date
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Shipping
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {filteredOrders.map((order) => (
                        <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                            #{order.id.slice(0, 8)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                            {order.buyer_username}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                            {order.item_name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-purple-600 dark:text-purple-400">
                            {order.total_tokens} tokens
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <select
                              value={order.status}
                              onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                              className={`text-xs px-2 py-1 rounded-full font-medium border-0 ${
                                order.status === 'completed' ? 'bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400' :
                                order.status === 'processing' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' :
                                order.status === 'cancelled' ? 'bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400' :
                                'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-400'
                              }`}
                            >
                              <option value="pending">Pending</option>
                              <option value="processing">Processing</option>
                              <option value="completed">Completed</option>
                              <option value="cancelled">Cancelled</option>
                            </select>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                            {new Date(order.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {order.shipping_address ? (
                              <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400 font-medium">
                                <TruckIcon className="w-3 h-3" />
                                Has Address
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 font-medium">
                                <ExclamationCircleIcon className="w-3 h-3" />
                                No Address
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <button 
                              onClick={() => {
                                setSelectedOrder(order);
                                setShowOrderDetails(true);
                              }}
                              className="text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-medium"
                            >
                              View Details
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {filteredOrders.length === 0 && (
                  <div className="text-center py-12">
                    <TruckIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-400">No orders yet</p>
                  </div>
                )}
              </Card>
            </motion.div>
          )}

          {/* Analytics Tab */}
          {activeTab === 'analytics' && (
            <motion.div
              key="analytics"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              {/* Stats Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((stat, index) => (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card className="p-4 hover:shadow-lg transition-shadow">
                      <div className="flex items-center justify-between">
                        <div className={`p-2 bg-${stat.color}-100 dark:bg-${stat.color}-900/20 rounded-lg`}>
                          <stat.icon className={`w-6 h-6 text-${stat.color}-600 dark:text-${stat.color}-400`} />
                        </div>
                        {stat.trend === 'up' ? (
                          <span className="text-green-600 dark:text-green-400 text-sm font-medium flex items-center gap-1">
                            <ArrowTrendingUpIcon className="w-4 h-4" />
                            {stat.change}
                          </span>
                        ) : (
                          <span className="text-red-600 dark:text-red-400 text-sm font-medium">
                            {stat.change}
                          </span>
                        )}
                      </div>
                      <p className="text-xl font-bold text-gray-900 dark:text-white mt-3">{stat.value}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{stat.label}</p>
                    </Card>
                  </motion.div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Revenue Chart */}
                <Card className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Revenue Overview</h3>
                    <select className="text-sm px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800">
                      <option>Last 7 days</option>
                      <option>Last 30 days</option>
                      <option>Last 3 months</option>
                    </select>
                  </div>
                  <div className="h-64 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                    <ChartBarIcon className="w-12 h-12 text-gray-400" />
                  </div>
                </Card>

                {/* Top Products */}
                <Card className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Top Products</h3>
                  <div className="space-y-3">
                    {shopItems.slice(0, 5).map((product, index) => (
                      <div key={product.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                            {index + 1}
                          </span>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{product.name}</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {Math.floor(Math.random() * 50)} sales
                            </p>
                          </div>
                        </div>
                        <span className="font-semibold text-purple-600 dark:text-purple-400">
                          {product.price * Math.floor(Math.random() * 50)} tokens
                        </span>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </motion.div>
          )}


          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <Card className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Shop Settings</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Shop Status</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Enable or disable your shop</p>
                    </div>
                    <button
                      onClick={toggleShopStatus}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        shopEnabled ? 'bg-purple-600' : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          shopEnabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Email Notifications</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Receive email alerts for new orders</p>
                    </div>
                    <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-purple-600">
                      <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-6" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Auto-fulfill Digital Products</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Automatically deliver digital products after purchase</p>
                    </div>
                    <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-purple-600">
                      <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-6" />
                    </button>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}

          {/* Stream Analytics Tab */}
          {activeTab === 'stream-analytics' && (
            <motion.div
              key="stream-analytics"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              {loadingStreamAnalytics ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
                </div>
              ) : streamAnalytics ? (
                <>
                  {/* Stream Sales Overview */}
                  <Card className="p-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <VideoCameraIcon className="w-5 h-5 text-purple-600" />
                      Live Stream Sales Performance
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                      <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600">Total Stream Sales</p>
                        <p className="text-2xl font-bold text-purple-600">
                          {streamAnalytics?.totalSales || 0} tokens
                        </p>
                      </div>
                      <div className="bg-gradient-to-r from-blue-50 to-cyan-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600">Products Sold</p>
                        <p className="text-2xl font-bold text-blue-600">
                          {streamAnalytics?.productsSold || 0}
                        </p>
                      </div>
                      <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600">Conversion Rate</p>
                        <p className="text-2xl font-bold text-green-600">
                          {streamAnalytics?.conversionRate || 0}%
                        </p>
                      </div>
                      <div className="bg-gradient-to-r from-orange-50 to-yellow-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600">Avg Order Value</p>
                        <p className="text-2xl font-bold text-orange-600">
                          {streamAnalytics?.avgOrderValue || 0} tokens
                        </p>
                      </div>
                    </div>

                    {/* Recent Stream Sales */}
                    <div className="mt-6">
                      <h4 className="font-medium mb-3">Recent Stream Sales</h4>
                      <div className="space-y-3">
                        {streamAnalytics?.recentSales?.map((sale, index) => (
                          <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                                <ShoppingBagIcon className="w-5 h-5 text-purple-600" />
                              </div>
                              <div>
                                <p className="font-medium">{sale.productName}</p>
                                <p className="text-sm text-gray-500">
                                  Stream: {sale.streamTitle} • {new Date(sale.purchasedAt).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold">{sale.price} tokens</p>
                              <p className="text-sm text-gray-500">Qty: {sale.quantity}</p>
                            </div>
                          </div>
                        )) || (
                          <p className="text-gray-500 text-center py-4">No stream sales yet</p>
                        )}
                      </div>
                    </div>

                    {/* Top Performing Products in Streams */}
                    <div className="mt-6">
                      <h4 className="font-medium mb-3">Top Products in Live Streams</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {streamAnalytics?.topProducts?.map((product, index) => (
                          <div key={index} className="border rounded-lg p-4">
                            <div className="flex items-start justify-between mb-2">
                              <h5 className="font-medium">{product.name}</h5>
                              <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
                                #{index + 1}
                              </span>
                            </div>
                            <div className="space-y-1 text-sm">
                              <div className="flex justify-between">
                                <span className="text-gray-500">Sold:</span>
                                <span className="font-medium">{product.soldCount}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Revenue:</span>
                                <span className="font-medium">{product.revenue} tokens</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Views:</span>
                                <span className="font-medium">{product.views}</span>
                              </div>
                            </div>
                          </div>
                        )) || (
                          <p className="text-gray-500 col-span-3 text-center">No product data available</p>
                        )}
                      </div>
                    </div>

                    {/* Flash Sale Performance */}
                    {streamAnalytics?.flashSales && streamAnalytics.flashSales.length > 0 && (
                      <div className="mt-6">
                        <h4 className="font-medium mb-3 flex items-center gap-2">
                          <BoltIcon className="w-5 h-5 text-yellow-500" />
                          Flash Sale Performance
                        </h4>
                        <div className="space-y-2">
                          {streamAnalytics.flashSales.map((sale, index) => (
                            <div key={index} className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                              <div>
                                <p className="font-medium">{sale.productName}</p>
                                <p className="text-sm text-gray-600">
                                  {sale.discount}% off • {sale.duration} min
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="font-semibold text-green-600">
                                  {sale.unitsSold} sold
                                </p>
                                <p className="text-sm text-gray-500">
                                  {sale.revenue} tokens
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </Card>
                </>
              ) : (
                <Card className="p-12 text-center">
                  <VideoCameraIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Stream Sales Data</h3>
                  <p className="text-gray-500 mb-4">
                    Start selling products during your live streams to see analytics here
                  </p>
                  <button
                    onClick={() => navigate('/streaming')}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                  >
                    Go Live Now
                  </button>
                </Card>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Add/Edit Product Modal */}
      <AnimatePresence>
        {showAddProduct && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[9999]"
            role="dialog"
            aria-modal="true"
            onClick={() => setShowAddProduct(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6 z-10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl">
                      <ShoppingBagIcon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                        {editingProduct ? 'Edit Product' : 'Add Product'}
                      </h2>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {editingProduct ? 'Update your product details' : 'Create a new product for your shop'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setShowAddProduct(false);
                      setEditingProduct(null);
                      setSelectedImage(null);
                      setImagePreview(null);
                    }}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <XMarkIcon className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                  </button>
                </div>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left Column - Image Upload */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Product Image <span className="text-red-500">*</span>
                      </label>
                      
                      {/* Image Preview Area */}
                      <div className="relative">
                        {(imagePreview || productForm.image_url) ? (
                          <div className="relative group">
                            <img
                              src={imagePreview || productForm.image_url}
                              alt="Product preview"
                              className="w-full h-64 object-cover rounded-xl border-2 border-gray-200 dark:border-gray-600"
                            />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center">
                              <button
                                onClick={() => fileInputRef.current?.click()}
                                className="px-4 py-2 bg-white text-gray-900 rounded-lg font-medium hover:bg-gray-100 transition-colors"
                              >
                                Change Image
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full h-64 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-purple-500 dark:hover:border-purple-400 transition-colors bg-gray-50 dark:bg-gray-900"
                          >
                            <ArrowUpTrayIcon className="w-12 h-12 text-gray-400 mb-3" />
                            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              Click to upload image
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              PNG, JPG up to 5MB
                            </p>
                          </div>
                        )}
                        
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleImageSelect}
                          className="hidden"
                        />
                      </div>
                      
                      {/* Alternative: Image URL Input */}
                      <div className="mt-4">
                        <div className="relative">
                          <input
                            type="text"
                            value={productForm.image_url}
                            onChange={(e) => {
                              setProductForm({ ...productForm, image_url: e.target.value });
                              setImagePreview(null);
                              setSelectedImage(null);
                            }}
                            className="w-full px-4 py-2 pl-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
                            placeholder="Or paste image URL"
                          />
                          <PhotoIcon className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
                        </div>
                      </div>
                    </div>

                    {/* Stock Quantity */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Stock Quantity
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          value={productForm.stock_quantity || ''}
                          onChange={(e) => setProductForm({ ...productForm, stock_quantity: e.target.value ? parseInt(e.target.value) : null })}
                          className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          placeholder="Unlimited"
                          min="0"
                        />
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          Leave empty for unlimited
                        </span>
                      </div>
                    </div>

                    {/* Active Status */}
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <label htmlFor="is_active" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Product Status
                          </label>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Active products are visible in your shop
                          </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            id="is_active"
                            checked={productForm.is_active}
                            onChange={(e) => setProductForm({ ...productForm, is_active: e.target.checked })}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-purple-600"></div>
                          <span className="ml-2 text-sm font-medium text-gray-900 dark:text-gray-300">
                            {productForm.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Right Column - Product Details */}
                  <div className="space-y-4">
                    {/* Product Name */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Product Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={productForm.name}
                        onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
                        placeholder="Enter product name"
                        maxLength={100}
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {productForm.name.length}/100 characters
                      </p>
                    </div>

                    {/* Description */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Description
                      </label>
                      <textarea
                        value={productForm.description}
                        onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 resize-none"
                        rows={4}
                        placeholder="Describe your product..."
                        maxLength={500}
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {productForm.description.length}/500 characters
                      </p>
                    </div>

                    {/* Price and Category */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Price (Tokens) <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            value={productForm.price}
                            onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                            className="w-full px-4 py-2 pl-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            placeholder="0"
                            min="1"
                          />
                          <SparklesIcon className="absolute left-3 top-2.5 w-5 h-5 text-purple-500" />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Category
                        </label>
                        <select
                          value={productForm.category}
                          onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        >
                          <optgroup label="📸 Memorabilia & Collectibles">
                            <option value="polaroid">Signed Polaroid</option>
                            <option value="letter">Handwritten Letter</option>
                            <option value="clothing">Worn Clothing Item</option>
                            <option value="poster">Signed Poster</option>
                            <option value="workout-gear">Used Workout Gear</option>
                            <option value="accessories">Personal Accessories</option>
                          </optgroup>
                          <optgroup label="💌 Romantic/Personal">
                            <option value="love-letter">Love Letter</option>
                            <option value="perfumed-card">Perfumed Card</option>
                            <option value="kiss-print">Lipstick Kiss Print</option>
                            <option value="date-outfit">Date Night Outfit</option>
                          </optgroup>
                          <optgroup label="👕 Branded Merchandise">
                            <option value="hoodie">Signature Hoodie</option>
                            <option value="workout-set">Workout Set</option>
                            <option value="pajamas">Silk Pajama Set</option>
                            <option value="artwork">Handmade Artwork</option>
                          </optgroup>
                          <optgroup label="📚 Digital Products">
                            <option value="ebook">Fitness/Beauty Guide</option>
                            <option value="video-message">Video Message</option>
                            <option value="voice-recording">Voice Recording</option>
                          </optgroup>
                        </select>
                      </div>
                    </div>

                    {/* Important Disclaimer for Physical Products */}
                    {(productForm.category !== 'ebook' && productForm.category !== 'video-message' && productForm.category !== 'voice-recording') && (
                      <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-200 dark:border-amber-800">
                        <div className="flex items-start gap-3">
                          <ExclamationCircleIcon className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-amber-900 dark:text-amber-300 mb-2">
                              Important: Physical Product Terms
                            </p>
                            <ul className="text-xs text-amber-800 dark:text-amber-400 space-y-1 list-disc list-inside">
                              <li>All transactions are directly between you and the fan</li>
                              <li>Digis does NOT handle shipping, returns, or customer service</li>
                              <li>You are responsible for fulfilling all orders</li>
                              <li>All sales are final and non-refundable</li>
                              <li>You must handle shipping addresses and delivery</li>
                              <li>Ensure you comply with all local laws and regulations</li>
                            </ul>
                            <p className="text-xs text-amber-700 dark:text-amber-500 mt-2 font-medium">
                              By listing physical items, you agree to these terms.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Success Preview */}
                    {productForm.name && productForm.price && (productForm.image_url || imagePreview) && (
                      <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4">
                        <div className="flex items-start gap-3">
                          <CheckCircleIcon className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-green-900 dark:text-green-300">
                              Ready to publish!
                            </p>
                            <p className="text-xs text-green-700 dark:text-green-400 mt-1">
                              Your product will be {productForm.is_active ? 'immediately visible' : 'saved as draft'} in your shop.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="flex gap-3 mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                  <Button
                    onClick={() => {
                      setShowAddProduct(false);
                      setEditingProduct(null);
                      setSelectedImage(null);
                      setImagePreview(null);
                    }}
                    variant="secondary"
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSaveProduct}
                    disabled={uploadingImage}
                    className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                  >
                    {uploadingImage ? (
                      <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Uploading...
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        {editingProduct ? (
                          <>
                            <CheckCircleIcon className="w-5 h-5" />
                            Update Product
                          </>
                        ) : (
                          <>
                            <PlusIcon className="w-5 h-5" />
                            Add Product
                          </>
                        )}
                      </div>
                    )}
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Order Details Modal */}
      <AnimatePresence>
        {showOrderDetails && selectedOrder && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
            onClick={() => {
              setShowOrderDetails(false);
              setSelectedOrder(null);
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6 z-10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl">
                      <TruckIcon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                        Order Details
                      </h2>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Order #{selectedOrder.id.slice(0, 8)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setShowOrderDetails(false);
                      setSelectedOrder(null);
                    }}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <XMarkIcon className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-6">
                {/* Order Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Customer</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {selectedOrder.buyer_username}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Date</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {new Date(selectedOrder.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Status</p>
                    <select
                      value={selectedOrder.status}
                      onChange={(e) => {
                        updateOrderStatus(selectedOrder.id, e.target.value);
                        setSelectedOrder({ ...selectedOrder, status: e.target.value });
                      }}
                      className={`text-sm px-3 py-1 rounded-full font-medium border-0 ${
                        selectedOrder.status === 'completed' ? 'bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400' :
                        selectedOrder.status === 'processing' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' :
                        selectedOrder.status === 'cancelled' ? 'bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400' :
                        'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-400'
                      }`}
                    >
                      <option value="pending">Pending</option>
                      <option value="processing">Processing</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total</p>
                    <p className="font-medium text-purple-600 dark:text-purple-400">
                      {selectedOrder.total_tokens} tokens
                    </p>
                  </div>
                </div>

                {/* Product Info */}
                <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Product Information</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Product Name:</span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{selectedOrder.item_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Quantity:</span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{selectedOrder.quantity || 1}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Price per Item:</span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {selectedOrder.price_per_item || selectedOrder.total_tokens} tokens
                      </span>
                    </div>
                  </div>
                </div>

                {/* Shipping Address */}
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <TruckIcon className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-300">
                      Shipping Information
                    </h3>
                  </div>
                  {selectedOrder.shipping_address ? (
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-amber-200 dark:border-amber-800">
                      <p className="text-sm text-gray-900 dark:text-white font-medium mb-1">
                        {selectedOrder.shipping_address.name}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {selectedOrder.shipping_address.street}
                      </p>
                      {selectedOrder.shipping_address.apt && (
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {selectedOrder.shipping_address.apt}
                        </p>
                      )}
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {selectedOrder.shipping_address.city}, {selectedOrder.shipping_address.state} {selectedOrder.shipping_address.zip}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {selectedOrder.shipping_address.country}
                      </p>
                      {selectedOrder.shipping_address.phone && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                          Phone: {selectedOrder.shipping_address.phone}
                        </p>
                      )}
                      {selectedOrder.shipping_address.email && (
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Email: {selectedOrder.shipping_address.email}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 border border-red-200 dark:border-red-800">
                      <div className="flex items-center gap-2">
                        <ExclamationCircleIcon className="w-5 h-5 text-red-600 dark:text-red-400" />
                        <div>
                          <p className="text-sm font-medium text-red-900 dark:text-red-300">
                            No shipping address provided
                          </p>
                          <p className="text-xs text-red-700 dark:text-red-400 mt-1">
                            Contact the customer to obtain shipping information
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Order Notes */}
                {selectedOrder.notes && (
                  <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Order Notes</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {selectedOrder.notes}
                    </p>
                  </div>
                )}

                {/* Important Reminder */}
                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <ExclamationCircleIcon className="w-5 h-5 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-purple-900 dark:text-purple-300 mb-2">
                        Creator Responsibilities
                      </p>
                      <ul className="text-xs text-purple-700 dark:text-purple-400 space-y-1 list-disc list-inside">
                        <li>You are responsible for shipping this item to the customer</li>
                        <li>Mark as "Processing" when you begin preparing the order</li>
                        <li>Mark as "Completed" only after the item has been shipped</li>
                        <li>Provide tracking information to the customer if available</li>
                        <li>All sales are final - handle any issues directly with the customer</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <Button
                    onClick={() => {
                      // Copy shipping address to clipboard
                      if (selectedOrder.shipping_address) {
                        const address = `${selectedOrder.shipping_address.name}
${selectedOrder.shipping_address.street}
${selectedOrder.shipping_address.apt ? selectedOrder.shipping_address.apt + '\n' : ''}${selectedOrder.shipping_address.city}, ${selectedOrder.shipping_address.state} ${selectedOrder.shipping_address.zip}
${selectedOrder.shipping_address.country}`;
                        navigator.clipboard.writeText(address);
                        toast.success('Address copied to clipboard');
                      } else {
                        toast.error('No shipping address available');
                      }
                    }}
                    variant="secondary"
                    className="flex-1 flex items-center justify-center gap-2"
                    disabled={!selectedOrder.shipping_address}
                  >
                    <TruckIcon className="w-5 h-5" />
                    Copy Address
                  </Button>
                  <Button
                    onClick={() => {
                      setShowOrderDetails(false);
                      setSelectedOrder(null);
                    }}
                    className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600"
                  >
                    Close
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ShopManagementPage;