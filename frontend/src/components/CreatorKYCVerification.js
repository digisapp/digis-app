import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  DocumentTextIcon,
  IdentificationIcon,
  HomeIcon,
  ArrowRightIcon,
  ShieldCheckIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

const CreatorKYCVerification = ({ user, onVerificationComplete }) => {
  const [verificationStatus, setVerificationStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState('overview');
  const [taxFormData, setTaxFormData] = useState({
    formType: '',
    taxId: '',
    businessName: '',
    businessType: 'individual'
  });
  const [addressData, setAddressData] = useState({
    line1: '',
    line2: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'US'
  });

  useEffect(() => {
    checkVerificationStatus();
  }, []);

  const checkVerificationStatus = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/kyc/status`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      const data = await response.json();
      setVerificationStatus(data);
      
      // Determine current step based on status
      if (!data.identity_document_verified) {
        setCurrentStep('identity');
      } else if (data.tax_form_status === 'not_submitted') {
        setCurrentStep('tax');
      } else if (!data.address_verified) {
        setCurrentStep('address');
      } else if (data.payouts_enabled) {
        setCurrentStep('complete');
      }
    } catch (error) {
      console.error('Error checking KYC status:', error);
      toast.error('Failed to load verification status');
    } finally {
      setLoading(false);
    }
  };

  const startIdentityVerification = async () => {
    try {
      setLoading(true);
      
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/kyc/start-verification`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (data.error) {
        toast.error(data.error);
        return;
      }
      
      // Load Stripe and create verification session
      const stripe = await stripePromise;
      const { error } = await stripe.verifyIdentity(data.clientSecret);
      
      if (error) {
        toast.error('Verification cancelled or failed');
      } else {
        toast.success('Identity verification submitted!');
        checkVerificationStatus();
      }
    } catch (error) {
      console.error('Error starting verification:', error);
      toast.error('Failed to start verification');
    } finally {
      setLoading(false);
    }
  };

  const submitTaxForm = async () => {
    try {
      setLoading(true);
      
      // Validate tax form data
      if (!taxFormData.formType || !taxFormData.taxId) {
        toast.error('Please fill in all required fields');
        return;
      }
      
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/kyc/tax-form`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(taxFormData)
      });
      
      const data = await response.json();
      
      if (data.error) {
        toast.error(data.error);
      } else {
        toast.success('Tax form submitted successfully!');
        setCurrentStep('address');
        checkVerificationStatus();
      }
    } catch (error) {
      console.error('Error submitting tax form:', error);
      toast.error('Failed to submit tax form');
    } finally {
      setLoading(false);
    }
  };

  const submitAddress = async () => {
    try {
      setLoading(true);
      
      // Validate address data
      if (!addressData.line1 || !addressData.city || !addressData.postalCode || !addressData.country) {
        toast.error('Please fill in all required fields');
        return;
      }
      
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/kyc/verify-address`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(addressData)
      });
      
      const data = await response.json();
      
      if (data.error) {
        toast.error(data.error);
      } else {
        toast.success('Address verified successfully!');
        checkVerificationStatus();
        if (onVerificationComplete) {
          onVerificationComplete();
        }
      }
    } catch (error) {
      console.error('Error submitting address:', error);
      toast.error('Failed to verify address');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  const getStatusIcon = (isComplete) => {
    if (isComplete) {
      return <CheckCircleIcon className="h-6 w-6 text-green-500" />;
    }
    return <XCircleIcon className="h-6 w-6 text-gray-400" />;
  };

  const renderOverview = () => (
    <div className="space-y-6">
      <div className="bg-yellow-500/10 border border-yellow-500/50 rounded-lg p-4">
        <div className="flex items-start">
          <ExclamationTriangleIcon className="h-6 w-6 text-yellow-500 mt-1 mr-3 flex-shrink-0" />
          <div>
            <h3 className="text-lg font-semibold text-yellow-400">Verification Required</h3>
            <p className="text-sm text-gray-300 mt-1">
              To receive payouts, you must complete identity verification and tax documentation.
              This is required by law and helps us ensure a safe platform for everyone.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-xl font-bold text-white">Verification Steps</h3>
        
        {/* Identity Verification */}
        <div className="bg-white/5 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center">
            <IdentificationIcon className="h-8 w-8 text-purple-400 mr-4" />
            <div>
              <h4 className="font-semibold text-white">Identity Verification</h4>
              <p className="text-sm text-gray-400">Verify your identity with a government ID</p>
            </div>
          </div>
          {getStatusIcon(verificationStatus?.identity_document_verified)}
        </div>

        {/* Tax Documentation */}
        <div className="bg-white/5 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center">
            <DocumentTextIcon className="h-8 w-8 text-purple-400 mr-4" />
            <div>
              <h4 className="font-semibold text-white">Tax Documentation</h4>
              <p className="text-sm text-gray-400">Submit W-9 (US) or W-8BEN (International)</p>
            </div>
          </div>
          {getStatusIcon(verificationStatus?.tax_form_status !== 'not_submitted')}
        </div>

        {/* Address Verification */}
        <div className="bg-white/5 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center">
            <HomeIcon className="h-8 w-8 text-purple-400 mr-4" />
            <div>
              <h4 className="font-semibold text-white">Address Verification</h4>
              <p className="text-sm text-gray-400">Confirm your residential address</p>
            </div>
          </div>
          {getStatusIcon(verificationStatus?.address_verified)}
        </div>
      </div>

      {verificationStatus?.payout_hold_reason && (
        <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4">
          <p className="text-sm text-red-400">
            <strong>Payouts on hold:</strong> {verificationStatus.payout_hold_reason}
          </p>
        </div>
      )}

      <button
        onClick={() => setCurrentStep('identity')}
        disabled={verificationStatus?.payouts_enabled}
        className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
      >
        {verificationStatus?.payouts_enabled ? (
          <>
            <CheckCircleIcon className="h-5 w-5 mr-2" />
            Verification Complete
          </>
        ) : (
          <>
            Start Verification
            <ArrowRightIcon className="h-5 w-5 ml-2" />
          </>
        )}
      </button>
    </div>
  );

  const renderIdentityVerification = () => (
    <div className="space-y-6">
      <h3 className="text-xl font-bold text-white">Identity Verification</h3>
      
      <div className="bg-white/5 rounded-lg p-6 space-y-4">
        <div className="flex items-center mb-4">
          <ShieldCheckIcon className="h-8 w-8 text-purple-400 mr-3" />
          <div>
            <h4 className="font-semibold text-white">Secure Verification with Stripe</h4>
            <p className="text-sm text-gray-400">Your information is encrypted and secure</p>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm text-gray-300">You'll need:</p>
          <ul className="list-disc list-inside text-sm text-gray-400 space-y-1 ml-4">
            <li>A valid government-issued photo ID (driver's license, passport, or ID card)</li>
            <li>A device with a camera for taking photos</li>
            <li>Good lighting for clear photos</li>
            <li>5-10 minutes to complete the process</li>
          </ul>
        </div>

        <div className="bg-blue-500/10 border border-blue-500/50 rounded-lg p-4">
          <p className="text-sm text-blue-400">
            <strong>Privacy Notice:</strong> Your ID and selfie are only used for verification 
            and are securely stored by our verification partner, Stripe.
          </p>
        </div>
      </div>

      <button
        onClick={startIdentityVerification}
        disabled={loading || verificationStatus?.identity_document_verified}
        className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {verificationStatus?.identity_document_verified ? (
          <>
            <CheckCircleIcon className="h-5 w-5 mr-2 inline" />
            Identity Verified
          </>
        ) : (
          'Start Identity Verification'
        )}
      </button>

      {verificationStatus?.identity_document_verified && (
        <button
          onClick={() => setCurrentStep('tax')}
          className="w-full py-3 bg-white/10 text-white rounded-lg font-semibold hover:bg-white/20 transition-all"
        >
          Continue to Tax Documentation
          <ArrowRightIcon className="h-5 w-5 ml-2 inline" />
        </button>
      )}
    </div>
  );

  const renderTaxForm = () => (
    <div className="space-y-6">
      <h3 className="text-xl font-bold text-white">Tax Documentation</h3>
      
      <div className="bg-white/5 rounded-lg p-6 space-y-4">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Select Tax Form Type
            </label>
            <select
              value={taxFormData.formType}
              onChange={(e) => setTaxFormData({ ...taxFormData, formType: e.target.value })}
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="">Select form type...</option>
              <option value="W-9">W-9 (US Citizens/Residents)</option>
              <option value="W-8BEN">W-8BEN (Individual Non-US)</option>
              <option value="W-8BEN-E">W-8BEN-E (Entity Non-US)</option>
            </select>
          </div>

          {taxFormData.formType === 'W-9' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Tax ID (SSN or EIN)
                </label>
                <input
                  type="text"
                  value={taxFormData.taxId}
                  onChange={(e) => setTaxFormData({ ...taxFormData, taxId: e.target.value })}
                  placeholder="XXX-XX-XXXX or XX-XXXXXXX"
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Legal Name (optional for individuals)
                </label>
                <input
                  type="text"
                  value={taxFormData.businessName}
                  onChange={(e) => setTaxFormData({ ...taxFormData, businessName: e.target.value })}
                  placeholder="Business name if applicable"
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </>
          )}

          {(taxFormData.formType === 'W-8BEN' || taxFormData.formType === 'W-8BEN-E') && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Foreign Tax ID
                </label>
                <input
                  type="text"
                  value={taxFormData.taxId}
                  onChange={(e) => setTaxFormData({ ...taxFormData, taxId: e.target.value })}
                  placeholder="Your country's tax identification number"
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </>
          )}
        </div>

        <div className="bg-blue-500/10 border border-blue-500/50 rounded-lg p-4">
          <p className="text-sm text-blue-400">
            <strong>Note:</strong> Tax information is encrypted and only used for IRS reporting 
            when required. You'll receive 1099 forms if you earn over $600 in a year (US only).
          </p>
        </div>
      </div>

      <button
        onClick={submitTaxForm}
        disabled={loading || !taxFormData.formType || !taxFormData.taxId}
        className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Submit Tax Form
      </button>
    </div>
  );

  const renderAddressVerification = () => (
    <div className="space-y-6">
      <h3 className="text-xl font-bold text-white">Address Verification</h3>
      
      <div className="bg-white/5 rounded-lg p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Street Address *
            </label>
            <input
              type="text"
              value={addressData.line1}
              onChange={(e) => setAddressData({ ...addressData, line1: e.target.value })}
              placeholder="123 Main Street"
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Apartment/Suite (optional)
            </label>
            <input
              type="text"
              value={addressData.line2}
              onChange={(e) => setAddressData({ ...addressData, line2: e.target.value })}
              placeholder="Apt 4B"
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              City *
            </label>
            <input
              type="text"
              value={addressData.city}
              onChange={(e) => setAddressData({ ...addressData, city: e.target.value })}
              placeholder="New York"
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              State/Province
            </label>
            <input
              type="text"
              value={addressData.state}
              onChange={(e) => setAddressData({ ...addressData, state: e.target.value })}
              placeholder="NY"
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Postal Code *
            </label>
            <input
              type="text"
              value={addressData.postalCode}
              onChange={(e) => setAddressData({ ...addressData, postalCode: e.target.value })}
              placeholder="10001"
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Country *
            </label>
            <select
              value={addressData.country}
              onChange={(e) => setAddressData({ ...addressData, country: e.target.value })}
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="US">United States</option>
              <option value="CA">Canada</option>
              <option value="GB">United Kingdom</option>
              <option value="AU">Australia</option>
              <option value="DE">Germany</option>
              <option value="FR">France</option>
              <option value="ES">Spain</option>
              <option value="IT">Italy</option>
              <option value="JP">Japan</option>
              <option value="BR">Brazil</option>
              <option value="MX">Mexico</option>
              <option value="IN">India</option>
            </select>
          </div>
        </div>

        <div className="bg-blue-500/10 border border-blue-500/50 rounded-lg p-4">
          <p className="text-sm text-blue-400">
            <strong>Privacy:</strong> Your address is kept confidential and only used for 
            tax reporting and payout processing.
          </p>
        </div>
      </div>

      <button
        onClick={submitAddress}
        disabled={loading || !addressData.line1 || !addressData.city || !addressData.postalCode}
        className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Verify Address & Complete
      </button>
    </div>
  );

  const renderComplete = () => (
    <div className="space-y-6">
      <div className="bg-green-500/10 border border-green-500/50 rounded-lg p-6">
        <div className="flex items-start">
          <CheckCircleIcon className="h-8 w-8 text-green-500 mt-1 mr-3 flex-shrink-0" />
          <div>
            <h3 className="text-xl font-bold text-green-400">Verification Complete!</h3>
            <p className="text-sm text-gray-300 mt-2">
              Your identity has been verified and all documentation is complete. 
              You can now receive payouts from your creator earnings.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white/5 rounded-lg p-6">
        <h4 className="font-semibold text-white mb-4">Verification Details</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Identity Status:</span>
            <span className="text-green-400">Verified</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Tax Form:</span>
            <span className="text-green-400">{verificationStatus?.tax_form_status}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Address:</span>
            <span className="text-green-400">Verified</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Payouts:</span>
            <span className="text-green-400">Enabled</span>
          </div>
        </div>
      </div>

      <div className="bg-blue-500/10 border border-blue-500/50 rounded-lg p-4">
        <p className="text-sm text-blue-400">
          <strong>Next Steps:</strong> Connect your bank account or debit card in the 
          Payout Settings to receive your earnings.
        </p>
      </div>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto">
      {currentStep === 'overview' && renderOverview()}
      {currentStep === 'identity' && renderIdentityVerification()}
      {currentStep === 'tax' && renderTaxForm()}
      {currentStep === 'address' && renderAddressVerification()}
      {currentStep === 'complete' && renderComplete()}
    </div>
  );
};

export default CreatorKYCVerification;