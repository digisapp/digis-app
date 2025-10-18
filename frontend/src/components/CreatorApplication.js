import React, { useState } from 'react';
import { supabase } from '../utils/supabase-auth.js';
import toast from 'react-hot-toast';
import { getAuthToken } from '../utils/auth-helpers';

const CreatorApplication = ({ onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    bio: '',
    specialties: [],
    experience: '',
    socialMedia: {
      instagram: '',
      twitter: '',
      tiktok: '',
      youtube: ''
    },
    pricing: {
      videoCall: 30,
      voiceCall: 20,
      privateStream: 50
    },
    availability: {
      timezone: 'UTC',
      schedule: []
    },
    agreeToTerms: false,
    over18: false
  });
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);

  const specialtyOptions = [
    'Gaming', 'Music', 'Art', 'Model', 'Fitness', 'Cooking', 'Dance', 'Comedy',
    'Education', 'Lifestyle', 'Fashion', 'Tech', 'Sports', 'Travel',
    'Photography', 'Crafts', 'Beauty', 'Business', 'Meditation'
  ];

  const handleInputChange = (field, value) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  const handleSpecialtyToggle = (specialty) => {
    setFormData(prev => {
      if (prev.specialties.includes(specialty)) {
        // Remove if already selected
        return {
          ...prev,
          specialties: prev.specialties.filter(s => s !== specialty)
        };
      } else if (prev.specialties.length < 5) {
        // Add if under limit of 5
        return {
          ...prev,
          specialties: [...prev.specialties, specialty]
        };
      } else {
        // Show warning if at limit
        toast.error('You can select up to 5 categories');
        return prev;
      }
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!formData.agreeToTerms || !formData.over18) {
        throw new Error('Please agree to all terms and confirm you are 18+');
      }

      if (formData.specialties.length === 0) {
        throw new Error('Please select at least one specialty');
      }

      const authToken = await getAuthToken();
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/users/apply-creator`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Application submission failed');
      }

      const result = await response.json();
      
      // toast.success('🎉 Creator application submitted successfully!');
      onSuccess(result);
      onClose();
    } catch (error) {
      console.error('Application error:', error);
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const renderStep1 = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Tell us about yourself</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Bio (Tell fans what makes you special)
            </label>
            <textarea
              value={formData.bio}
              onChange={(e) => handleInputChange('bio', e.target.value)}
              placeholder="Share your story, what you're passionate about, and what fans can expect..."
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={4}
              maxLength={500}
              required
            />
            <div className="text-right text-sm text-gray-500 mt-1">
              {formData.bio.length}/500 characters
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Your Categories (Select up to 5)
            </label>
            <div className="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto">
              {specialtyOptions.map(specialty => (
                <button
                  key={specialty}
                  type="button"
                  onClick={() => handleSpecialtyToggle(specialty)}
                  className={`p-2 text-sm rounded-lg border transition-colors ${
                    formData.specialties.includes(specialty)
                      ? 'bg-blue-500 text-white border-blue-500'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-blue-300'
                  }`}
                >
                  {formData.specialties.includes(specialty) && '✓ '}
                  {specialty}
                </button>
              ))}
            </div>
            <div className="text-sm text-gray-500 mt-2">
              {formData.specialties.length}/5 selected: {formData.specialties.join(', ') || 'None'}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Experience Level
            </label>
            <select
              value={formData.experience}
              onChange={(e) => handleInputChange('experience', e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Select your experience</option>
              <option value="beginner">Beginner (0-1 years)</option>
              <option value="intermediate">Intermediate (1-3 years)</option>
              <option value="experienced">Experienced (3-5 years)</option>
              <option value="expert">Expert (5+ years)</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Social Media & Pricing</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Social Media Links (Optional)
            </label>
            <div className="space-y-3">
              {Object.entries(formData.socialMedia).map(([platform, value]) => (
                <div key={platform}>
                  <label className="block text-sm text-gray-600 capitalize mb-1">
                    {platform}
                  </label>
                  <input
                    type="url"
                    value={value}
                    onChange={(e) => handleInputChange(`socialMedia.${platform}`, e.target.value)}
                    placeholder={`https://${platform}.com/yourusername`}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Set Your Token Rates (tokens per minute)
            </label>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Video Calls
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    min="1"
                    max="500"
                    value={formData.pricing.videoCall}
                    onChange={(e) => handleInputChange('pricing.videoCall', parseInt(e.target.value))}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-500">tokens/min</span>
                </div>
              </div>
              
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Voice Calls
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    min="1"
                    max="500"
                    value={formData.pricing.voiceCall}
                    onChange={(e) => handleInputChange('pricing.voiceCall', parseInt(e.target.value))}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-500">tokens/min</span>
                </div>
              </div>
              
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Private Streams
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    min="1"
                    max="500"
                    value={formData.pricing.privateStream}
                    onChange={(e) => handleInputChange('pricing.privateStream', parseInt(e.target.value))}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-500">tokens/min</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Final Steps</h3>
        
        <div className="space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h4 className="font-medium text-yellow-800 mb-2">Review Process</h4>
            <p className="text-sm text-yellow-700">
              Your application will be reviewed by our team within 24-48 hours. 
              We'll notify you via email once approved. You can check your status 
              in your profile settings.
            </p>
          </div>

          <div className="space-y-3">
            <label className="flex items-start space-x-3">
              <input
                type="checkbox"
                checked={formData.over18}
                onChange={(e) => handleInputChange('over18', e.target.checked)}
                className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                required
              />
              <span className="text-sm text-gray-700">
                I confirm that I am 18 years of age or older
              </span>
            </label>

            <label className="flex items-start space-x-3">
              <input
                type="checkbox"
                checked={formData.agreeToTerms}
                onChange={(e) => handleInputChange('agreeToTerms', e.target.checked)}
                className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                required
              />
              <span className="text-sm text-gray-700">
                I agree to the{' '}
                <a href="/terms" className="text-blue-600 hover:underline">
                  Terms of Service
                </a>{' '}
                and{' '}
                <a href="/privacy" className="text-blue-600 hover:underline">
                  Privacy Policy
                </a>
              </span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                Apply to Become a Creator
              </h2>
              <p className="text-gray-600 mt-1">
                Step {step} of 3 - {
                  step === 1 ? 'About You' : 
                  step === 2 ? 'Social & Pricing' : 
                  'Review & Submit'
                }
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>
          
          {/* Progress Bar */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              {[1, 2, 3].map(stepNum => (
                <div
                  key={stepNum}
                  className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                    stepNum <= step 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {stepNum}
                </div>
              ))}
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(step / 3) * 100}%` }}
              />
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}

          <div className="flex justify-between mt-8 pt-6 border-t border-gray-200">
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Previous
              </button>
            )}
            
            <div className="ml-auto">
              {step < 3 ? (
                <button
                  type="button"
                  onClick={() => setStep(step + 1)}
                  disabled={
                    (step === 1 && (!formData.bio || formData.specialties.length === 0 || !formData.experience)) ||
                    (step === 2 && (!formData.pricing.videoCall || !formData.pricing.voiceCall || !formData.pricing.privateStream))
                  }
                  className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={loading || !formData.agreeToTerms || !formData.over18}
                  className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      Submitting...
                    </>
                  ) : (
                    'Submit Application'
                  )}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreatorApplication;