import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { api } from '../services/api';
import Button from './ui/Button';
import Input from './ui/Input';
import Select from './ui/Select';

const MembershipTierForm = ({ tier, onSuccess, onCancel }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: 9.99,
    tierLevel: 1,
    color: '#8B5CF6',
    benefits: [''],
    tokensIncluded: 100,
    sessionDiscountPercent: 0,
    exclusiveContent: false,
    prioritySupport: false,
    customEmojis: false,
    badgeIcon: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (tier) {
      setFormData({
        name: tier.name || '',
        description: tier.description || '',
        price: tier.price || 9.99,
        tierLevel: tier.tierLevel || 1,
        color: tier.color || '#8B5CF6',
        benefits: tier.benefits?.length ? tier.benefits : [''],
        tokensIncluded: tier.tokensIncluded || 100,
        sessionDiscountPercent: tier.sessionDiscountPercent || 0,
        exclusiveContent: tier.exclusiveContent || false,
        prioritySupport: tier.prioritySupport || false,
        customEmojis: tier.customEmojis || false,
        badgeIcon: tier.badgeIcon || ''
      });
    }
  }, [tier]);

  const predefinedColors = [
    { value: '#8B5CF6', label: 'Purple', preview: 'bg-purple-500' },
    { value: '#EC4899', label: 'Pink', preview: 'bg-pink-500' },
    { value: '#3B82F6', label: 'Blue', preview: 'bg-blue-500' },
    { value: '#10B981', label: 'Emerald', preview: 'bg-emerald-500' },
    { value: '#F59E0B', label: 'Amber', preview: 'bg-amber-500' },
    { value: '#EF4444', label: 'Red', preview: 'bg-red-500' },
    { value: '#6366F1', label: 'Indigo', preview: 'bg-indigo-500' },
    { value: '#84CC16', label: 'Lime', preview: 'bg-lime-500' }
  ];

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Tier name is required';
    }
    
    if (formData.price < 0.99) {
      newErrors.price = 'Price must be at least $0.99';
    }
    
    if (formData.tierLevel < 1 || formData.tierLevel > 10) {
      newErrors.tierLevel = 'Tier level must be between 1 and 10';
    }
    
    if (formData.benefits.filter(b => b.trim()).length === 0) {
      newErrors.benefits = 'At least one benefit is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    try {
      setLoading(true);
      
      const submitData = {
        ...formData,
        benefits: formData.benefits.filter(b => b.trim())
      };
      
      const endpoint = tier 
        ? `/membership-tiers/tiers/${tier.id}`
        : '/api/membership-tiers/tiers';
      
      const method = tier ? 'put' : 'post';
      const response = await api[method](endpoint, submitData);
      
      if (response.data.success) {
        onSuccess();
      }
    } catch (error) {
      console.error('Error saving tier:', error);
      setErrors({ submit: 'Failed to save tier. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const addBenefit = () => {
    setFormData(prev => ({
      ...prev,
      benefits: [...prev.benefits, '']
    }));
  };

  const removeBenefit = (index) => {
    setFormData(prev => ({
      ...prev,
      benefits: prev.benefits.filter((_, i) => i !== index)
    }));
  };

  const updateBenefit = (index, value) => {
    setFormData(prev => ({
      ...prev,
      benefits: prev.benefits.map((benefit, i) => i === index ? value : benefit)
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Basic Information
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Tier Name"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="e.g., Silver, Gold, Premium"
            error={errors.name}
            required
          />
          
          <Input
            label="Price ($/month)"
            type="number"
            step="0.01"
            min="0.99"
            value={formData.price}
            onChange={(e) => setFormData(prev => ({ ...prev, price: parseFloat(e.target.value) }))}
            error={errors.price}
            required
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Description
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Describe what this tier includes"
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-800 dark:text-white"
          />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Tier Level (1-10)"
            type="number"
            min="1"
            max="10"
            value={formData.tierLevel}
            onChange={(e) => setFormData(prev => ({ ...prev, tierLevel: parseInt(e.target.value) }))}
            error={errors.tierLevel}
            required
            helperText="Higher levels should offer more benefits"
          />
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Tier Color
            </label>
            <div className="grid grid-cols-4 gap-2">
              {predefinedColors.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, color: color.value }))}
                  className={`w-full h-10 rounded-lg border-2 transition-all ${
                    formData.color === color.value 
                      ? 'border-gray-900 dark:border-white scale-110' 
                      : 'border-gray-300 dark:border-gray-600 hover:scale-105'
                  }`}
                  style={{ backgroundColor: color.value }}
                  title={color.label}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Benefits */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Tier Benefits
          </h3>
          <Button
            type="button"
            onClick={addBenefit}
            variant="secondary"
            className="text-sm px-3 py-1"
          >
            + Add Benefit
          </Button>
        </div>
        
        <div className="space-y-3">
          {formData.benefits.map((benefit, index) => (
            <div key={index} className="flex items-center space-x-3">
              <div className="flex-1">
                <Input
                  value={benefit}
                  onChange={(e) => updateBenefit(index, e.target.value)}
                  placeholder="Enter benefit description"
                />
              </div>
              {formData.benefits.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeBenefit(index)}
                  className="text-red-600 hover:text-red-800 p-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
        
        {errors.benefits && (
          <p className="text-red-600 text-sm">{errors.benefits}</p>
        )}
      </div>

      {/* Perks & Features */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Special Perks
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Bonus Tokens (monthly)"
            type="number"
            min="0"
            value={formData.tokensIncluded}
            onChange={(e) => setFormData(prev => ({ ...prev, tokensIncluded: parseInt(e.target.value) || 0 }))}
            helperText="Free tokens included each month"
          />
          
          <Input
            label="Session Discount (%)"
            type="number"
            min="0"
            max="50"
            value={formData.sessionDiscountPercent}
            onChange={(e) => setFormData(prev => ({ ...prev, sessionDiscountPercent: parseInt(e.target.value) || 0 }))}
            helperText="Discount on session pricing"
          />
        </div>
        
        <Input
          label="Badge Icon (emoji or character)"
          value={formData.badgeIcon}
          onChange={(e) => setFormData(prev => ({ ...prev, badgeIcon: e.target.value }))}
          placeholder="🌟"
          maxLength="2"
          helperText="Icon to display next to member's name"
        />
        
        <div className="space-y-3">
          <div className="flex items-center">
            <input
              type="checkbox"
              id="exclusiveContent"
              checked={formData.exclusiveContent}
              onChange={(e) => setFormData(prev => ({ ...prev, exclusiveContent: e.target.checked }))}
              className="mr-3 h-4 w-4 text-purple-600 rounded focus:ring-purple-500"
            />
            <label htmlFor="exclusiveContent" className="text-sm text-gray-700 dark:text-gray-300">
              Access to exclusive content
            </label>
          </div>
          
          <div className="flex items-center">
            <input
              type="checkbox"
              id="prioritySupport"
              checked={formData.prioritySupport}
              onChange={(e) => setFormData(prev => ({ ...prev, prioritySupport: e.target.checked }))}
              className="mr-3 h-4 w-4 text-purple-600 rounded focus:ring-purple-500"
            />
            <label htmlFor="prioritySupport" className="text-sm text-gray-700 dark:text-gray-300">
              Priority customer support
            </label>
          </div>
          
          <div className="flex items-center">
            <input
              type="checkbox"
              id="customEmojis"
              checked={formData.customEmojis}
              onChange={(e) => setFormData(prev => ({ ...prev, customEmojis: e.target.checked }))}
              className="mr-3 h-4 w-4 text-purple-600 rounded focus:ring-purple-500"
            />
            <label htmlFor="customEmojis" className="text-sm text-gray-700 dark:text-gray-300">
              Custom emoji reactions in chat
            </label>
          </div>
        </div>
      </div>

      {/* Preview */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Preview
        </h3>
        
        <div className="p-6 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl">
          <motion.div
            className="relative overflow-hidden rounded-xl p-6"
            style={{ 
              background: `linear-gradient(135deg, ${formData.color}15, ${formData.color}25)`,
              border: `2px solid ${formData.color}40`
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div 
                  className="w-12 h-12 rounded-full flex items-center justify-center text-white text-xl font-bold"
                  style={{ backgroundColor: formData.color }}
                >
                  {formData.badgeIcon || formData.tierLevel}
                </div>
                <div>
                  <h4 className="text-xl font-bold text-gray-900 dark:text-white">
                    {formData.name || 'Tier Name'}
                  </h4>
                  <p className="text-gray-600 dark:text-gray-400">
                    Level {formData.tierLevel}
                  </p>
                </div>
              </div>
              
              <div className="text-right">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  ${formData.price}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  per month
                </div>
              </div>
            </div>
            
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              {formData.description || 'Tier description will appear here'}
            </p>
            
            <div className="space-y-2">
              {formData.benefits.filter(b => b.trim()).map((benefit, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {benefit}
                  </span>
                </div>
              ))}
            </div>
            
            {(formData.tokensIncluded > 0 || formData.sessionDiscountPercent > 0 || 
              formData.exclusiveContent || formData.prioritySupport || formData.customEmojis) && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                  {formData.tokensIncluded > 0 && (
                    <div>💰 {formData.tokensIncluded} bonus tokens monthly</div>
                  )}
                  {formData.sessionDiscountPercent > 0 && (
                    <div>💸 {formData.sessionDiscountPercent}% session discount</div>
                  )}
                  {formData.exclusiveContent && <div>🔒 Exclusive content access</div>}
                  {formData.prioritySupport && <div>⚡ Priority support</div>}
                  {formData.customEmojis && <div>😊 Custom emoji reactions</div>}
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </div>

      {/* Submit Buttons */}
      <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <Button
          type="button"
          onClick={onCancel}
          variant="secondary"
          className="px-6 py-2"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          loading={loading}
          disabled={loading}
          className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-2"
        >
          {tier ? 'Update Tier' : 'Create Tier'}
        </Button>
      </div>
      
      {errors.submit && (
        <p className="text-red-600 text-sm text-center">{errors.submit}</p>
      )}
    </form>
  );
};

export default MembershipTierForm;