import React, { useState, useEffect, useRef } from 'react';
import {
  ShoppingBagIcon,
  CheckIcon,
  ChevronDownIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { api } from '../../services/api';

const SimpleProductSelector = ({ selectedProducts, onProductsChange }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    // Close dropdown when clicking outside
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const response = await api.get('/shop/creator/products');
      const productsData = response.data?.products || [];
      setProducts(productsData);
    } catch (error) {
      console.error('Error fetching products:', error);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleProduct = (product) => {
    const isSelected = selectedProducts.some(p => p.id === product.id);
    if (isSelected) {
      onProductsChange(selectedProducts.filter(p => p.id !== product.id));
    } else {
      onProductsChange([...selectedProducts, product]);
    }
  };

  const removeProduct = (productId) => {
    onProductsChange(selectedProducts.filter(p => p.id !== productId));
  };

  if (loading) {
    return (
      <div className="text-center py-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600 mx-auto"></div>
        <p className="text-xs text-gray-500 mt-2">Loading products...</p>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="bg-white rounded-lg p-3 text-center">
        <ShoppingBagIcon className="w-10 h-10 text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-500">No products in your shop yet</p>
        <p className="text-xs text-gray-400 mt-1">Create products first to showcase during streams</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Dropdown Selector */}
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-lg text-left flex items-center justify-between hover:border-purple-400 transition-colors"
        >
          <span className="text-sm text-gray-700">
            {selectedProducts.length === 0
              ? 'Select products to showcase...'
              : `${selectedProducts.length} product${selectedProducts.length !== 1 ? 's' : ''} selected`
            }
          </span>
          <ChevronDownIcon className={`w-4 h-4 text-gray-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Dropdown Menu */}
        {dropdownOpen && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {products.map(product => {
              const isSelected = selectedProducts.some(p => p.id === product.id);

              return (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => toggleProduct(product)}
                  className={`
                    w-full px-3 py-2 flex items-center gap-2 text-left hover:bg-gray-50 transition-colors
                    ${isSelected ? 'bg-purple-50' : ''}
                  `}
                >
                  {/* Checkbox */}
                  <div className={`
                    w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0
                    ${isSelected ? 'bg-purple-600 border-purple-600' : 'border-gray-300'}
                  `}>
                    {isSelected && <CheckIcon className="w-3 h-3 text-white" />}
                  </div>

                  {/* Product Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
                    <p className="text-xs text-purple-600">{product.price_tokens} tokens</p>
                  </div>

                  {/* Stock */}
                  {product.stock_quantity !== null && (
                    <span className="text-xs text-gray-500">
                      Stock: {product.stock_quantity}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Selected Products Tags */}
      {selectedProducts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedProducts.map(product => (
            <div
              key={product.id}
              className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs"
            >
              <span className="font-medium">{product.name}</span>
              <span className="text-purple-500">({product.price_tokens}t)</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeProduct(product.id);
                }}
                className="ml-1 hover:text-purple-900"
              >
                <XMarkIcon className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Quick Actions */}
      {products.length > 0 && (
        <div className="flex gap-2 text-xs">
          <button
            type="button"
            onClick={() => onProductsChange(products)}
            className="text-purple-600 hover:text-purple-700 font-medium"
          >
            Select All ({products.length})
          </button>
          {selectedProducts.length > 0 && (
            <>
              <span className="text-gray-400">•</span>
              <button
                type="button"
                onClick={() => onProductsChange([])}
                className="text-gray-600 hover:text-gray-700 font-medium"
              >
                Clear All
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default SimpleProductSelector;