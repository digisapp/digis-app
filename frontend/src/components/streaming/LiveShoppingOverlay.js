import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShoppingBagIcon, 
  XMarkIcon, 
  SparklesIcon,
  ClockIcon,
  FireIcon,
  HeartIcon,
  ShoppingCartIcon,
  BoltIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  EyeIcon
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid';
import { apiClient } from '../../services/api';
import socketService from '../../services/socketServiceWrapper';
import { toast } from 'react-hot-toast';
import LiveShoppingBuyButton from './LiveShoppingBuyButton';

const LiveShoppingOverlay = ({ 
  streamId, 
  isCreator = false, 
  user,
  onPurchase 
}) => {
  const socket = socketService.getSocket();
  const [products, setProducts] = useState([]);
  const [featuredProduct, setFeaturedProduct] = useState(null);
  const [cart, setCart] = useState([]);
  const [showCart, setShowCart] = useState(false);
  const [showProducts, setShowProducts] = useState(false);
  const [flashSale, setFlashSale] = useState(null);
  const [recentPurchases, setRecentPurchases] = useState([]);
  const [productInteraction, setProductInteraction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [cartPosition, setCartPosition] = useState('bottom-right');
  const [minimized, setMinimized] = useState(false);
  // Floating products removed per user request
  // const [floatingProducts, setFloatingProducts] = useState([]);
  const [showFloatingBuyButtons, setShowFloatingBuyButtons] = useState(true);

  // Fetch products for the stream
  useEffect(() => {
    if (streamId) {
      fetchStreamProducts();
    }
  }, [streamId]);

  // Socket event listeners
  useEffect(() => {
    if (!socket || !streamId) return;

    // Join stream room
    if (socket.emit) {
      socket.emit('join-stream', streamId);
    }

    // Product events
    socket.on('product:added', handleProductAdded);
    socket.on('product:removed', handleProductRemoved);
    socket.on('product:featured', handleProductFeatured);
    socket.on('flash:sale:started', handleFlashSaleStarted);
    socket.on('product:purchased', handleProductPurchased);
    socket.on('shopping:interaction:created', handleInteractionCreated);
    socket.on('shopping:activity', handleShoppingActivity);

    return () => {
      socket.off('product:added');
      socket.off('product:removed');
      socket.off('product:featured');
      socket.off('flash:sale:started');
      socket.off('product:purchased');
      socket.off('shopping:interaction:created');
      socket.off('shopping:activity');
    };
  }, [socket, streamId]);

  // Flash sale countdown timer
  useEffect(() => {
    if (!flashSale) return;

    const timer = setInterval(() => {
      const now = Date.now();
      const endsAt = new Date(flashSale.endsAt).getTime();
      
      if (now >= endsAt) {
        setFlashSale(null);
        toast('Flash sale ended!', { icon: '⏰' });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [flashSale]);

  const fetchStreamProducts = async () => {
    try {
      const response = await apiClient.get(`/api/live-shopping/streams/${streamId}/products`);
      setProducts(response.data.products || []);
      
      const featured = response.data.products?.find(p => p.featured);
      if (featured) {
        setFeaturedProduct(featured);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
      // Set empty products to avoid further errors
      setProducts([]);
    }
  };

  const handleProductAdded = (data) => {
    setProducts(prev => [...prev, data.product]);
    toast(`New product added: ${data.product.name}`, { icon: '🛍️' });
  };

  const handleProductRemoved = (data) => {
    setProducts(prev => prev.filter(p => p.product_id !== data.productId));
    if (featuredProduct?.product_id === data.productId) {
      setFeaturedProduct(null);
    }
  };

  const handleProductFeatured = (data) => {
    const product = products.find(p => p.product_id === data.productId);
    if (product) {
      setFeaturedProduct(data.featured ? product : null);
      if (data.featured) {
        toast(`Featured: ${product.name}`, { icon: '⭐' });
        
        // Floating buy buttons removed per user request
      }
    }
  };
  
  // Random position function removed - no longer needed

  const handleFlashSaleStarted = (data) => {
    setFlashSale(data);
    toast(
      `🔥 FLASH SALE: ${data.productName} - ${data.discountPercentage}% OFF!`,
      { duration: 5000 }
    );
  };

  const handleProductPurchased = (data) => {
    setRecentPurchases(prev => [data, ...prev].slice(0, 5));
    
    // Show purchase notification
    toast.custom((t) => (
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="bg-white rounded-lg shadow-lg p-3 flex items-center space-x-2"
      >
        <ShoppingBagIcon className="w-5 h-5 text-green-500" />
        <div>
          <p className="font-semibold text-sm">{data.buyer} just bought</p>
          <p className="text-xs text-gray-600">{data.productName}</p>
        </div>
      </motion.div>
    ), { duration: 3000 });
  };

  const handleInteractionCreated = (data) => {
    setProductInteraction(data.interaction);
  };

  const handleShoppingActivity = (data) => {
    // Show social proof notifications
    if (data.type === 'cart_update') {
      toast(`${data.user} added items to cart`, { 
        icon: '🛒',
        duration: 2000,
        position: 'bottom-left'
      });
    }
  };

  const addToCart = (product) => {
    setCart(prev => {
      const existing = prev.find(item => item.product_id === product.product_id);
      if (existing) {
        return prev.map(item => 
          item.product_id === product.product_id 
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
    
    // Emit cart update for social proof
    socket?.emit('shopping:cart:update', {
      streamId,
      cart: cart.length + 1
    });
    
    toast.success('Added to cart!');
  };

  const removeFromCart = (productId) => {
    setCart(prev => prev.filter(item => item.product_id !== productId));
  };

  const updateQuantity = (productId, quantity) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart(prev => prev.map(item => 
      item.product_id === productId 
        ? { ...item, quantity }
        : item
    ));
  };

  const purchaseProduct = async (product, quantity = 1) => {
    setLoading(true);
    try {
      const response = await api.post('/live-shopping/live-purchases', {
        streamId,
        productId: product.product_id,
        quantity
      });
      
      if (response.data.success) {
        toast.success(`Purchased ${product.name}!`);
        removeFromCart(product.product_id);
        
        if (onPurchase) {
          onPurchase(response.data);
        }
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Purchase failed');
    } finally {
      setLoading(false);
    }
  };

  const purchaseCart = async () => {
    setLoading(true);
    try {
      for (const item of cart) {
        await purchaseProduct(item, item.quantity);
      }
      setCart([]);
      setShowCart(false);
    } catch (error) {
      console.error('Cart purchase error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFlashSaleTimeLeft = () => {
    if (!flashSale) return null;
    
    const now = Date.now();
    const endsAt = new Date(flashSale.endsAt).getTime();
    const diff = Math.max(0, endsAt - now);
    
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const cartTotal = cart.reduce((sum, item) => {
    const price = item.sale_price || item.price;
    return sum + (price * item.quantity);
  }, 0);

  return (
    <>
      {/* Floating Buy Now Buttons - Removed per user request */}

      {/* Toggle Floating Buttons Visibility (Creator Only) */}
      {isCreator && (
        <button
          onClick={() => setShowFloatingBuyButtons(!showFloatingBuyButtons)}
          className="absolute top-4 right-20 z-30 bg-white/90 backdrop-blur p-2 rounded-lg shadow-lg hover:bg-white transition-colors"
          title={showFloatingBuyButtons ? "Hide Buy Buttons" : "Show Buy Buttons"}
        >
          <EyeIcon className={`w-5 h-5 ${showFloatingBuyButtons ? 'text-purple-600' : 'text-gray-400'}`} />
        </button>
      )}

      {/* Featured Product Banner */}
      <AnimatePresence>
        {featuredProduct && !minimized && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="absolute top-4 left-4 right-4 z-30"
          >
            <div className="bg-white/95 backdrop-blur rounded-xl shadow-lg p-4 flex items-center space-x-4">
              <img
                src={featuredProduct.image_url}
                alt={featuredProduct.name}
                className="w-20 h-20 object-cover rounded-lg"
              />
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <SparklesIcon className="w-5 h-5 text-yellow-500" />
                  <h3 className="font-bold text-lg">{featuredProduct.name}</h3>
                </div>
                <p className="text-sm text-gray-600 line-clamp-1">
                  {featuredProduct.description}
                </p>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center space-x-2">
                    {featuredProduct.sale_price ? (
                      <>
                        <span className="text-lg font-bold text-green-600">
                          {featuredProduct.sale_price} tokens
                        </span>
                        <span className="text-sm line-through text-gray-400">
                          {featuredProduct.price}
                        </span>
                      </>
                    ) : (
                      <span className="text-lg font-bold">
                        {featuredProduct.price} tokens
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => addToCart(featuredProduct)}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    Add to Cart
                  </button>
                </div>
              </div>
              <button
                onClick={() => setFeaturedProduct(null)}
                className="p-1 hover:bg-gray-200 rounded-lg"
              >
                <XMarkIcon className="w-5 h-5 text-gray-500" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Flash Sale Alert - Improved visibility */}
      <AnimatePresence>
        {flashSale && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute top-24 left-1/2 -translate-x-1/2 z-40"
          >
            <div className="bg-gradient-to-r from-red-600 to-orange-600 text-white px-6 py-3 rounded-full shadow-2xl flex items-center space-x-3 backdrop-blur-sm border border-white/20">
              <FireIcon className="w-6 h-6 animate-pulse" />
              <div>
                <p className="font-extrabold text-white drop-shadow-lg">FLASH SALE - {flashSale.discountPercentage}% OFF!</p>
                <p className="text-sm text-white/95 font-semibold">{flashSale.productName}</p>
              </div>
              <div className="flex items-center space-x-1">
                <ClockIcon className="w-5 h-5" />
                <span className="font-mono font-bold bg-black/30 px-2 py-0.5 rounded">{getFlashSaleTimeLeft()}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Products Button - Show for viewers only */}
      {!isCreator && (
        <button
          onClick={() => setShowProducts(!showProducts)}
          className={`absolute ${cartPosition === 'bottom-right' ? 'bottom-24' : 'top-24'} right-4 z-30 bg-purple-600/80 backdrop-blur-sm text-white p-2 rounded-full shadow-lg hover:bg-purple-700 transition-all`}
        >
          <ShoppingBagIcon className="w-5 h-5" />
          {products.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {products.length}
            </span>
          )}
        </button>
      )}

      {/* Cart Button - Hide for creators */}
      {!isCreator && (
        <button
          onClick={() => setShowCart(!showCart)}
          className={`absolute ${cartPosition} z-30 bg-green-600 text-white p-3 rounded-full shadow-lg hover:bg-green-700 transition-all`}
        >
          <ShoppingCartIcon className="w-6 h-6" />
          {cart.length > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center">
              {cart.length}
            </span>
          )}
        </button>
      )}

      {/* Products Panel */}
      <AnimatePresence>
        {showProducts && (
          <motion.div
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
            className="absolute right-0 top-0 bottom-0 w-80 bg-white shadow-xl z-40 overflow-hidden"
          >
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="text-xl font-bold">Stream Products</h2>
              <button
                onClick={() => setShowProducts(false)}
                className="p-1 hover:bg-gray-100 rounded-lg"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
            
            <div className="overflow-y-auto h-full pb-20">
              <div className="p-4 space-y-4">
                {products.map((product) => (
                  <ProductCard
                    key={product.product_id}
                    product={product}
                    onAddToCart={addToCart}
                    isFlashSale={flashSale?.productId === product.product_id}
                    socket={socket}
                    streamId={streamId}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Shopping Cart */}
      <AnimatePresence>
        {showCart && (
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="absolute bottom-20 right-4 w-96 bg-white rounded-t-xl shadow-xl z-40"
          >
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-bold text-lg">Shopping Cart</h3>
              <button
                onClick={() => setShowCart(false)}
                className="p-1 hover:bg-gray-100 rounded-lg"
              >
                <ChevronDownIcon className="w-5 h-5" />
              </button>
            </div>
            
            <div className="max-h-96 overflow-y-auto">
              {cart.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  Your cart is empty
                </div>
              ) : (
                <div className="p-4 space-y-3">
                  {cart.map((item) => (
                    <CartItem
                      key={item.product_id}
                      item={item}
                      onUpdateQuantity={updateQuantity}
                      onRemove={removeFromCart}
                    />
                  ))}
                </div>
              )}
            </div>
            
            {cart.length > 0 && (
              <div className="p-4 border-t">
                <div className="flex items-center justify-between mb-4">
                  <span className="font-bold text-lg">Total:</span>
                  <span className="font-bold text-xl text-green-600">
                    {cartTotal} tokens
                  </span>
                </div>
                <button
                  onClick={purchaseCart}
                  disabled={loading}
                  className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {loading ? 'Processing...' : 'Purchase All'}
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recent Purchases Feed */}
      <div className="absolute bottom-20 left-4 z-20 space-y-2 pointer-events-none">
        <AnimatePresence>
          {recentPurchases.map((purchase, index) => (
            <motion.div
              key={`${purchase.buyer}-${purchase.timestamp}-${index}`}
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ delay: index * 0.1 }}
              className="bg-black/70 text-white px-3 py-2 rounded-lg flex items-center space-x-2"
            >
              <ShoppingBagIcon className="w-4 h-4 text-green-400" />
              <span className="text-sm">
                <span className="font-semibold">{purchase.buyer}</span> bought {purchase.productName}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </>
  );
};

// Product Card Component
const ProductCard = ({ product, onAddToCart, isFlashSale, socket, streamId }) => {
  const [liked, setLiked] = useState(false);
  
  const handleView = () => {
    socket?.emit('shopping:product:view', {
      streamId,
      productId: product.product_id
    });
  };

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className="bg-white border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow"
      onClick={handleView}
    >
      <div className="relative">
        <img
          src={product.image_url}
          alt={product.name}
          className="w-full h-48 object-cover"
        />
        {isFlashSale && (
          <div className="absolute top-2 left-2 bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-extrabold animate-pulse shadow-lg backdrop-blur-sm border border-white/20">
            FLASH SALE
          </div>
        )}
        {product.stock_quantity && product.stock_quantity < 10 && (
          <div className="absolute top-2 right-2 bg-orange-500 text-white px-2 py-1 rounded-lg text-xs">
            Only {product.stock_quantity} left!
          </div>
        )}
      </div>
      
      <div className="p-4">
        <h4 className="font-semibold text-lg mb-1">{product.name}</h4>
        <p className="text-sm text-gray-600 mb-3 line-clamp-2">
          {product.description}
        </p>
        
        <div className="flex items-center justify-between">
          <div>
            {product.sale_price ? (
              <div className="flex items-center space-x-2">
                <span className="text-xl font-bold text-green-600">
                  {product.sale_price} tokens
                </span>
                <span className="text-sm line-through text-gray-400">
                  {product.price}
                </span>
                <span className="text-xs bg-red-600 text-white font-bold px-2 py-1 rounded shadow">
                  -{product.flash_discount || product.discount_percentage}%
                </span>
              </div>
            ) : (
              <span className="text-xl font-bold">{product.price} tokens</span>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setLiked(!liked);
              }}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {liked ? (
                <HeartSolidIcon className="w-5 h-5 text-red-500" />
              ) : (
                <HeartIcon className="w-5 h-5 text-gray-400" />
              )}
            </button>
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAddToCart(product);
              }}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              Add to Cart
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// Cart Item Component
const CartItem = ({ item, onUpdateQuantity, onRemove }) => {
  return (
    <div className="flex items-center space-x-3 p-2 border rounded-lg">
      <img
        src={item.image_url}
        alt={item.name}
        className="w-16 h-16 object-cover rounded-lg"
      />
      
      <div className="flex-1">
        <h4 className="font-semibold">{item.name}</h4>
        <p className="text-sm text-gray-600">
          {item.sale_price || item.price} tokens each
        </p>
      </div>
      
      <div className="flex items-center space-x-2">
        <button
          onClick={() => onUpdateQuantity(item.product_id, item.quantity - 1)}
          className="w-8 h-8 rounded-lg border hover:bg-gray-100"
        >
          -
        </button>
        <span className="w-8 text-center font-semibold">{item.quantity}</span>
        <button
          onClick={() => onUpdateQuantity(item.product_id, item.quantity + 1)}
          className="w-8 h-8 rounded-lg border hover:bg-gray-100"
        >
          +
        </button>
      </div>
      
      <button
        onClick={() => onRemove(item.product_id)}
        className="p-1 hover:bg-red-100 rounded-lg"
      >
        <XMarkIcon className="w-5 h-5 text-red-500" />
      </button>
    </div>
  );
};

export default LiveShoppingOverlay;