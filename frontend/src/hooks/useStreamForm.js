import { useState, useCallback, useMemo } from 'react';

/**
 * Hook for managing and validating stream form data
 * @returns {Object} - Form state, handlers, validation, and errors
 */
export function useStreamForm() {
  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    tags: [],
    isPrivate: false,
    ticketPrice: '',
    maxViewers: ''
  });

  // Validation errors
  const [errors, setErrors] = useState({});

  // Update single field
  const updateField = useCallback((field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field when user types
    setErrors(prev => ({ ...prev, [field]: null }));
  }, []);

  // Add tag with validation
  const addTag = useCallback((tag) => {
    const normalized = tag.trim().toLowerCase();
    
    // Validation
    if (!normalized) return false;
    if (normalized.length > 20) {
      setErrors(prev => ({ ...prev, tags: 'Tag must be 20 characters or less' }));
      return false;
    }
    if (!/^[a-z0-9-]+$/.test(normalized)) {
      setErrors(prev => ({ ...prev, tags: 'Tags can only contain letters, numbers, and hyphens' }));
      return false;
    }
    if (formData.tags.includes(normalized)) {
      setErrors(prev => ({ ...prev, tags: 'Tag already added' }));
      return false;
    }
    if (formData.tags.length >= 5) {
      setErrors(prev => ({ ...prev, tags: 'Maximum 5 tags allowed' }));
      return false;
    }

    setFormData(prev => ({
      ...prev,
      tags: [...prev.tags, normalized]
    }));
    setErrors(prev => ({ ...prev, tags: null }));
    return true;
  }, [formData.tags]);

  // Remove tag
  const removeTag = useCallback((tag) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t !== tag)
    }));
  }, []);

  // Parse and validate numbers
  const parsePositiveInt = useCallback((value, field) => {
    const trimmed = value.trim();
    if (!trimmed) {
      updateField(field, '');
      return;
    }
    
    const num = parseInt(trimmed, 10);
    if (Number.isNaN(num) || num <= 0) {
      setErrors(prev => ({ ...prev, [field]: 'Must be a positive number' }));
      return;
    }
    
    updateField(field, num.toString());
  }, [updateField]);

  // Validate entire form
  const validate = useCallback(() => {
    const newErrors = {};
    
    // Title validation (required, 3-60 chars)
    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    } else if (formData.title.trim().length < 3) {
      newErrors.title = 'Title must be at least 3 characters';
    } else if (formData.title.length > 60) {
      newErrors.title = 'Title must be 60 characters or less';
    }
    
    // Description validation (optional, max 200 chars)
    if (formData.description.length > 200) {
      newErrors.description = 'Description must be 200 characters or less';
    }
    
    // Category validation (required)
    if (!formData.category) {
      newErrors.category = 'Please select a category';
    }
    
    // Private stream validation
    if (formData.isPrivate) {
      if (!formData.ticketPrice || formData.ticketPrice === '0') {
        newErrors.ticketPrice = 'Ticket price is required for private streams';
      } else {
        const price = parseInt(formData.ticketPrice, 10);
        if (Number.isNaN(price) || price <= 0) {
          newErrors.ticketPrice = 'Price must be a positive number';
        } else if (price > 10000) {
          newErrors.ticketPrice = 'Price cannot exceed 10,000 tokens';
        }
      }
      
      if (formData.maxViewers) {
        const max = parseInt(formData.maxViewers, 10);
        if (Number.isNaN(max) || max <= 0) {
          newErrors.maxViewers = 'Must be a positive number';
        } else if (max > 1000) {
          newErrors.maxViewers = 'Cannot exceed 1000 viewers';
        }
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  // Check if step is valid
  const isStepValid = useCallback((step) => {
    switch (step) {
      case 1:
        return formData.title.trim().length >= 3 && formData.category;
      case 2:
        return !formData.isPrivate || (formData.ticketPrice && parseInt(formData.ticketPrice, 10) > 0);
      case 3:
        return true; // Preview step is always valid if we got here
      default:
        return false;
    }
  }, [formData]);

  // Get form data for submission
  const getSubmissionData = useCallback(() => {
    return {
      title: formData.title.trim(),
      description: formData.description.trim(),
      category: formData.category,
      tags: formData.tags,
      isPrivate: formData.isPrivate,
      ticketPrice: formData.isPrivate ? parseInt(formData.ticketPrice, 10) : 0,
      maxViewers: formData.maxViewers ? parseInt(formData.maxViewers, 10) : null,
      cameraEnabled: true, // Always true per requirements
      micEnabled: true // Always true per requirements
    };
  }, [formData]);

  // Reset form
  const reset = useCallback(() => {
    setFormData({
      title: '',
      description: '',
      category: '',
      tags: [],
      isPrivate: false,
      ticketPrice: '',
      maxViewers: ''
    });
    setErrors({});
  }, []);

  // Character counters
  const counters = useMemo(() => ({
    title: `${formData.title.length}/60`,
    description: `${formData.description.length}/200`,
    tags: `${formData.tags.length}/5`
  }), [formData]);

  return {
    formData,
    errors,
    counters,
    updateField,
    addTag,
    removeTag,
    parsePositiveInt,
    validate,
    isStepValid,
    getSubmissionData,
    reset
  };
}

export default useStreamForm;