import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DocumentTextIcon,
  HeartIcon,
  ScaleIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ChevronRightIcon,
  ChevronLeftIcon
} from '@heroicons/react/24/outline';
import Button from './ui/Button';

const ClientIntakeForm = ({ 
  creatorType = 'general',
  clientName = '',
  onSubmit,
  onSave,
  prefillData = null
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState(prefillData || {
    // Basic Information
    fullName: clientName || '',
    email: '',
    phone: '',
    dateOfBirth: '',
    emergencyContact: {
      name: '',
      phone: '',
      relationship: ''
    },
    // Health & Wellness Specific
    currentMedications: '',
    allergies: '',
    medicalConditions: '',
    previousInjuries: '',
    // Goals & Expectations
    primaryGoals: [],
    timelineExpectations: '',
    previousExperience: '',
    currentChallenges: '',
    // Lifestyle
    sleepHours: '',
    stressLevel: '',
    activityLevel: '',
    dietaryRestrictions: '',
    // Preferences
    preferredSessionTime: '',
    communicationPreference: '',
    motivationStyle: '',
    // Consent
    consentToTreatment: false,
    privacyAgreement: false,
    photoVideoConsent: false
  });

  const getFormSteps = () => {
    const baseSteps = [
      { id: 'basic', title: 'Basic Information', icon: DocumentTextIcon },
      { id: 'goals', title: 'Goals & Expectations', icon: CheckCircleIcon }
    ];

    const healthSteps = [
      { id: 'health', title: 'Health Information', icon: HeartIcon },
      { id: 'lifestyle', title: 'Lifestyle Assessment', icon: ScaleIcon }
    ];

    const professionalSteps = {
      'health-coach': [...baseSteps.slice(0, 1), ...healthSteps, ...baseSteps.slice(1)],
      'yoga': [...baseSteps.slice(0, 1), healthSteps[0], ...baseSteps.slice(1)],
      'fitness': [...baseSteps.slice(0, 1), ...healthSteps, ...baseSteps.slice(1)],
      'wellness': [...baseSteps.slice(0, 1), ...healthSteps, ...baseSteps.slice(1)],
      'consultant': baseSteps,
      'general': baseSteps
    };

    const steps = professionalSteps[creatorType] || professionalSteps.general;
    return [...steps, { id: 'consent', title: 'Consent & Agreement', icon: DocumentTextIcon }];
  };

  const steps = getFormSteps();

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
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  };

  const handleGoalToggle = (goal) => {
    setFormData(prev => ({
      ...prev,
      primaryGoals: prev.primaryGoals.includes(goal)
        ? prev.primaryGoals.filter(g => g !== goal)
        : [...prev.primaryGoals, goal]
    }));
  };

  const getGoalOptions = () => {
    const goalsByType = {
      'health-coach': [
        'Weight Management',
        'Stress Reduction',
        'Better Sleep',
        'Increased Energy',
        'Nutrition Improvement',
        'Habit Formation',
        'Disease Prevention',
        'Mental Clarity'
      ],
      'yoga': [
        'Flexibility Improvement',
        'Stress Relief',
        'Strength Building',
        'Balance Enhancement',
        'Injury Recovery',
        'Meditation Practice',
        'Posture Correction',
        'Spiritual Growth'
      ],
      'fitness': [
        'Weight Loss',
        'Muscle Building',
        'Endurance Training',
        'Athletic Performance',
        'Injury Prevention',
        'Functional Fitness',
        'Competition Prep',
        'Body Recomposition'
      ],
      'wellness': [
        'Holistic Health',
        'Work-Life Balance',
        'Mindfulness',
        'Emotional Wellness',
        'Lifestyle Change',
        'Self-Care Routine',
        'Energy Optimization',
        'Longevity'
      ],
      'consultant': [
        'Business Growth',
        'Career Advancement',
        'Skill Development',
        'Process Improvement',
        'Strategic Planning',
        'Team Building',
        'Leadership Development',
        'Problem Solving'
      ]
    };

    return goalsByType[creatorType] || goalsByType.consultant;
  };

  const renderStepContent = () => {
    const stepId = steps[currentStep].id;

    switch (stepId) {
      case 'basic':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Full Name *
              </label>
              <input
                type="text"
                value={formData.fullName}
                onChange={(e) => handleInputChange('fullName', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                placeholder="Enter full name"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="email@example.com"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="(123) 456-7890"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date of Birth
              </label>
              <input
                type="date"
                value={formData.dateOfBirth}
                onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium text-gray-900 mb-3">Emergency Contact</h4>
              <div className="space-y-3">
                <input
                  type="text"
                  value={formData.emergencyContact.name}
                  onChange={(e) => handleInputChange('emergencyContact.name', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="Contact name"
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="tel"
                    value={formData.emergencyContact.phone}
                    onChange={(e) => handleInputChange('emergencyContact.phone', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    placeholder="Phone number"
                  />
                  <input
                    type="text"
                    value={formData.emergencyContact.relationship}
                    onChange={(e) => handleInputChange('emergencyContact.relationship', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    placeholder="Relationship"
                  />
                </div>
              </div>
            </div>
          </div>
        );

      case 'health':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Current Medications
              </label>
              <textarea
                value={formData.currentMedications}
                onChange={(e) => handleInputChange('currentMedications', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                rows={3}
                placeholder="List any medications you're currently taking..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Allergies
              </label>
              <input
                type="text"
                value={formData.allergies}
                onChange={(e) => handleInputChange('allergies', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                placeholder="Food, environmental, medication allergies..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Medical Conditions
              </label>
              <textarea
                value={formData.medicalConditions}
                onChange={(e) => handleInputChange('medicalConditions', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                rows={3}
                placeholder="Any current or past medical conditions..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Previous Injuries
              </label>
              <textarea
                value={formData.previousInjuries}
                onChange={(e) => handleInputChange('previousInjuries', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                rows={2}
                placeholder="Any injuries or physical limitations..."
              />
            </div>
          </div>
        );

      case 'lifestyle':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Average Sleep Hours per Night
              </label>
              <select
                value={formData.sleepHours}
                onChange={(e) => handleInputChange('sleepHours', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                <option value="">Select hours</option>
                <option value="less-than-5">Less than 5 hours</option>
                <option value="5-6">5-6 hours</option>
                <option value="6-7">6-7 hours</option>
                <option value="7-8">7-8 hours</option>
                <option value="more-than-8">More than 8 hours</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Current Stress Level
              </label>
              <select
                value={formData.stressLevel}
                onChange={(e) => handleInputChange('stressLevel', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                <option value="">Select level</option>
                <option value="low">Low - Manageable</option>
                <option value="moderate">Moderate - Some challenges</option>
                <option value="high">High - Significant stress</option>
                <option value="very-high">Very High - Overwhelming</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Physical Activity Level
              </label>
              <select
                value={formData.activityLevel}
                onChange={(e) => handleInputChange('activityLevel', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                <option value="">Select level</option>
                <option value="sedentary">Sedentary - Little to no exercise</option>
                <option value="light">Light - 1-2 days per week</option>
                <option value="moderate">Moderate - 3-4 days per week</option>
                <option value="active">Active - 5-6 days per week</option>
                <option value="very-active">Very Active - Daily exercise</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Dietary Restrictions or Preferences
              </label>
              <input
                type="text"
                value={formData.dietaryRestrictions}
                onChange={(e) => handleInputChange('dietaryRestrictions', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                placeholder="Vegetarian, vegan, gluten-free, etc..."
              />
            </div>
          </div>
        );

      case 'goals':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Primary Goals (Select all that apply)
              </label>
              <div className="grid grid-cols-2 gap-3">
                {getGoalOptions().map((goal) => (
                  <label
                    key={goal}
                    className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={formData.primaryGoals.includes(goal)}
                      onChange={() => handleGoalToggle(goal)}
                      className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-sm">{goal}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Timeline Expectations
              </label>
              <select
                value={formData.timelineExpectations}
                onChange={(e) => handleInputChange('timelineExpectations', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                <option value="">Select timeline</option>
                <option value="1-month">1 month</option>
                <option value="3-months">3 months</option>
                <option value="6-months">6 months</option>
                <option value="12-months">12 months</option>
                <option value="ongoing">Ongoing/No specific timeline</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Previous Experience
              </label>
              <textarea
                value={formData.previousExperience}
                onChange={(e) => handleInputChange('previousExperience', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                rows={3}
                placeholder={`Previous experience with ${
                  creatorType === 'yoga' ? 'yoga practice' :
                  creatorType === 'fitness' ? 'fitness training' :
                  creatorType === 'health-coach' ? 'health coaching' :
                  creatorType === 'wellness' ? 'wellness programs' :
                  'similar services'
                }...`}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Current Challenges
              </label>
              <textarea
                value={formData.currentChallenges}
                onChange={(e) => handleInputChange('currentChallenges', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                rows={3}
                placeholder="What obstacles are you currently facing?"
              />
            </div>
          </div>
        );

      case 'consent':
        return (
          <div className="space-y-6">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-3">Agreements & Consent</h4>
              <p className="text-sm text-gray-600 mb-4">
                Please review and agree to the following terms:
              </p>
            </div>

            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={formData.consentToTreatment}
                onChange={(e) => handleInputChange('consentToTreatment', e.target.checked)}
                className="mt-1 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              />
              <div>
                <p className="font-medium text-gray-900">Consent to Services</p>
                <p className="text-sm text-gray-600 mt-1">
                  I consent to participate in {
                    creatorType === 'health-coach' ? 'health coaching sessions' :
                    creatorType === 'yoga' ? 'yoga instruction' :
                    creatorType === 'fitness' ? 'fitness training' :
                    creatorType === 'wellness' ? 'wellness consultations' :
                    'professional services'
                  } and understand that results may vary based on individual commitment and circumstances.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={formData.privacyAgreement}
                onChange={(e) => handleInputChange('privacyAgreement', e.target.checked)}
                className="mt-1 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              />
              <div>
                <p className="font-medium text-gray-900">Privacy & Confidentiality</p>
                <p className="text-sm text-gray-600 mt-1">
                  I understand that all information shared during sessions will be kept confidential, 
                  except as required by law or with my explicit consent.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={formData.photoVideoConsent}
                onChange={(e) => handleInputChange('photoVideoConsent', e.target.checked)}
                className="mt-1 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              />
              <div>
                <p className="font-medium text-gray-900">Photo/Video Consent (Optional)</p>
                <p className="text-sm text-gray-600 mt-1">
                  I consent to having my sessions recorded for quality assurance and educational purposes. 
                  I understand I can revoke this consent at any time.
                </p>
              </div>
            </label>

            <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start gap-2">
                <ExclamationCircleIcon className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div className="text-sm text-yellow-800">
                  <p className="font-medium">Important Notice</p>
                  <p className="mt-1">
                    {creatorType === 'health-coach' || creatorType === 'wellness' 
                      ? 'This service is not a substitute for medical advice. Please consult your healthcare provider for medical concerns.'
                      : creatorType === 'fitness' || creatorType === 'yoga'
                      ? 'Please consult your physician before beginning any exercise program.'
                      : 'Professional services are provided for informational and educational purposes.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const isStepValid = () => {
    const stepId = steps[currentStep].id;
    
    switch (stepId) {
      case 'basic':
        return formData.fullName && formData.email;
      case 'consent':
        return formData.consentToTreatment && formData.privacyAgreement;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = () => {
    if (onSubmit) {
      onSubmit({
        ...formData,
        completedAt: new Date().toISOString(),
        formVersion: '1.0'
      });
    }
  };

  const handleSave = () => {
    if (onSave) {
      onSave(formData);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={`flex items-center ${index < steps.length - 1 ? 'flex-1' : ''}`}
            >
              <div
                className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                  index < currentStep
                    ? 'bg-purple-600 border-purple-600 text-white'
                    : index === currentStep
                    ? 'border-purple-600 text-purple-600'
                    : 'border-gray-300 text-gray-400'
                }`}
              >
                {index < currentStep ? (
                  <CheckCircleIcon className="w-6 h-6" />
                ) : (
                  <step.icon className="w-6 h-6" />
                )}
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`flex-1 h-1 mx-2 ${
                    index < currentStep ? 'bg-purple-600' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={`text-xs ${
                index === currentStep ? 'text-purple-600 font-medium' : 'text-gray-500'
              }`}
            >
              {step.title}
            </div>
          ))}
        </div>
      </div>

      {/* Form Content */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">
          {steps[currentStep].title}
        </h3>
        
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {renderStepContent()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div className="mt-6 flex items-center justify-between">
        <Button
          variant="secondary"
          onClick={handlePrevious}
          disabled={currentStep === 0}
          icon={<ChevronLeftIcon className="w-5 h-5" />}
        >
          Previous
        </Button>

        <div className="flex items-center gap-3">
          {onSave && (
            <Button
              variant="secondary"
              onClick={handleSave}
            >
              Save Draft
            </Button>
          )}
          
          {currentStep === steps.length - 1 ? (
            <Button
              variant="primary"
              onClick={handleSubmit}
              disabled={!isStepValid()}
            >
              Submit Form
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={handleNext}
              disabled={!isStepValid()}
              icon={<ChevronRightIcon className="w-5 h-5" />}
              iconPosition="right"
            >
              Next
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClientIntakeForm;