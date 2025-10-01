import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShoppingBagIcon,
  SparklesIcon,
  BoltIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import api from '../../services/api';
import { toast } from 'react-hot-toast';

const LiveShoppingBuyButton = ({ 
  product, 
  position = { x: 20, y: 20 },
  streamId,
  user,
  onPurchase,
  flashSale = null,
  autoHide = true,
  autoHideDelay = 10000
}) => {
  const [purchasing, setPurchasing] = useState(false);
  const [purchased, setPurchased] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [timeLeft, setTimeLeft] = useState(null);

  useEffect(() => {
    if (autoHide && !isHovered) {
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, autoHideDelay);
      return () => clearTimeout(timer);
    }
  }, [autoHide, autoHideDelay, isHovered]);

  useEffect(() => {
    if (flashSale) {
      const timer = setInterval(() => {
        const now = Date.now();
        const endsAt = new Date(flashSale.endsAt).getTime();
        const remaining = Math.max(0, endsAt - now);
        
        if (remaining === 0) {
          setTimeLeft(null);
        } else {
          const minutes = Math.floor(remaining / 60000);
          const seconds = Math.floor((remaining % 60000) / 1000);
          setTimeLeft(`${minutes}:${seconds.toString().padStart(2, '0')}`);
        }
      }, 1000);
      
      return () => clearInterval(timer);
    }
  }, [flashSale]);

  const handlePurchase = async () => {
    if (!user) {
      toast.error('Please login to purchase');
      return;
    }

    setPurchasing(true);
    try {
      const response = await api.post('/live-shopping/live-purchases', {
        streamId,
        productId: product.id || product.product_id,
        quantity: 1
      });

      if (response.data.success) {
        setPurchased(true);
        toast.success(`Purchased ${product.name}!`);
        
        if (onPurchase) {
          onPurchase(response.data);
        }

        // Hide button after 3 seconds
        setTimeout(() => {
          setIsVisible(false);
        }, 3000);
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Purchase failed');
    } finally {
      setPurchasing(false);
    }
  };

  const calculatePrice = () => {
    const basePrice = product.price_tokens || product.price;
    if (flashSale) {
      return Math.round(basePrice * (1 - flashSale.discountPercentage / 100));
    }
    return basePrice;
  };

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.8, y: -20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.8, y: -20 }}
        style={{
          position: 'absolute',
          left: `${position.x}px`,
          top: `${position.y}px`,
          zIndex: 40
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="pointer-events-auto"
      >
        <motion.div
          whileHover={{ scale: 1.05 }}
          className={`
            bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl overflow-hidden
            ${flashSale ? 'ring-4 ring-red-400 ring-opacity-50' : ''}
          `}
        >
          {/* Flash Sale Banner */}
          {flashSale && (
            <div className="bg-gradient-to-r from-red-500 to-orange-500 text-white px-3 py-1.5 text-center">
              <div className="flex items-center justify-center gap-2 text-sm font-bold">
                <BoltIcon className="w-4 h-4 animate-pulse" />
                <span>FLASH SALE - {flashSale.discountPercentage}% OFF</span>
                {timeLeft && (
                  <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">
                    {timeLeft}
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="p-4">
            {/* Product Info */}
            <div className="flex items-start gap-3 mb-3">
              {product.image_url && (
                <img 
                  src={product.image_url} 
                  alt={product.name}
                  className="w-16 h-16 rounded-lg object-cover"
                />
              )}
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 line-clamp-1">
                  {product.name}
                </h3>
                <p className="text-sm text-gray-600 line-clamp-2">
                  {product.description}
                </p>
              </div>
            </div>

            {/* Price Display */}
            <div className="mb-3">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-purple-600">
                  {calculatePrice()} tokens
                </span>
                {flashSale && (
                  <span className="text-sm text-gray-500 line-through">
                    {product.price_tokens || product.price} tokens
                  </span>
                )}
              </div>
              {product.stock_quantity !== null && product.stock_quantity < 10 && (
                <p className="text-xs text-red-600 mt-1">
                  Only {product.stock_quantity} left!
                </p>
              )}
            </div>

            {/* Buy Button */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handlePurchase}
              disabled={purchasing || purchased}
              className={`
                w-full py-3 rounded-xl font-bold text-white transition-all
                flex items-center justify-center gap-2
                ${purchased 
                  ? 'bg-green-500' 
                  : flashSale 
                    ? 'bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600'
                    : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700'
                }
                ${(purchasing || purchased) ? 'cursor-not-allowed opacity-75' : ''}
              `}
            >
              {purchased ? (
                <>
                  <CheckCircleIcon className="w-5 h-5" />
                  Purchased!
                </>
              ) : purchasing ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                  Processing...
                </>
              ) : (
                <>
                  <ShoppingBagIcon className="w-5 h-5" />
                  Buy Now
                </>
              )}
            </motion.button>

            {/* Social Proof */}
            {product.live_sales_count > 0 && (
              <p className="text-xs text-center text-gray-500 mt-2">
                <SparklesIcon className="w-3 h-3 inline mr-1" />
                {product.live_sales_count} sold in live streams
              </p>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default LiveShoppingBuyButton;