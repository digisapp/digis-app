import React, { useState } from 'react';
import {
  CurrencyDollarIcon,
  TagIcon,
  CalendarDaysIcon,
  SparklesIcon,
  CheckIcon,
  PlusIcon
} from '@heroicons/react/24/outline';

const PackageDealsSection = ({ 
  creatorType = 'general',
  basePrice = { video: 8, voice: 6 },
  onPackageSelect
}) => {
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [showCustom, setShowCustom] = useState(false);
  const [customPackage, setCustomPackage] = useState({
    sessions: 4,
    duration: 30,
    type: 'video',
    discount: 10
  });

  // Profession-specific package templates
  const getPackageTemplates = () => {
    const templates = {
      'health-coach': [
        {
          id: 'starter',
          name: 'Wellness Starter',
          sessions: 4,
          duration: 45,
          type: 'video',
          frequency: 'Weekly sessions',
          discount: 10,
          description: 'Perfect for beginning your health journey',
          features: [
            'Initial health assessment',
            'Personalized wellness plan',
            'Weekly check-ins',
            'Email support between sessions'
          ],
          popular: false
        },
        {
          id: 'transformation',
          name: '90-Day Transformation',
          sessions: 12,
          duration: 45,
          type: 'video',
          frequency: 'Weekly sessions',
          discount: 20,
          description: 'Comprehensive health transformation program',
          features: [
            'Full health assessment',
            'Custom meal plans',
            'Exercise recommendations',
            'Daily accountability check-ins',
            'Progress tracking dashboard'
          ],
          popular: true
        },
        {
          id: 'maintenance',
          name: 'Monthly Maintenance',
          sessions: 2,
          duration: 30,
          type: 'video',
          frequency: 'Bi-weekly sessions',
          discount: 5,
          description: 'For ongoing support and accountability',
          features: [
            'Progress reviews',
            'Plan adjustments',
            'Motivation support'
          ],
          popular: false
        }
      ],
      'yoga': [
        {
          id: 'beginner',
          name: 'Beginner Series',
          sessions: 8,
          duration: 60,
          type: 'video',
          frequency: 'Twice weekly',
          discount: 15,
          description: 'Foundation building for new practitioners',
          features: [
            'Basic pose alignment',
            'Breathing techniques',
            'Flexibility assessment',
            'Home practice sequences'
          ],
          popular: false
        },
        {
          id: 'monthly',
          name: 'Monthly Unlimited',
          sessions: 8,
          duration: 60,
          type: 'video',
          frequency: '2x per week',
          discount: 25,
          description: 'Regular practice for committed students',
          features: [
            'Varied class styles',
            'Progressive sequences',
            'Pose modifications',
            'Meditation guidance',
            'Practice videos'
          ],
          popular: true
        },
        {
          id: 'intensive',
          name: 'Intensive Workshop',
          sessions: 5,
          duration: 90,
          type: 'video',
          frequency: 'Daily for 1 week',
          discount: 20,
          description: 'Deep dive into specific techniques',
          features: [
            'Advanced poses',
            'Philosophy discussions',
            'Personal adjustments',
            'Certificate of completion'
          ],
          popular: false
        }
      ],
      'fitness': [
        {
          id: 'kickstart',
          name: '4-Week Kickstart',
          sessions: 8,
          duration: 45,
          type: 'video',
          frequency: '2x per week',
          discount: 15,
          description: 'Jump-start your fitness journey',
          features: [
            'Fitness assessment',
            'Custom workout plan',
            'Form correction',
            'Nutrition basics'
          ],
          popular: false
        },
        {
          id: 'transformation',
          name: '12-Week Transformation',
          sessions: 24,
          duration: 45,
          type: 'video',
          frequency: '2x per week',
          discount: 25,
          description: 'Complete body transformation program',
          features: [
            'Progressive training plan',
            'Nutrition coaching',
            'Weekly measurements',
            'Exercise video library',
            '24/7 chat support'
          ],
          popular: true
        },
        {
          id: 'athlete',
          name: 'Athletic Performance',
          sessions: 12,
          duration: 60,
          type: 'video',
          frequency: 'Weekly sessions',
          discount: 20,
          description: 'Sport-specific training program',
          features: [
            'Performance testing',
            'Sport-specific drills',
            'Injury prevention',
            'Competition prep'
          ],
          popular: false
        }
      ],
      'wellness': [
        {
          id: 'discovery',
          name: 'Wellness Discovery',
          sessions: 6,
          duration: 60,
          type: 'video',
          frequency: 'Weekly sessions',
          discount: 15,
          description: 'Explore holistic wellness practices',
          features: [
            'Lifestyle assessment',
            'Stress management tools',
            'Mindfulness practices',
            'Sleep optimization'
          ],
          popular: false
        },
        {
          id: 'balance',
          name: 'Life Balance Program',
          sessions: 10,
          duration: 60,
          type: 'video',
          frequency: 'Weekly sessions',
          discount: 20,
          description: 'Create sustainable life balance',
          features: [
            'Work-life integration',
            'Energy management',
            'Relationship wellness',
            'Personal growth plan',
            'Monthly group sessions'
          ],
          popular: true
        }
      ],
      'consultant': [
        {
          id: 'strategy',
          name: 'Strategy Sprint',
          sessions: 4,
          duration: 90,
          type: 'video',
          frequency: 'Weekly intensive',
          discount: 10,
          description: 'Rapid business strategy development',
          features: [
            'Business audit',
            'Strategy roadmap',
            'Action plan',
            'Follow-up support'
          ],
          popular: false
        },
        {
          id: 'growth',
          name: 'Growth Accelerator',
          sessions: 12,
          duration: 60,
          type: 'video',
          frequency: 'Weekly sessions',
          discount: 20,
          description: '3-month business growth program',
          features: [
            'Growth strategy',
            'Weekly coaching',
            'KPI tracking',
            'Resource templates',
            'Email support'
          ],
          popular: true
        }
      ]
    };

    return templates[creatorType] || [
      {
        id: 'basic',
        name: 'Starter Package',
        sessions: 4,
        duration: 30,
        type: 'video',
        frequency: 'Weekly sessions',
        discount: 10,
        description: 'Great for getting started',
        features: ['Regular sessions', 'Email support'],
        popular: false
      },
      {
        id: 'premium',
        name: 'Premium Package',
        sessions: 8,
        duration: 45,
        type: 'video',
        frequency: 'Twice weekly',
        discount: 20,
        description: 'Our most popular package',
        features: ['Priority booking', 'Extended sessions', 'Chat support'],
        popular: true
      }
    ];
  };

  const calculatePackagePrice = (pkg) => {
    const baseRate = pkg.type === 'video' ? basePrice.video : basePrice.voice;
    const totalMinutes = pkg.sessions * pkg.duration;
    const originalPrice = totalMinutes * baseRate;
    const discountAmount = (originalPrice * pkg.discount) / 100;
    const finalPrice = originalPrice - discountAmount;
    
    return {
      original: originalPrice,
      discount: discountAmount,
      final: finalPrice,
      perSession: finalPrice / pkg.sessions
    };
  };

  const packages = getPackageTemplates();

  const handleSelectPackage = (pkg) => {
    setSelectedPackage(pkg.id);
    const pricing = calculatePackagePrice(pkg);
    onPackageSelect?.({
      ...pkg,
      pricing
    });
  };

  const handleCustomPackage = () => {
    const pricing = calculatePackagePrice(customPackage);
    onPackageSelect?.({
      ...customPackage,
      id: 'custom',
      name: 'Custom Package',
      frequency: 'As scheduled',
      description: 'Tailored to your needs',
      features: ['Flexible scheduling', 'Custom duration'],
      pricing
    });
    setSelectedPackage('custom');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium text-gray-700">
          Package Deals
        </label>
        <button
          type="button"
          onClick={() => setShowCustom(!showCustom)}
          className="text-xs text-purple-600 hover:text-purple-700 font-medium"
        >
          {showCustom ? 'View Presets' : 'Create Custom'}
        </button>
      </div>

      {!showCustom ? (
        <div className="grid gap-3">
          {packages.map((pkg) => {
            const pricing = calculatePackagePrice(pkg);
            const isSelected = selectedPackage === pkg.id;
            
            return (
              <div
                key={pkg.id}
                onClick={() => handleSelectPackage(pkg)}
                className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  isSelected 
                    ? 'border-purple-600 bg-purple-50' 
                    : 'border-gray-200 hover:border-purple-300'
                }`}
              >
                {pkg.popular && (
                  <div className="absolute -top-3 left-4 px-3 py-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-bold rounded-full">
                    MOST POPULAR
                  </div>
                )}
                
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-semibold text-gray-900">{pkg.name}</h4>
                    <p className="text-sm text-gray-600 mt-1">{pkg.description}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <CalendarDaysIcon className="w-3.5 h-3.5" />
                        {pkg.sessions} sessions
                      </span>
                      <span>{pkg.duration} min each</span>
                      <span>{pkg.frequency}</span>
                    </div>
                  </div>
                  {isSelected && (
                    <div className="p-1.5 bg-purple-600 rounded-full">
                      <CheckIcon className="w-4 h-4 text-white" />
                    </div>
                  )}
                </div>

                <div className="space-y-2 mb-3">
                  {pkg.features.map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-sm">
                      <CheckIcon className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-700">{feature}</span>
                    </div>
                  ))}
                </div>

                <div className="border-t pt-3">
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-sm text-gray-500 line-through">
                        {pricing.original.toLocaleString()} tokens
                      </p>
                      <p className="text-2xl font-bold text-gray-900">
                        {pricing.final.toLocaleString()} tokens
                      </p>
                      <p className="text-xs text-gray-600">
                        {pricing.perSession.toFixed(0)} tokens per session
                      </p>
                    </div>
                    <div className="px-3 py-1 bg-green-100 text-green-700 rounded-full">
                      <span className="text-sm font-medium">Save {pkg.discount}%</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-4 border-2 border-dashed border-gray-300 rounded-xl">
          <h4 className="font-medium text-gray-900 mb-3">Create Custom Package</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-600">Number of Sessions</label>
              <input
                type="number"
                min="2"
                max="50"
                value={customPackage.sessions}
                onChange={(e) => setCustomPackage({ ...customPackage, sessions: parseInt(e.target.value) || 4 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-600">Duration (minutes)</label>
              <select
                value={customPackage.duration}
                onChange={(e) => setCustomPackage({ ...customPackage, duration: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value={15}>15 min</option>
                <option value={30}>30 min</option>
                <option value={45}>45 min</option>
                <option value={60}>60 min</option>
                <option value={90}>90 min</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-600">Call Type</label>
              <select
                value={customPackage.type}
                onChange={(e) => setCustomPackage({ ...customPackage, type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="video">Video</option>
                <option value="voice">Voice</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-600">Discount %</label>
              <input
                type="number"
                min="0"
                max="50"
                value={customPackage.discount}
                onChange={(e) => setCustomPackage({ ...customPackage, discount: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>
          
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Package Price:</span>
              <span className="font-bold text-gray-900">
                {calculatePackagePrice(customPackage).final.toLocaleString()} tokens
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-gray-500 mt-1">
              <span>Per session:</span>
              <span>{calculatePackagePrice(customPackage).perSession.toFixed(0)} tokens</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCustomPackage}
            className="w-full mt-3 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium"
          >
            Use Custom Package
          </button>
        </div>
      )}
    </div>
  );
};

export default PackageDealsSection;