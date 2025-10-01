import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  XMarkIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  ClockIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';
import ClientIntakeForm from './ClientIntakeForm';
import IntakeFormsManager from './IntakeFormsManager';
import { customToast } from './ui/EnhancedToaster';
import { getAuthToken } from '../utils/supabase-auth';

const ClientIntakeModal = ({ 
  isOpen, 
  onClose,
  clientData,
  creatorType = 'general',
  sessionId = null,
  onFormSubmitted,
  mode = 'auto' // 'auto', 'form', or 'manager'
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savedDraft, setSavedDraft] = useState(null);

  const handleFormSubmit = async (formData) => {
    setIsSubmitting(true);
    try {
      const token = await getAuthToken();
      if (!token) {
        customToast.error('Authentication required');
        return;
      }

      // API call would go here
      await new Promise(resolve => setTimeout(resolve, 1500));

      customToast.success('Intake form submitted successfully!', {
        icon: '📋'
      });

      if (onFormSubmitted) {
        onFormSubmitted({
          ...formData,
          sessionId,
          clientId: clientData?.id,
          submittedAt: new Date().toISOString()
        });
      }

      onClose();
    } catch (error) {
      customToast.error('Failed to submit intake form');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveDraft = (formData) => {
    setSavedDraft(formData);
    // In a real app, this would save to localStorage or backend
    customToast.success('Draft saved locally', { icon: '💾' });
  };

  if (!isOpen) return null;

  // Determine which view to show based on mode or auto-detection
  const showManager = mode === 'manager' || (mode === 'auto' && !clientData && !sessionId);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className={`bg-gray-50 rounded-2xl ${showManager ? 'max-w-6xl' : 'max-w-4xl'} w-full max-h-[90vh] overflow-hidden`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <DocumentTextIcon className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">
                    {showManager ? 'Manage Client Intake Forms' : 'Client Intake Form'}
                  </h2>
                  <p className="text-purple-100 text-sm">
                    {showManager 
                      ? 'View and manage all client intake forms' 
                      : clientData 
                        ? `For ${clientData.displayName || clientData.username}` 
                        : 'New Client Information'}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                disabled={isSubmitting}
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Info Banner - Only show for form view */}
          {!showManager && (
            <div className="bg-blue-50 border-b border-blue-200 px-6 py-4">
              <div className="flex items-start gap-3">
                <InformationCircleIcon className="w-5 h-5 text-blue-600 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">First Session Intake</p>
                  <p>This comprehensive form helps us understand your needs and create a personalized program. It typically takes 5-10 minutes to complete.</p>
                </div>
              </div>
            </div>
          )}

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
            {showManager ? (
              <IntakeFormsManager creatorType={creatorType} />
            ) : (
              <ClientIntakeForm
                creatorType={creatorType}
                clientName={clientData?.displayName || clientData?.username || ''}
                onSubmit={handleFormSubmit}
                onSave={handleSaveDraft}
                prefillData={savedDraft}
              />
            )}
          </div>

          {/* Status Bar - Only show for form view */}
          {!showManager && isSubmitting && (
            <div className="bg-gray-100 border-t border-gray-200 px-6 py-3">
              <div className="flex items-center gap-3">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-purple-600 border-t-transparent" />
                <p className="text-sm text-gray-600">Submitting form...</p>
              </div>
            </div>
          )}

          {!showManager && savedDraft && !isSubmitting && (
            <div className="bg-green-50 border-t border-green-200 px-6 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircleIcon className="w-4 h-4 text-green-600" />
                  <p className="text-sm text-green-800">Draft saved</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-green-600">
                  <ClockIcon className="w-3 h-3" />
                  <span>Auto-saved {new Date().toLocaleTimeString()}</span>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ClientIntakeModal;