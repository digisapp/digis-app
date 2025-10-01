import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingBagIcon,
  ShoppingCartIcon,
  CurrencyDollarIcon,
  PhotoIcon,
  ArrowLeftIcon,
  XMarkIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  TruckIcon,
  CreditCardIcon,
  MinusIcon,
  PlusIcon,
  TagIcon,
  GlobeAltIcon,
  LockClosedIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';
import { loadStripe } from '@stripe/stripe-js';
import { getAuthToken } from '../utils/supabase-auth';
import { fetchWithRetry } from '../utils/fetchWithRetry';
import { supabase } from '../utils/supabase-auth';
import toast from 'react-hot-toast';
import Auth from './Auth';

// Initialize Stripe (you'll need to add your publishable key)
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

const PublicCreatorShop = () => {
  const { username } = useParams();
  const navigate = useNavigate();
  const [shop, setShop] = useState(null);
  const [creator, setCreator] = useState(null);
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedItem, setSelectedItem] = useState(null);
  const [cart, setCart] = useState([]);
  const [showCart, setShowCart] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [userTokenBalance, setUserTokenBalance] = useState(0);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('signup');

  useEffect(() => {
    fetchShopData();
    checkUserAuth();
  }, [username]);

  const checkUserAuth = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUser(user);
        // Fetch user's token balance
        const authToken = await getAuthToken();
        const response = await fetchWithRetry(
          `${import.meta.env.VITE_BACKEND_URL}/api/tokens/balance`,
          {
            headers: { Authorization: `Bearer ${authToken}` }
          }
        );
        const data = await response.json();
        setUserTokenBalance(data.balance || 0);
      }
    } catch (error) {
      console.error('Error checking auth:', error);
    }
  };

  const fetchShopData = async () => {
    try {
      const response = await fetchWithRetry(
        `${import.meta.env.VITE_BACKEND_URL}/api/shop/public/${username}`
      );
      
      if (!response.ok) {
        throw new Error('Shop not found');
      }
      
      const data = await response.json();
      
      if (!data.shopEnabled) {
        setLoading(false);
        return;
      }
      
      setShop(data.shop);
      setCreator(data.creator);
      setItems(data.items || []);
      setCategories(['all', ...(data.categories || [])]);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching shop:', error);
      toast.error('Failed to load shop');
      setLoading(false);
    }
  };

  const addToCart = (item, quantity = 1) => {
    // Check if user is authenticated
    if (!user) {
      setShowAuthModal(true);
      toast('Join Digis to purchase products!', {
        icon: '🛍️',
        style: {
          background: '#7C3AED',
          color: '#fff',
        },
      });
      return;
    }
    
    const existingItem = cart.find(cartItem => cartItem.id === item.id);
    
    if (existingItem) {
      setCart(cart.map(cartItem =>
        cartItem.id === item.id
          ? { ...cartItem, quantity: cartItem.quantity + quantity }
          : cartItem
      ));
    } else {
      setCart([...cart, { ...item, quantity }]);
    }
    
    toast.success('Added to cart!');
    setSelectedItem(null);
  };

  const updateCartQuantity = (itemId, quantity) => {
    if (quantity <= 0) {
      setCart(cart.filter(item => item.id !== itemId));
    } else {
      setCart(cart.map(item =>
        item.id === itemId ? { ...item, quantity } : item
      ));
    }
  };

  const getCartTotal = (currency = 'usd') => {
    return cart.reduce((total, item) => {
      if (currency === 'usd') {
        return total + (item.price_usd * item.quantity);
      } else {
        return total + ((item.price_tokens || 0) * item.quantity);
      }
    }, 0);
  };

  const handleStripeCheckout = async () => {
    if (cart.length === 0) return;
    
    try {
      // Collect buyer information
      const buyerEmail = prompt('Enter your email address:');
      if (!buyerEmail) return;
      
      const buyerName = prompt('Enter your name (optional):') || '';
      
      // For simplicity, we'll process one item at a time
      // In production, you'd want to handle multiple items
      const item = cart[0];
      
      const authToken = user ? await getAuthToken() : null;
      const headers = authToken 
        ? { 
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`
          }
        : { 'Content-Type': 'application/json' };
      
      const response = await fetchWithRetry(
        `${import.meta.env.VITE_BACKEND_URL}/api/shop/checkout/stripe`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            itemId: item.id,
            quantity: item.quantity,
            buyerEmail,
            buyerName,
            shippingAddress: !item.is_digital ? {
              // In production, collect full address
              line1: 'Address line 1',
              city: 'City',
              state: 'State',
              postal_code: 'Zip',
              country: 'US'
            } : null
          })
        }
      );
      
      const data = await response.json();
      
      if (data.checkoutUrl) {
        // Redirect to Stripe Checkout
        window.location.href = data.checkoutUrl;
      }
    } catch (error) {
      console.error('Checkout error:', error);
      toast.error('Failed to process checkout');
    }
  };

  const handleTokenCheckout = async () => {
    if (!user) {
      setShowAuthModal(true);
      toast('Join Digis to complete your purchase!', {
        icon: '🛍️',
        style: {
          background: '#7C3AED',
          color: '#fff',
        },
      });
      return;
    }
    
    const totalTokens = getCartTotal('tokens');
    
    if (userTokenBalance < totalTokens) {
      toast.error('Insufficient token balance');
      return;
    }
    
    try {
      const authToken = await getAuthToken();
      
      // Process each item in cart
      for (const item of cart) {
        if (!item.price_tokens) continue;
        
        await fetchWithRetry(
          `${import.meta.env.VITE_BACKEND_URL}/api/shop/checkout/tokens`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${authToken}`
            },
            body: JSON.stringify({
              itemId: item.id,
              quantity: item.quantity,
              shippingAddress: !item.is_digital ? {
                // In production, collect full address
                line1: 'Address line 1',
                city: 'City',
                state: 'State',
                postal_code: 'Zip',
                country: 'US'
              } : null
            })
          }
        );
      }
      
      toast.success('Purchase successful! Check your email for order details.');
      setCart([]);
      setShowCart(false);
      setShowCheckout(false);
      
      // Refresh token balance
      checkUserAuth();
    } catch (error) {
      console.error('Token checkout error:', error);
      toast.error('Failed to process payment');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (!shop || !creator) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <ShoppingBagIcon className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Shop Not Found</h2>
          <p className="text-gray-400 mb-4">This creator doesn't have a shop yet.</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  const filteredItems = selectedCategory === 'all' 
    ? items 
    : items.filter(item => item.category === selectedCategory);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      {/* Header */}
      <div className="bg-gray-900/80 backdrop-blur-sm border-b border-gray-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(`/creator/${username}`)}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
              >
                <ArrowLeftIcon className="w-5 h-5 text-gray-400" />
              </button>
              <div className="flex items-center gap-3">
                {creator.profilePic ? (
                  <img 
                    src={creator.profilePic} 
                    alt={creator.displayName}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-white font-bold">
                    {creator.username?.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <h1 className="text-xl font-bold text-white">{shop.name}</h1>
                  <p className="text-sm text-gray-400">by @{creator.username}</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {user && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-600/20 rounded-lg">
                  <SparklesIcon className="w-5 h-5 text-purple-400" />
                  <span className="text-white font-semibold">{userTokenBalance}</span>
                  <span className="text-purple-400 text-sm">tokens</span>
                </div>
              )}
              <button
                onClick={() => setShowCart(true)}
                className="relative p-2 hover:bg-gray-800 rounded-lg transition-colors"
              >
                <ShoppingCartIcon className="w-6 h-6 text-white" />
                {cart.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-purple-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {cart.reduce((sum, item) => sum + item.quantity, 0)}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Shop Banner */}
      {shop.bannerImage && (
        <div className="h-48 bg-cover bg-center" style={{ backgroundImage: `url(${shop.bannerImage})` }} />
      )}

      {/* Shop Description */}
      {shop.description && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-gray-300 text-center">{shop.description}</p>
        </div>
      )}

      {/* Join to Purchase Banner for Non-Authenticated Users */}
      {!user && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-6">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl p-4 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                <ShoppingBagIcon className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-white font-semibold">Join Digis to Purchase</h3>
                <p className="text-purple-100 text-sm">Sign up to buy exclusive products with tokens</p>
              </div>
            </div>
            <button
              onClick={() => setShowAuthModal(true)}
              className="px-4 py-2 bg-white text-purple-600 rounded-lg font-semibold hover:bg-purple-50 transition-colors"
            >
              Sign Up Free
            </button>
          </motion.div>
        </div>
      )}

      {/* Category Filter */}
      {categories.length > 1 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-6">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-lg whitespace-nowrap transition-all ${
                  selectedCategory === category
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {category === 'all' ? 'All Products' : category}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Products Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        {filteredItems.length === 0 ? (
          <div className="text-center py-12">
            <ShoppingBagIcon className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">No products available in this category.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {filteredItems.map((item) => (
              <ProductCard
                key={item.id}
                item={item}
                shop={shop}
                onSelect={() => setSelectedItem(item)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Item Detail Modal */}
      <AnimatePresence>
        {selectedItem && (
          <ItemDetailModal
            item={selectedItem}
            shop={shop}
            onClose={() => setSelectedItem(null)}
            onAddToCart={addToCart}
          />
        )}
      </AnimatePresence>

      {/* Cart Sidebar */}
      <AnimatePresence>
        {showCart && (
          <CartSidebar
            cart={cart}
            shop={shop}
            onClose={() => setShowCart(false)}
            onUpdateQuantity={updateCartQuantity}
            onCheckout={() => {
              setShowCart(false);
              setShowCheckout(true);
            }}
            getCartTotal={getCartTotal}
          />
        )}
      </AnimatePresence>

      {/* Checkout Modal */}
      <AnimatePresence>
        {showCheckout && (
          <CheckoutModal
            cart={cart}
            shop={shop}
            user={user}
            userTokenBalance={userTokenBalance}
            getCartTotal={getCartTotal}
            onClose={() => setShowCheckout(false)}
            onStripeCheckout={handleStripeCheckout}
            onTokenCheckout={handleTokenCheckout}
          />
        )}
      </AnimatePresence>

      {/* Auth Modal */}
      <AnimatePresence>
        {showAuthModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowAuthModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center mb-6">
                <div className="w-20 h-20 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full mx-auto mb-4 flex items-center justify-center">
                  <ShoppingBagIcon className="w-10 h-10 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  Join Digis to Shop
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Sign up to purchase exclusive products from your favorite creators using tokens!
                </p>
              </div>
              
              <Auth 
                mode={authMode}
                onLogin={(user) => {
                  setUser(user);
                  setShowAuthModal(false);
                  checkUserAuth();
                  toast.success('Welcome to Digis! You can now shop.');
                }}
              />
              
              <div className="mt-4 text-center">
                <button
                  onClick={() => setAuthMode(authMode === 'signin' ? 'signup' : 'signin')}
                  className="text-purple-600 hover:text-purple-700 text-sm"
                >
                  {authMode === 'signin' ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
                </button>
              </div>
              
              <button
                onClick={() => setShowAuthModal(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <div className="bg-gray-900/80 backdrop-blur-sm border-t border-gray-800 py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center gap-6 text-sm text-gray-400">
            <div className="flex items-center gap-2">
              <LockClosedIcon className="w-4 h-4" />
              Secure Checkout
            </div>
            <div className="flex items-center gap-2">
              <ExclamationCircleIcon className="w-4 h-4" />
              All Sales Final
            </div>
            <div className="flex items-center gap-2">
              <GlobeAltIcon className="w-4 h-4" />
              Powered by Digis
            </div>
          </div>
          <p className="text-center text-xs text-gray-500 mt-4">
            Digis is not responsible for products sold. All transactions are between buyers and creators.
          </p>
        </div>
      </div>
    </div>
  );
};

// Product Card Component
const ProductCard = ({ item, shop, onSelect }) => (
  <motion.div
    whileHover={{ scale: 1.02 }}
    className="bg-gray-800/50 rounded-xl overflow-hidden border border-gray-700 hover:border-purple-500/50 transition-all cursor-pointer"
    onClick={onSelect}
  >
    {item.images && item.images.length > 0 ? (
      <img 
        src={item.images[0]} 
        alt={item.name}
        className="w-full h-48 object-cover"
      />
    ) : (
      <div className="w-full h-48 bg-gray-700 flex items-center justify-center">
        <PhotoIcon className="w-12 h-12 text-gray-500" />
      </div>
    )}
    
    <div className="p-4">
      <h3 className="text-white font-semibold mb-2 line-clamp-1">{item.name}</h3>
      <p className="text-gray-400 text-sm mb-3 line-clamp-2">
        {item.description || 'No description'}
      </p>
      
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SparklesIcon className="w-5 h-5 text-purple-400" />
          <span className="text-purple-400 font-bold text-lg">
            {item.price_tokens || item.price || 100} tokens
          </span>
        </div>
        {item.stock_quantity !== -1 && item.stock_quantity < 10 && (
          <span className="text-xs text-yellow-400">
            Only {item.stock_quantity} left
          </span>
        )}
      </div>
      
      {item.is_digital && (
        <div className="mt-2 flex items-center gap-1 text-xs text-blue-400">
          <GlobeAltIcon className="w-3 h-3" />
          Digital Product
        </div>
      )}
    </div>
  </motion.div>
);

// Item Detail Modal Component
const ItemDetailModal = ({ item, shop, onClose, onAddToCart }) => {
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.9 }}
        className="bg-gray-900 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-gray-900 border-b border-gray-800 p-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">{item.name}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <XMarkIcon className="w-6 h-6 text-gray-400" />
          </button>
        </div>
        
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Images */}
            <div>
              {item.images && item.images.length > 0 ? (
                <div>
                  <img 
                    src={item.images[selectedImage]} 
                    alt={item.name}
                    className="w-full h-96 object-cover rounded-xl mb-4"
                  />
                  {item.images.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto">
                      {item.images.map((image, index) => (
                        <img
                          key={index}
                          src={image}
                          alt={`${item.name} ${index + 1}`}
                          className={`w-20 h-20 object-cover rounded-lg cursor-pointer ${
                            selectedImage === index ? 'ring-2 ring-purple-600' : ''
                          }`}
                          onClick={() => setSelectedImage(index)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-full h-96 bg-gray-800 rounded-xl flex items-center justify-center">
                  <PhotoIcon className="w-16 h-16 text-gray-600" />
                </div>
              )}
            </div>
            
            {/* Details */}
            <div>
              <p className="text-gray-300 mb-6">
                {item.description || 'No description available.'}
              </p>
              
              {item.category && (
                <div className="flex items-center gap-2 mb-4">
                  <TagIcon className="w-5 h-5 text-gray-400" />
                  <span className="text-gray-400">{item.category}</span>
                </div>
              )}
              
              {item.is_digital && (
                <div className="flex items-center gap-2 mb-4 text-blue-400">
                  <GlobeAltIcon className="w-5 h-5" />
                  <span>Digital Product - Instant Delivery</span>
                </div>
              )}
              
              {!item.is_digital && (
                <div className="flex items-center gap-2 mb-4 text-gray-400">
                  <TruckIcon className="w-5 h-5" />
                  <span>Physical Product - Shipping Required</span>
                </div>
              )}
              
              {/* Pricing */}
              <div className="bg-gray-800 rounded-xl p-4 mb-6">
                <p className="text-gray-400 text-sm mb-2">Price</p>
                <div className="flex items-center gap-2">
                  <SparklesIcon className="w-6 h-6 text-purple-400" />
                  <span className="text-2xl font-bold text-purple-400">
                    {item.price_tokens || item.price || 100} tokens
                  </span>
                </div>
              </div>
              
              {/* Quantity Selector */}
              {item.stock_quantity !== -1 && (
                <div className="mb-6">
                  <p className="text-gray-400 text-sm mb-2">
                    Stock: {item.stock_quantity} available
                  </p>
                </div>
              )}
              
              <div className="flex items-center gap-4 mb-6">
                <span className="text-gray-400">Quantity:</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <MinusIcon className="w-4 h-4 text-white" />
                  </button>
                  <span className="text-white font-semibold px-4">{quantity}</span>
                  <button
                    onClick={() => setQuantity(Math.min(item.stock_quantity === -1 ? 99 : item.stock_quantity, quantity + 1))}
                    className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <PlusIcon className="w-4 h-4 text-white" />
                  </button>
                </div>
              </div>
              
              {/* Add to Cart Button */}
              <button
                onClick={() => onAddToCart(item, quantity)}
                disabled={item.stock_quantity === 0}
                className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-600 disabled:to-gray-700 text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
              >
                <ShoppingCartIcon className="w-5 h-5" />
                {item.stock_quantity === 0 ? 'Out of Stock' : 'Add to Cart'}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

// Cart Sidebar Component
const CartSidebar = ({ cart, shop, onClose, onUpdateQuantity, onCheckout, getCartTotal }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
    onClick={onClose}
  >
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      className="absolute right-0 top-0 h-full w-full max-w-md bg-gray-900 shadow-xl"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex flex-col h-full">
        <div className="p-6 border-b border-gray-800">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <ShoppingCartIcon className="w-6 h-6" />
              Your Cart
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <XMarkIcon className="w-6 h-6 text-gray-400" />
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6">
          {cart.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingBagIcon className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">Your cart is empty</p>
            </div>
          ) : (
            <div className="space-y-4">
              {cart.map((item) => (
                <div key={item.id} className="bg-gray-800 rounded-xl p-4">
                  <div className="flex gap-4">
                    {item.images?.length > 0 ? (
                      <img 
                        src={item.images[0]} 
                        alt={item.name}
                        className="w-20 h-20 object-cover rounded-lg"
                      />
                    ) : (
                      <div className="w-20 h-20 bg-gray-700 rounded-lg flex items-center justify-center">
                        <PhotoIcon className="w-8 h-8 text-gray-500" />
                      </div>
                    )}
                    
                    <div className="flex-1">
                      <h3 className="text-white font-semibold mb-1">{item.name}</h3>
                      <p className="text-gray-400 text-sm mb-2">
                        ${item.price_usd} each
                      </p>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                            className="p-1 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
                          >
                            <MinusIcon className="w-3 h-3 text-white" />
                          </button>
                          <span className="text-white px-2">{item.quantity}</span>
                          <button
                            onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                            className="p-1 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
                          >
                            <PlusIcon className="w-3 h-3 text-white" />
                          </button>
                        </div>
                        
                        <span className="text-white font-semibold">
                          ${(item.price_usd * item.quantity).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {cart.length > 0 && (
          <div className="p-6 border-t border-gray-800">
            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-gray-400">
                <span>Subtotal</span>
                <span>${getCartTotal('usd').toFixed(2)}</span>
              </div>
              {shop.accepts_tokens && (
                <div className="flex justify-between text-purple-400 text-sm">
                  <span>or pay with tokens</span>
                  <span>{getCartTotal('tokens')} tokens</span>
                </div>
              )}
            </div>
            
            <button
              onClick={onCheckout}
              className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-xl font-semibold transition-all"
            >
              Proceed to Checkout
            </button>
          </div>
        )}
      </div>
    </motion.div>
  </motion.div>
);

// Checkout Modal Component
const CheckoutModal = ({ 
  cart, 
  shop, 
  user, 
  userTokenBalance, 
  getCartTotal, 
  onClose, 
  onStripeCheckout, 
  onTokenCheckout 
}) => {
  const [paymentMethod, setPaymentMethod] = useState('stripe');
  const totalUsd = getCartTotal('usd');
  const totalTokens = getCartTotal('tokens');
  const canPayWithTokens = user && userTokenBalance >= totalTokens && shop.accepts_tokens;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.9 }}
        className="bg-gray-900 rounded-2xl max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-gray-800">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">Checkout</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <XMarkIcon className="w-6 h-6 text-gray-400" />
            </button>
          </div>
        </div>
        
        <div className="p-6">
          {/* Order Summary */}
          <div className="bg-gray-800 rounded-xl p-4 mb-6">
            <h3 className="text-white font-semibold mb-3">Order Summary</h3>
            <div className="space-y-2 text-sm">
              {cart.map((item) => (
                <div key={item.id} className="flex justify-between text-gray-400">
                  <span>{item.name} x{item.quantity}</span>
                  <span>${(item.price_usd * item.quantity).toFixed(2)}</span>
                </div>
              ))}
              <div className="pt-2 border-t border-gray-700 flex justify-between text-white font-semibold">
                <span>Total</span>
                <span>${totalUsd.toFixed(2)}</span>
              </div>
            </div>
          </div>
          
          {/* Payment Method Selection */}
          <div className="space-y-3 mb-6">
            <h3 className="text-white font-semibold">Payment Method</h3>
            
            {shop.accepts_usd && (
              <label className="flex items-center gap-3 p-4 bg-gray-800 rounded-xl cursor-pointer hover:bg-gray-700 transition-colors">
                <input
                  type="radio"
                  name="payment"
                  value="stripe"
                  checked={paymentMethod === 'stripe'}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-4 h-4 text-purple-600"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <CreditCardIcon className="w-5 h-5 text-green-400" />
                    <span className="text-white font-medium">Pay with Card</span>
                  </div>
                  <span className="text-gray-400 text-sm">via Stripe</span>
                </div>
                <span className="text-green-400 font-bold">${totalUsd.toFixed(2)}</span>
              </label>
            )}
            
            {shop.accepts_tokens && (
              <label className={`flex items-center gap-3 p-4 bg-gray-800 rounded-xl cursor-pointer transition-colors ${
                canPayWithTokens ? 'hover:bg-gray-700' : 'opacity-50 cursor-not-allowed'
              }`}>
                <input
                  type="radio"
                  name="payment"
                  value="tokens"
                  checked={paymentMethod === 'tokens'}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  disabled={!canPayWithTokens}
                  className="w-4 h-4 text-purple-600"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <SparklesIcon className="w-5 h-5 text-purple-400" />
                    <span className="text-white font-medium">Pay with Tokens</span>
                  </div>
                  {user ? (
                    <span className="text-gray-400 text-sm">
                      Balance: {userTokenBalance} tokens
                    </span>
                  ) : (
                    <span className="text-yellow-400 text-sm">Sign in required</span>
                  )}
                </div>
                <span className="text-purple-400 font-bold">{totalTokens} tokens</span>
              </label>
            )}
          </div>
          
          {/* Important Notice */}
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mb-6">
            <div className="flex gap-3">
              <ExclamationCircleIcon className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-gray-300">
                <p className="font-semibold mb-1">Important</p>
                <p>All sales are final. No refunds. Digis is not responsible for products sold.</p>
              </div>
            </div>
          </div>
          
          {/* Checkout Button */}
          <button
            onClick={paymentMethod === 'stripe' ? onStripeCheckout : onTokenCheckout}
            className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
          >
            <CheckCircleIcon className="w-5 h-5" />
            Complete Purchase
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default PublicCreatorShop;