import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
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
  ArrowUpTrayIcon
} from '@heroicons/react/24/outline';
import { supabase } from '../utils/supabase-auth';
import { getAuthToken } from '../utils/supabase-auth';
import { fetchWithRetry } from '../utils/fetchWithRetry';
import toast from 'react-hot-toast';

const CreatorShopManagement = ({ 
  user, 
  onClose, 
  isModal = true, 
  hideHeader = false,
  externalActiveTab = null,
  onTabChange = null,
  availableTabs = null
}) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(externalActiveTab || 'items');
  const [shopSettings, setShopSettings] = useState(null);
  const [shopItems, setShopItems] = useState([]);
  const [orders, setOrders] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false); // Start with false to show modal immediately
  const [dataLoading, setDataLoading] = useState(true); // Track data loading separately
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [shopEnabled, setShopEnabled] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef(null);
  const [productForm, setProductForm] = useState({
    name: '',
    description: '',
    price: '',
    category: 'polaroid',
    image_url: '',
    stock_quantity: null,
    is_active: true
  });

  // Sync with external tab changes
  useEffect(() => {
    if (externalActiveTab && externalActiveTab !== activeTab) {
      setActiveTab(externalActiveTab);
    }
  }, [externalActiveTab]);

  // Handle tab changes
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (onTabChange) {
      onTabChange(tab);
    }
  };

  useEffect(() => {
    // Load only essential data initially
    if (initialLoad) {
      fetchInitialData();
      setInitialLoad(false);
    }
  }, [initialLoad]);

  // Fast initial load - only fetch essential data
  const fetchInitialData = async () => {
    try {
      const authToken = await getAuthToken();
      
      // Check settings first
      const settingsRes = await fetchWithRetry(
        `${import.meta.env.VITE_BACKEND_URL}/shop/settings`,
        {
          headers: { Authorization: `Bearer ${authToken}` }
        }
      );
      const settingsData = await settingsRes.json();
      
      if (!settingsData.settings) {
        // Initialize shop if not exists
        await initializeShop();
      } else {
        setShopSettings(settingsData.settings);
        setShopEnabled(settingsData.settings.is_enabled);
      }
      
      setDataLoading(false);
      
      // Load other data in parallel after modal opens
      fetchRemainingData();
    } catch (error) {
      console.error('Error fetching initial data:', error);
      toast.error('Failed to load shop');
      setDataLoading(false);
    }
  };

  // Load remaining data in parallel
  const fetchRemainingData = async () => {
    try {
      const authToken = await getAuthToken();
      
      // Fetch all data in parallel
      const [itemsRes, ordersRes, analyticsRes] = await Promise.all([
        fetchWithRetry(
          `${import.meta.env.VITE_BACKEND_URL}/shop/items/manage?includeInactive=true`,
          { headers: { Authorization: `Bearer ${authToken}` } }
        ),
        fetchWithRetry(
          `${import.meta.env.VITE_BACKEND_URL}/shop/orders?limit=20`,
          { headers: { Authorization: `Bearer ${authToken}` } }
        ),
        fetchWithRetry(
          `${import.meta.env.VITE_BACKEND_URL}/shop/analytics`,
          { headers: { Authorization: `Bearer ${authToken}` } }
        )
      ]);
      
      const [itemsData, ordersData, analyticsData] = await Promise.all([
        itemsRes.json(),
        ordersRes.json(),
        analyticsRes.json()
      ]);
      
      setShopItems(itemsData.items || []);
      setOrders(ordersData.orders || []);
      setAnalytics(analyticsData.analytics);
    } catch (error) {
      console.error('Error fetching remaining data:', error);
    }
  };

  // Refresh all data
  const fetchShopData = async () => {
    setDataLoading(true);
    await fetchInitialData();
  };

  const initializeShop = async () => {
    try {
      const authToken = await getAuthToken();
      const res = await fetchWithRetry(
        `${import.meta.env.VITE_BACKEND_URL}/shop/initialize`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`
          },
          body: JSON.stringify({
            shopName: `${user.username}'s Shop`
          })
        }
      );
      const data = await res.json();
      setShopSettings(data.settings);
      setShopEnabled(data.settings.is_enabled);
      toast.success('Shop initialized successfully!');
    } catch (error) {
      console.error('Error initializing shop:', error);
      toast.error('Failed to initialize shop');
    }
  };

  const toggleShopStatus = async () => {
    try {
      const authToken = await getAuthToken();
      const newStatus = !shopEnabled;
      
      await fetchWithRetry(
        `${import.meta.env.VITE_BACKEND_URL}/shop/settings`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`
          },
          body: JSON.stringify({
            isEnabled: newStatus
          })
        }
      );
      
      setShopEnabled(newStatus);
      toast.success(`Shop ${newStatus ? 'enabled' : 'disabled'} successfully!`);
    } catch (error) {
      console.error('Error toggling shop status:', error);
      toast.error('Failed to update shop status');
    }
  };

  const handleDeleteItem = async (itemId) => {
    if (!confirm('Are you sure you want to delete this item?')) return;
    
    try {
      const authToken = await getAuthToken();
      await fetchWithRetry(
        `${import.meta.env.VITE_BACKEND_URL}/shop/items/${itemId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${authToken}` }
        }
      );
      
      setShopItems(shopItems.filter(item => item.id !== itemId));
      toast.success('Item deleted successfully!');
    } catch (error) {
      console.error('Error deleting item:', error);
      toast.error('Failed to delete item');
    }
  };

  const handleUpdateOrderStatus = async (orderId, status) => {
    try {
      const authToken = await getAuthToken();
      await fetchWithRetry(
        `${import.meta.env.VITE_BACKEND_URL}/shop/orders/${orderId}/status`,
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
      toast.success('Order status updated!');
    } catch (error) {
      console.error('Error updating order:', error);
      toast.error('Failed to update order status');
    }
  };

  // If not a modal and no onClose prop, create a default handler
  const handleClose = onClose || (() => {
    // If used as a page component, navigate back or to dashboard
    navigate('/dashboard');
  });

  const content = (
    <motion.div
      initial={{ opacity: isModal ? 0 : 1, scale: isModal ? 0.9 : 1 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: isModal ? 0 : 1, scale: isModal ? 0.9 : 1 }}
      className={isModal ? "bg-white rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl" : "bg-white w-full h-full flex flex-col"}
      onClick={isModal ? (e) => e.stopPropagation() : undefined}
    >
        {/* Header - Only show if not hidden */}
        {!hideHeader && (
          <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-white/20 rounded-xl">
                  <ShoppingBagIcon className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">Shop Management</h2>
                  <p className="text-white/80">Manage your products and orders</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    const username = user?.username || user?.email?.split('@')[0];
                    // Get the current origin (e.g., http://localhost:3003 or https://digis.cc)
                    const shopUrl = `${window.location.origin}/${username}/shop`;
                    window.open(shopUrl, '_blank');
                  }}
                  className="px-4 py-2 bg-white text-purple-600 hover:bg-gray-100 rounded-lg flex items-center gap-2 transition-all font-medium"
                  title="View your public shop page"
                >
                  <EyeIcon className="w-5 h-5" />
                  View Shop
                </button>
                <button
                  onClick={toggleShopStatus}
                  className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all ${
                    shopEnabled 
                      ? 'bg-white/20 text-white hover:bg-white/30' 
                      : 'bg-white/20 text-white hover:bg-white/30'
                  }`}
                >
                  {shopEnabled ? (
                    <>
                      <CheckCircleIcon className="w-5 h-5" />
                      Enabled
                    </>
                  ) : (
                    <>
                      <EyeSlashIcon className="w-5 h-5" />
                      Disabled
                    </>
                  )}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClose();
                  }}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                  aria-label="Close"
                >
                  <XMarkIcon className="w-6 h-6 text-white" />
                </button>
              </div>
            </div>

            {/* Quick Stats */}
            {analytics && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                <QuickStat
                  icon={ArchiveBoxIcon}
                  label="Orders Week"
                  value={analytics.orders_week || 0}
                  subtext="last 7 days"
                />
                <QuickStat
                  icon={CurrencyDollarIcon}
                  label="Total Week"
                  value={analytics.total_week_tokens || 0}
                  subtext="tokens"
                />
                <QuickStat
                  icon={ShoppingBagIcon}
                  label="Orders Month"
                  value={analytics.orders_month || 0}
                  subtext="last 30 days"
                />
                <QuickStat
                  icon={SparklesIcon}
                  label="Total Month"
                  value={analytics.total_month_tokens || 0}
                  subtext="tokens"
                />
              </div>
            )}
          </div>
        )}

        {/* Tabs - Use external tabs if provided, otherwise use default */}
        {!hideHeader && (
          <div className="bg-gray-50 p-2 border-b border-gray-200">
            <div className="flex gap-2">
              {(availableTabs || [
                { id: 'items', label: 'Products', icon: ArchiveBoxIcon, count: shopItems.length },
                { id: 'orders', label: 'Orders', icon: TruckIcon, count: orders.length },
                { id: 'analytics', label: 'Analytics', icon: ChartBarIcon },
                { id: 'settings', label: 'Settings', icon: CogIcon }
              ]).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all ${
                    activeTab === tab.id
                      ? 'bg-purple-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <tab.icon className="w-5 h-5" />
                  {tab.label}
                  {tab.count !== undefined && (
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      activeTab === tab.id ? 'bg-purple-700' : 'bg-gray-200 text-gray-600'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
          <AnimatePresence mode="wait">
            {/* Items Tab */}
            {activeTab === 'items' && (
              <motion.div
                key="items"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-bold text-gray-900">Your Products</h3>
                  <button
                    onClick={() => {
                      setEditingItem(null);
                      setShowItemModal(true);
                    }}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-2 transition-colors shadow-sm"
                  >
                    <PlusIcon className="w-5 h-5" />
                    Add Product
                  </button>
                </div>

                {dataLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                  </div>
                ) : shopItems.length === 0 ? (
                  <EmptyState
                    icon={ArchiveBoxIcon}
                    title="No products yet"
                    description="Click 'Add Product' above to start selling"
                  />
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {shopItems.map((item) => (
                      <ProductCard
                        key={item.id}
                        item={item}
                        onEdit={() => {
                          setEditingItem(item);
                          setShowItemModal(true);
                        }}
                        onDelete={() => handleDeleteItem(item.id)}
                      />
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* Orders Tab */}
            {activeTab === 'orders' && (
              <motion.div
                key="orders"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                <h3 className="text-xl font-bold text-gray-900">Recent Orders</h3>
                
                {orders.length === 0 ? (
                  <EmptyState
                    icon={TruckIcon}
                    title="No orders yet"
                    description="Orders will appear here when customers make purchases"
                  />
                ) : (
                  <div className="space-y-4">
                    {orders.map((order) => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        onUpdateStatus={(status) => handleUpdateOrderStatus(order.id, status)}
                      />
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* Analytics Tab */}
            {activeTab === 'analytics' && (
              <motion.div
                key="analytics"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                <ShopAnalytics analytics={analytics} items={shopItems} />
              </motion.div>
            )}

            {/* Settings Tab */}
            {activeTab === 'settings' && (
              <motion.div
                key="settings"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                <ShopSettings 
                  settings={shopSettings} 
                  onUpdate={fetchShopData}
                  user={user}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    );

  // Wrap content in modal backdrop if it's a modal
  if (isModal || onClose) {
    return (
      <>
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleClose();
            }
          }}
        >
          {content}
        </div>

        {/* Item Modal */}
        <AnimatePresence>
          {showItemModal && (
            <ItemModal
              item={editingItem}
              onClose={() => {
                setShowItemModal(false);
                setEditingItem(null);
              }}
              onSuccess={() => {
                setShowItemModal(false);
                setEditingItem(null);
                fetchShopData();
              }}
            />
          )}
        </AnimatePresence>
      </>
    );
  }

  // Return content directly if used as a page component
  return (
    <>
      {content}
      
      {/* Item Modal */}
      <AnimatePresence>
        {showItemModal && (
          <ItemModal
            item={editingItem}
            onClose={() => {
              setShowItemModal(false);
              setEditingItem(null);
            }}
            onSuccess={() => {
              setShowItemModal(false);
              setEditingItem(null);
              fetchShopData();
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
};

// Quick Stat Component
const QuickStat = ({ icon: Icon, label, value, subtext }) => (
  <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
    <div className="flex items-center justify-between mb-2">
      <Icon className="w-5 h-5 text-purple-600" />
    </div>
    <p className="text-gray-500 text-xs">{label}</p>
    <p className="text-xl font-bold text-gray-900">{value}</p>
    {subtext && <p className="text-xs text-gray-400 mt-1">{subtext}</p>}
  </div>
);

// Product Card Component
const ProductCard = ({ item, onEdit, onDelete }) => (
  <motion.div
    whileHover={{ scale: 1.02 }}
    className="bg-white rounded-xl overflow-hidden border border-gray-200 hover:border-purple-500 shadow-sm hover:shadow-md transition-all"
  >
    {item.images && item.images.length > 0 ? (
      <img 
        src={item.images[0]} 
        alt={item.name}
        className="w-full h-48 object-cover"
      />
    ) : (
      <div className="w-full h-48 bg-gray-100 flex items-center justify-center">
        <PhotoIcon className="w-12 h-12 text-gray-400" />
      </div>
    )}
    
    <div className="p-4">
      <div className="flex items-start justify-between mb-2">
        <h4 className="text-gray-900 font-semibold flex-1">{item.name}</h4>
        {!item.is_active && (
          <span className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded">
            Inactive
          </span>
        )}
      </div>
      
      <p className="text-gray-600 text-sm mb-3 line-clamp-2">
        {item.description || 'No description'}
      </p>
      
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-3">
          <span className="text-green-400 font-bold">${item.price_usd}</span>
          {item.price_tokens && (
            <span className="text-purple-400">{item.price_tokens} tokens</span>
          )}
        </div>
        {item.stock_quantity !== -1 && (
          <span className="text-xs text-gray-500">
            Stock: {item.stock_quantity}
          </span>
        )}
      </div>
      
      <div className="flex gap-2">
        <button
          onClick={onEdit}
          className="flex-1 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm transition-colors flex items-center justify-center gap-1"
        >
          <PencilIcon className="w-4 h-4" />
          Edit
        </button>
        <button
          onClick={onDelete}
          className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-sm transition-colors"
        >
          <TrashIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  </motion.div>
);

// Order Card Component
const OrderCard = ({ order, onUpdateStatus }) => {
  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'text-yellow-400 bg-yellow-500/20';
      case 'processing': return 'text-blue-400 bg-blue-500/20';
      case 'shipped': return 'text-purple-400 bg-purple-500/20';
      case 'delivered': return 'text-green-400 bg-green-500/20';
      case 'cancelled': return 'text-red-400 bg-red-500/20';
      default: return 'text-gray-400 bg-gray-500/20';
    }
  };

  return (
    <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-gray-900 font-semibold">{order.order_number}</p>
          <p className="text-sm text-gray-400">
            {new Date(order.created_at).toLocaleDateString()}
          </p>
        </div>
        <span className={`px-3 py-1 rounded-lg text-sm ${getStatusColor(order.status)}`}>
          {order.status}
        </span>
      </div>
      
      <div className="space-y-2 mb-3">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Item:</span>
          <span className="text-gray-900">{order.item_name}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Quantity:</span>
          <span className="text-gray-900">{order.quantity}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Payment:</span>
          <span className="text-gray-900">
            {order.payment_method === 'stripe' 
              ? `$${order.amount_usd}` 
              : `${order.amount_tokens} tokens`}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Buyer:</span>
          <span className="text-gray-900">{order.buyer_email}</span>
        </div>
      </div>
      
      {order.status !== 'delivered' && order.status !== 'cancelled' && (
        <div className="flex gap-2">
          {order.status === 'pending' && (
            <button
              onClick={() => onUpdateStatus('processing')}
              className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
            >
              Mark Processing
            </button>
          )}
          {order.status === 'processing' && !order.is_digital && (
            <button
              onClick={() => onUpdateStatus('shipped')}
              className="flex-1 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm transition-colors"
            >
              Mark Shipped
            </button>
          )}
          {(order.status === 'shipped' || (order.status === 'processing' && order.is_digital)) && (
            <button
              onClick={() => onUpdateStatus('delivered')}
              className="flex-1 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm transition-colors"
            >
              Mark Delivered
            </button>
          )}
          <button
            onClick={() => onUpdateStatus('cancelled')}
            className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-sm transition-colors"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
};

// Shop Analytics Component
const ShopAnalytics = ({ analytics, items }) => {
  if (!analytics) return null;

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-bold text-gray-900">Shop Performance</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <CurrencyDollarIcon className="w-8 h-8 text-green-400" />
            <span className="text-xs text-gray-500">Last 30 days</span>
          </div>
          <p className="text-gray-500 text-sm mb-2">Monthly Total</p>
          <p className="text-3xl font-bold text-gray-900">
            {analytics.total_month_tokens || 0} tokens
          </p>
          <p className="text-sm text-gray-400 mt-1">
            ${Math.round((analytics.total_month_tokens || 0) * 0.05)} USD value
          </p>
          {false && (
            <p className="text-sm text-green-400 mt-1">
              100% creator earnings
            </p>
          )}
        </div>
        
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <ArchiveBoxIcon className="w-8 h-8 text-purple-400" />
            <span className="text-xs text-gray-500">Last 30 days</span>
          </div>
          <p className="text-gray-500 text-sm mb-2">Orders Completed</p>
          <p className="text-3xl font-bold text-gray-900">{analytics.total_orders || 0}</p>
          <p className="text-sm text-gray-400 mt-1">
            {analytics.unique_buyers || 0} unique buyers
          </p>
        </div>
        
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <TagIcon className="w-8 h-8 text-yellow-400" />
            <span className="text-xs text-gray-500">Average</span>
          </div>
          <p className="text-gray-500 text-sm mb-2">Order Value</p>
          <p className="text-3xl font-bold text-gray-900">
            ${Math.round(analytics.avg_order_value_usd || 0)}
          </p>
        </div>
      </div>
      
      {/* Top Products */}
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h4 className="text-gray-900 font-semibold mb-4">Top Selling Products</h4>
        <div className="space-y-3">
          {items.slice(0, 5).map((item) => (
            <div key={item.id} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {item.images?.length > 0 ? (
                  <img 
                    src={item.images[0]} 
                    alt={item.name}
                    className="w-10 h-10 rounded object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 bg-gray-700 rounded flex items-center justify-center">
                    <PhotoIcon className="w-5 h-5 text-gray-500" />
                  </div>
                )}
                <div>
                  <p className="text-white text-sm">{item.name}</p>
                  <p className="text-xs text-gray-400">${item.price_usd}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-white font-semibold">{item.sales_count || 0}</p>
                <p className="text-xs text-gray-400">sales</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Shop Settings Component
const ShopSettings = ({ settings, onUpdate, user }) => {
  const shopName = `${user?.username || user?.display_name || 'Creator'} Shop`;

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-bold text-gray-900">Shop Settings</h3>
      
      <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-2">
            Shop URL
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={`https://digis.cc/${user.username}/shop`}
              readOnly
              className="flex-1 bg-gray-50 text-gray-600 px-4 py-2 rounded-lg border border-gray-200"
            />
            <button
              onClick={() => {
                navigator.clipboard.writeText(`https://digis.cc/${user.username}/shop`);
                toast.success('Shop URL copied!');
              }}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors shadow-sm"
            >
              Copy
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Share this link with your fans to direct them to your shop
          </p>
        </div>
      </div>
      
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
        <div className="flex gap-3">
          <ExclamationCircleIcon className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-gray-700">
            <p className="font-semibold mb-1">Important Notice</p>
            <p className="mb-2">All items sold are non-refundable. Digis is not responsible for any items sold through your shop. Transactions are solely between you and your buyers.</p>
            <p className="font-semibold">Platform Fee: Digis charges a 20% marketplace commission on USD sales. You receive 80% of the sale value in tokens (16 tokens per $1 of sale price).</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Enhanced Product Modal Component - Same as Shop Management
export const ItemModal = ({ item, onClose, onSuccess }) => {
  const fileInputRef = useRef(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(item?.image_url || null);
  const [uploadingImage, setUploadingImage] = useState(false);
  
  // Product form state with proper defaults
  const [productForm, setProductForm] = useState({
    name: item?.name || '',
    description: item?.description || '',
    price: item?.price_tokens || item?.price || '',
    category: item?.category || 'polaroid',
    image_url: item?.image_url || '',
    stock_quantity: item?.stock_quantity || null,
    is_active: item?.is_active !== undefined ? item?.is_active : true
  });

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
      const fileName = `${Date.now()}.${fileExt}`;
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
    if (!productForm.image_url && !selectedImage && !imagePreview) {
      toast.error('Please add a product image');
      return;
    }
    
    try {
      setUploadingImage(true);
      const authToken = await getAuthToken();
      
      let imageUrl = productForm.image_url || imagePreview;
      
      // Upload image if selected
      if (selectedImage) {
        imageUrl = await uploadImageToSupabase(selectedImage);
      }
      
      const endpoint = item 
        ? `${import.meta.env.VITE_BACKEND_URL}/shop/items/${item.id}`
        : `${import.meta.env.VITE_BACKEND_URL}/shop/items`;
      
      const response = await fetchWithRetry(endpoint, {
        method: item ? 'PUT' : 'POST',
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
        toast.success(item ? 'Product updated' : 'Product added');
        onSuccess && onSuccess();
        onClose();
      }
    } catch (error) {
      console.error('Error saving product:', error);
      toast.error('Failed to save product');
    } finally {
      setUploadingImage(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
      onClick={() => onClose()}
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
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {item ? 'Edit Product' : 'Add New Product'}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {item ? 'Update your product details' : 'Create a new product for your shop'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
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
                        setImagePreview(e.target.value);
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
                        <li>You must collect and manage shipping addresses</li>
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
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveProduct}
              disabled={uploadingImage}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploadingImage ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Uploading...
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  {item ? (
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
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

// Empty State Component
const EmptyState = ({ icon: Icon, title, description, action, actionLabel }) => (
  <div className="flex flex-col items-center justify-center py-12">
    <Icon className="w-16 h-16 text-gray-600 mb-4" />
    <h4 className="text-white font-semibold text-lg mb-2">{title}</h4>
    <p className="text-gray-400 text-sm mb-4">{description}</p>
    {action && (
      <button
        onClick={action}
        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
      >
        {actionLabel}
      </button>
    )}
  </div>
);

export default CreatorShopManagement;