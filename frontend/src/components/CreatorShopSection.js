import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  ShoppingBagIcon,
  PlusIcon,
  SparklesIcon,
  CurrencyDollarIcon,
  ChartBarIcon,
  ArrowTrendingUpIcon,
  CubeIcon,
  ComputerDesktopIcon,
  TagIcon,
  EyeIcon,
  ShoppingCartIcon,
  ArrowRightIcon,
  CameraIcon,
  HeartIcon,
  ShoppingBagIcon as BagIcon,
  XMarkIcon,
  PhotoIcon,
  ArrowUpTrayIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  TruckIcon
} from '@heroicons/react/24/outline';
import { StarIcon } from '@heroicons/react/24/solid';
import Button from './ui/Button';
import toast from 'react-hot-toast';
import { supabase } from '../utils/supabase-auth';
import { getAuthToken } from '../utils/supabase-auth';
import { fetchWithRetry } from '../utils/fetchWithRetry';

const CreatorShopSection = ({
  user,
  digitalProducts = [],
  physicalProducts = [],
  shopStats = {},
  onAddProduct,
  onEditProduct,
  onDeleteProduct,
  onViewAnalytics,
  mobile = false
}) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('memorabilia');
  const [hoveredProduct, setHoveredProduct] = useState(null);
  const [showQuickStats, setShowQuickStats] = useState(false); // Start with false for faster initial load
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  
  // Product form state
  const [productForm, setProductForm] = useState({
    name: '',
    description: '',
    price: '',
    category: 'polaroid',
    image_url: '',
    stock_quantity: null,
    is_active: true
  });

  // Creator Shop Product Catalog - Non-media content for creators
  const memorabiliaProducts = useMemo(() => digitalProducts.length > 0 ? digitalProducts : [
    {
      id: 1,
      title: 'Signed Polaroid (Exclusive Selfie)',
      description: 'Personalized polaroid signed with your name',
      price: 12500,
      currency: 'tokens',
      type: 'physical',
      category: 'memorabilia',
      thumbnail: '/api/placeholder/300/400',
      sales: 8,
      rating: 5.0,
      reviews: 7,
      available: true,
      shipping: 'Worldwide',
      highValue: true
    },
    {
      id: 2,
      title: 'Handwritten Letter',
      description: 'Personal 1-page letter just for you',
      price: 5000,
      currency: 'tokens',
      type: 'physical',
      category: 'memorabilia',
      thumbnail: '/api/placeholder/300/400',
      sales: 15,
      rating: 4.9,
      reviews: 12,
      available: true,
      shipping: 'Worldwide'
    },
    {
      id: 3,
      title: 'Worn Clothing Item',
      description: 'Shirt/dress worn during stream (with photo proof)',
      price: 9000,
      currency: 'tokens',
      type: 'physical',
      category: 'memorabilia',
      thumbnail: '/api/placeholder/300/400',
      sales: 6,
      rating: 5.0,
      reviews: 5,
      available: true,
      shipping: 'Worldwide',
      highValue: true
    },
    {
      id: 4,
      title: 'Signed Poster (Limited Edition)',
      description: '11x17 glossy poster, hand-signed',
      price: 1800,
      currency: 'tokens',
      type: 'physical',
      category: 'memorabilia',
      thumbnail: '/api/placeholder/300/400',
      sales: 23,
      rating: 4.8,
      reviews: 18,
      available: true,
      shipping: 'Worldwide'
    },
    {
      id: 5,
      title: 'Used Workout Gear',
      description: 'Authentic gym wear with verification',
      price: 15000,
      currency: 'tokens',
      type: 'physical',
      category: 'memorabilia',
      thumbnail: '/api/placeholder/300/400',
      sales: 4,
      rating: 5.0,
      reviews: 3,
      available: true,
      shipping: 'Worldwide',
      highValue: true
    },
    {
      id: 6,
      title: 'Personal Accessories',
      description: 'Bracelet, necklace, or watch worn by creator',
      price: 7500,
      currency: 'tokens',
      type: 'physical',
      category: 'memorabilia',
      thumbnail: '/api/placeholder/300/400',
      sales: 9,
      rating: 4.9,
      reviews: 7,
      available: true,
      shipping: 'Worldwide'
    },
    {
      id: 7,
      title: 'Fitness Guide eBook',
      description: '30-day transformation plan',
      price: 1800,
      currency: 'tokens',
      type: 'digital',
      category: 'ebook',
      thumbnail: '/api/placeholder/300/400',
      sales: 45,
      rating: 4.7,
      reviews: 32,
      available: true
    }
  ], [digitalProducts]);

  const romanticProducts = useMemo(() => physicalProducts.length > 0 ? physicalProducts : [
    {
      id: 8,
      title: 'Love Letter',
      description: 'Handwritten romantic note',
      price: 8000,
      currency: 'tokens',
      type: 'physical',
      category: 'romantic',
      thumbnail: '/api/placeholder/300/400',
      sales: 11,
      rating: 5.0,
      reviews: 9,
      available: true,
      shipping: 'Worldwide',
      intimate: true
    },
    {
      id: 9,
      title: 'Perfumed Card',
      description: "Greeting card with creator's scent",
      price: 3500,
      currency: 'tokens',
      type: 'physical',
      category: 'romantic',
      thumbnail: '/api/placeholder/300/400',
      sales: 17,
      rating: 4.8,
      reviews: 14,
      available: true,
      shipping: 'Worldwide',
      intimate: true
    },
    {
      id: 10,
      title: 'Lipstick Kiss Print',
      description: 'Signed photo with kiss mark',
      price: 6000,
      currency: 'tokens',
      type: 'physical',
      category: 'romantic',
      thumbnail: '/api/placeholder/300/400',
      sales: 13,
      rating: 4.9,
      reviews: 11,
      available: true,
      shipping: 'Worldwide',
      intimate: true
    },
    {
      id: 11,
      title: 'Date Night Outfit',
      description: 'Dress/outfit worn on special occasion',
      price: 18000,
      currency: 'tokens',
      type: 'physical',
      category: 'romantic',
      thumbnail: '/api/placeholder/300/400',
      sales: 3,
      rating: 5.0,
      reviews: 3,
      available: true,
      shipping: 'Worldwide',
      intimate: true,
      highValue: true
    }
  ], [physicalProducts]);

  const brandedProducts = useMemo(() => [
    {
      id: 12,
      title: 'Signature Hoodie',
      description: 'Premium quality with embroidered logo',
      price: 2500,
      currency: 'tokens',
      type: 'physical',
      category: 'merch',
      thumbnail: '/api/placeholder/300/400',
      sales: 28,
      rating: 4.8,
      reviews: 22,
      available: true,
      shipping: 'Worldwide'
    },
    {
      id: 13,
      title: 'Workout Set',
      description: 'Matching sports bra & leggings',
      price: 3000,
      currency: 'tokens',
      type: 'physical',
      category: 'merch',
      thumbnail: '/api/placeholder/300/400',
      sales: 19,
      rating: 4.9,
      reviews: 15,
      available: true,
      shipping: 'Worldwide'
    },
    {
      id: 14,
      title: 'Silk Pajama Set',
      description: 'Luxury sleepwear with monogram',
      price: 4500,
      currency: 'tokens',
      type: 'physical',
      category: 'merch',
      thumbnail: '/api/placeholder/300/400',
      sales: 12,
      rating: 5.0,
      reviews: 10,
      available: true,
      shipping: 'Worldwide'
    },
    {
      id: 15,
      title: 'Handmade Artwork',
      description: 'Original drawing/painting by creator',
      price: 6000,
      currency: 'tokens',
      type: 'physical',
      category: 'art',
      thumbnail: '/api/placeholder/300/400',
      sales: 7,
      rating: 5.0,
      reviews: 6,
      available: true,
      shipping: 'Worldwide'
    }
  ], []);

  // Map tabs to their respective products
  const getProductsByCategory = () => {
    switch(activeTab) {
      case 'memorabilia':
        return memorabiliaProducts;
      case 'romantic':
        return romanticProducts;
      case 'branded':
        return brandedProducts;
      default:
        return memorabiliaProducts;
    }
  };

  const currentProducts = getProductsByCategory();

  // Memoize stats calculation to prevent recalculation on every render
  const stats = useMemo(() => {
    const allProducts = [...memorabiliaProducts, ...romanticProducts, ...brandedProducts];
    const totalSales = allProducts.reduce((sum, p) => sum + p.sales, 0);
    const totalRevenue = allProducts.reduce((sum, p) => sum + (p.sales * p.price), 0);
    const avgRating = allProducts.reduce((sum, p) => sum + p.rating, 0) / allProducts.length;
    
    return {
      totalProducts: allProducts.length,
      totalSales,
      totalRevenue,
      avgRating: avgRating.toFixed(1),
      topProduct: allProducts.sort((a, b) => b.sales - a.sales)[0]
    };
  }, [memorabiliaProducts, romanticProducts, brandedProducts]);

  const handleNavigateToShop = () => {
    navigate('/shop');
  };

  const handleAddProduct = () => {
    setEditingProduct(null);
    setProductForm({
      name: '',
      description: '',
      price: '',
      category: 'polaroid',
      image_url: '',
      stock_quantity: null,
      is_active: true
    });
    setSelectedImage(null);
    setImagePreview(null);
    setShowAddProduct(true);
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
        ? `${import.meta.env.VITE_BACKEND_URL}/shop/items/${editingProduct.id}`
        : `${import.meta.env.VITE_BACKEND_URL}/shop/items`;
      
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
          category: 'polaroid',
          image_url: '',
          stock_quantity: null,
          is_active: true
        });
        setSelectedImage(null);
        setImagePreview(null);
        // Refresh products if callback provided
        if (onAddProduct) {
          onAddProduct();
        }
      }
    } catch (error) {
      console.error('Error saving product:', error);
      toast.error('Failed to save product');
    } finally {
      setUploadingImage(false);
    }
  };

  const tabs = [
    { id: 'memorabilia', label: '📸 Memorabilia', icon: CameraIcon, count: memorabiliaProducts.length },
    { id: 'romantic', label: '💌 Romantic', icon: HeartIcon, count: romanticProducts.length },
    { id: 'branded', label: '👕 Merchandise', icon: BagIcon, count: brandedProducts.length }
  ];

  // Mobile compact layout
  if (mobile) {
    return (
      <div className="space-y-3">
        {/* Compact product grid - 2 columns for mobile */}
        {currentProducts.length === 0 ? (
          <div className="text-center py-8">
            <ShoppingBagIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No products yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {currentProducts.map((product) => (
              <motion.div
                key={product.id}
                whileTap={{ scale: 0.98 }}
                className="bg-white rounded-lg border border-gray-200 overflow-hidden"
                onClick={() => navigate(`/shop/product/${product.id}`)}
              >
                {/* Compact Product Image */}
                <div className="relative aspect-square bg-gradient-to-br from-purple-100 to-pink-100">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <ShoppingBagIcon className="w-8 h-8 text-purple-300" />
                  </div>
                  {product.highValue && (
                    <div className="absolute top-1 left-1 bg-yellow-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-semibold">
                      Premium
                    </div>
                  )}
                  {product.available && (
                    <div className="absolute top-1 right-1 w-2 h-2 bg-green-500 rounded-full"></div>
                  )}
                </div>

                {/* Compact Product Info */}
                <div className="p-2">
                  <h4 className="font-medium text-xs mb-1 line-clamp-1">{product.title}</h4>

                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-bold text-purple-600">{product.price.toLocaleString()}</span>
                      <span className="text-[10px] text-gray-500 ml-0.5">tokens</span>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <StarIcon className="w-3 h-3 text-yellow-500" />
                      <span className="text-[10px] text-gray-600">{product.rating}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Desktop full layout
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden flex flex-col mb-8"
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
              <ShoppingBagIcon className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Creator Shop - Product Catalog</h2>
              <p className="text-purple-100 text-sm">
                Non-media content marketplace for creators
                <span className="ml-2 font-mono bg-white/20 px-2 py-0.5 rounded">
                  digis.cc/{user?.username || 'username'}/shop
                </span>
              </p>
            </div>
          </div>
          <Button
            variant="primary"
            onClick={handleAddProduct}
            className="bg-white/20 backdrop-blur text-white hover:bg-white/30"
            icon={<PlusIcon className="w-5 h-5" />}
          >
            Add Product
          </Button>
        </div>

        {/* Quick Stats */}
        {showQuickStats && (
          <div className="grid grid-cols-4 gap-4 mt-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
              <div className="flex items-center justify-between">
                <ShoppingCartIcon className="w-5 h-5 text-purple-200" />
                <span className="text-xs text-purple-200">Total Sales</span>
              </div>
              <p className="text-2xl font-bold text-white mt-1">{stats.totalSales}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
              <div className="flex items-center justify-between">
                <CurrencyDollarIcon className="w-5 h-5 text-purple-200" />
                <span className="text-xs text-purple-200">Revenue</span>
              </div>
              <p className="text-2xl font-bold text-white mt-1">{stats.totalRevenue}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
              <div className="flex items-center justify-between">
                <StarIcon className="w-5 h-5 text-purple-200" />
                <span className="text-xs text-purple-200">Avg Rating</span>
              </div>
              <p className="text-2xl font-bold text-white mt-1">{stats.avgRating}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
              <div className="flex items-center justify-between">
                <TagIcon className="w-5 h-5 text-purple-200" />
                <span className="text-xs text-purple-200">Products</span>
              </div>
              <p className="text-2xl font-bold text-white mt-1">{stats.totalProducts}</p>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 bg-gray-50">
        <div className="flex">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 px-6 py-4 text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                  activeTab === tab.id
                    ? 'text-purple-600 border-b-2 border-purple-600 bg-white'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{tab.label}</span>
                <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                  activeTab === tab.id
                    ? 'bg-purple-100 text-purple-700'
                    : 'bg-gray-200 text-gray-600'
                }`}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Products Grid - Full Display */}
      <div className="p-6">
        {currentProducts.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-gray-100 rounded-full mx-auto mb-4 flex items-center justify-center">
              <ShoppingBagIcon className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No {activeTab} products yet
            </h3>
            <p className="text-gray-500 mb-6">
              Start adding products to your shop
            </p>
            <Button
              variant="primary"
              onClick={handleAddProduct}
              icon={<PlusIcon className="w-5 h-5" />}
            >
              Add Product
            </Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 mb-6">
              {currentProducts.map((product) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 1 }}
                  animate={{ opacity: 1 }}
                  whileHover={{ y: -2 }}
                  className="bg-white dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600 overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                  onMouseEnter={() => setHoveredProduct(product.id)}
                  onMouseLeave={() => setHoveredProduct(null)}
                  onClick={() => navigate(`/shop/product/${product.id}`)}
                >
                  {/* Product Image */}
                  <div className="relative aspect-[3/4] bg-gradient-to-br from-purple-100 to-pink-100">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <ShoppingBagIcon className="w-12 h-12 text-purple-300" />
                    </div>
                    {product.highValue && (
                      <div className="absolute top-2 left-2 bg-gradient-to-r from-yellow-400 to-amber-500 text-white text-xs px-2 py-1 rounded-full font-semibold">
                        High Value
                      </div>
                    )}
                    {product.intimate && (
                      <div className="absolute top-2 left-2 bg-gradient-to-r from-pink-500 to-rose-500 text-white text-xs px-2 py-1 rounded-full font-semibold">
                        Intimate
                      </div>
                    )}
                    {product.available && (
                      <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                        Available
                      </div>
                    )}
                    {product.type === 'physical' && product.shipping && (
                      <div className="absolute bottom-2 left-2 bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
                        {product.shipping}
                      </div>
                    )}
                  </div>

                  {/* Product Info */}
                  <div className="p-3">
                    <h4 className="font-semibold text-gray-900 text-sm mb-1 line-clamp-1">{product.title}</h4>
                    <p className="text-xs text-gray-600 mb-2 line-clamp-2">{product.description}</p>
                    
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1">
                        <StarIcon className="w-3 h-3 text-yellow-500" />
                        <span className="text-xs font-medium">{product.rating}</span>
                        <span className="text-xs text-gray-500">({product.reviews})</span>
                      </div>
                      <div className="text-xs text-gray-600">
                        {product.sales} sold
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                      <div>
                        <span className="text-lg font-bold text-purple-600">{product.price.toLocaleString()}</span>
                        <span className="text-xs text-gray-500 ml-1">tokens</span>
                      </div>
                      <button
                        className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-700 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/shop/product/${product.id}/edit`);
                        }}
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Add/Edit Product Modal - Same as Shop Management */}
      <AnimatePresence>
        {showAddProduct && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
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
                      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                        {editingProduct ? 'Edit Product' : 'Add New Product'}
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
    </motion.div>
  );
};

export default CreatorShopSection;