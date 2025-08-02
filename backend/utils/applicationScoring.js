// Application scoring utility for creator applications
// Calculates quality score from 0-100 based on various criteria

const calculateApplicationScore = (application) => {
  let totalScore = 0;
  const breakdown = {};

  // 1. Bio Quality (25 points)
  const bioScore = calculateBioScore(application.bio);
  breakdown.bioQuality = bioScore;
  totalScore += bioScore;

  // 2. Social Media Presence (20 points)
  const socialScore = calculateSocialScore(application.social_media);
  breakdown.socialPresence = socialScore;
  totalScore += socialScore;

  // 3. Experience Level (15 points)
  const experienceScore = calculateExperienceScore(application.experience);
  breakdown.experience = experienceScore;
  totalScore += experienceScore;

  // 4. Application Completeness (20 points)
  const completenessScore = calculateCompletenessScore(application);
  breakdown.completeness = completenessScore;
  totalScore += completenessScore;

  // 5. Pricing Reasonableness (10 points)
  const pricingScore = calculatePricingScore(application.pricing);
  breakdown.pricing = pricingScore;
  totalScore += pricingScore;

  // 6. Specialty Match (10 points)
  const specialtyScore = calculateSpecialtyScore(application.specialties);
  breakdown.specialties = specialtyScore;
  totalScore += specialtyScore;

  return {
    totalScore: Math.round(totalScore),
    breakdown,
    grade: getScoreGrade(totalScore),
    recommendation: getRecommendation(totalScore)
  };
};

const calculateBioScore = (bio) => {
  if (!bio || typeof bio !== 'string') return 0;
  
  let score = 0;
  const length = bio.trim().length;
  
  // Length scoring (0-15 points)
  if (length >= 200) score += 15;
  else if (length >= 150) score += 12;
  else if (length >= 100) score += 8;
  else if (length >= 50) score += 4;
  
  // Quality indicators (0-10 points)
  const qualityKeywords = [
    'experience', 'passionate', 'professional', 'dedicated', 'expert',
    'skilled', 'creative', 'innovative', 'engaging', 'entertaining',
    'years', 'background', 'specialized', 'certified'
  ];
  
  const lowercaseBio = bio.toLowerCase();
  const keywordMatches = qualityKeywords.filter(keyword => 
    lowercaseBio.includes(keyword)
  ).length;
  
  score += Math.min(keywordMatches * 2, 10);
  
  return Math.min(score, 25);
};

const calculateSocialScore = (socialMedia) => {
  if (!socialMedia || typeof socialMedia !== 'object') return 0;
  
  let score = 0;
  const platforms = ['instagram', 'twitter', 'tiktok', 'youtube'];
  
  // Points for having social media accounts (0-20 points)
  const activePlatforms = platforms.filter(platform => 
    socialMedia[platform] && socialMedia[platform].trim().length > 0
  );
  
  // 5 points per platform, up to 20 points
  score = Math.min(activePlatforms.length * 5, 20);
  
  return score;
};

const calculateExperienceScore = (experience) => {
  if (!experience || typeof experience !== 'string') return 0;
  
  const experienceMap = {
    'expert': 15,
    'advanced': 12,
    'intermediate': 8,
    'beginner': 4
  };
  
  return experienceMap[experience.toLowerCase()] || 0;
};

const calculateCompletenessScore = (application) => {
  let score = 0;
  const requiredFields = ['bio', 'specialties', 'experience', 'pricing'];
  
  // Check required fields (0-12 points)
  requiredFields.forEach(field => {
    if (application[field]) {
      if (field === 'specialties' && Array.isArray(application[field]) && application[field].length > 0) {
        score += 3;
      } else if (field === 'pricing' && application[field] && 
                 application[field].videoCall && application[field].voiceCall && application[field].privateStream) {
        score += 3;
      } else if (typeof application[field] === 'string' && application[field].trim().length > 0) {
        score += 3;
      }
    }
  });
  
  // Bonus for optional fields (0-8 points)
  if (application.social_media) {
    const socialPlatforms = Object.values(application.social_media).filter(val => val && val.trim().length > 0);
    score += Math.min(socialPlatforms.length * 2, 8);
  }
  
  return Math.min(score, 20);
};

const calculatePricingScore = (pricing) => {
  if (!pricing || typeof pricing !== 'object') return 0;
  
  let score = 0;
  
  // Check if pricing is within reasonable ranges
  const priceRanges = {
    videoCall: { min: 10, max: 200, optimal: { min: 20, max: 100 } },
    voiceCall: { min: 5, max: 150, optimal: { min: 10, max: 75 } },
    privateStream: { min: 15, max: 300, optimal: { min: 30, max: 150 } }
  };
  
  Object.keys(priceRanges).forEach(type => {
    const price = pricing[type];
    const range = priceRanges[type];
    
    if (price >= range.min && price <= range.max) {
      if (price >= range.optimal.min && price <= range.optimal.max) {
        score += 4; // Optimal pricing
      } else {
        score += 2; // Acceptable pricing
      }
    }
  });
  
  // Bonus for competitive pricing strategy
  if (pricing.voiceCall < pricing.videoCall && pricing.videoCall < pricing.privateStream) {
    score += 1; // Logical pricing progression
  }
  
  return Math.min(score, 10);
};

const calculateSpecialtyScore = (specialties) => {
  if (!specialties || !Array.isArray(specialties) || specialties.length === 0) return 0;
  
  // High-demand specialties get bonus points
  const highDemandSpecialties = ['Gaming', 'Music', 'Fitness', 'Art', 'Entertainment'];
  const hasHighDemand = specialties.some(specialty => highDemandSpecialties.includes(specialty));
  
  let score = specialties.length * 2; // 2 points per specialty
  if (hasHighDemand) score += 3; // Bonus for high-demand specialty
  if (specialties.length >= 3) score += 2; // Bonus for versatility
  
  return Math.min(score, 10);
};

const getScoreGrade = (score) => {
  if (score >= 90) return 'A+';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B+';
  if (score >= 60) return 'B';
  if (score >= 50) return 'C+';
  if (score >= 40) return 'C';
  return 'D';
};

const getRecommendation = (score) => {
  if (score >= 85) return 'STRONG_APPROVE';
  if (score >= 70) return 'APPROVE';
  if (score >= 55) return 'REVIEW_REQUIRED';
  if (score >= 40) return 'NEEDS_IMPROVEMENT';
  return 'REJECT';
};

const getScoreColor = (score) => {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-yellow-600';
  return 'text-red-600';
};

const getRecommendationColor = (recommendation) => {
  const colors = {
    'STRONG_APPROVE': 'text-green-700',
    'APPROVE': 'text-green-600',
    'REVIEW_REQUIRED': 'text-yellow-600',
    'NEEDS_IMPROVEMENT': 'text-orange-600',
    'REJECT': 'text-red-600'
  };
  return colors[recommendation] || 'text-gray-600';
};

module.exports = {
  calculateApplicationScore,
  getScoreGrade,
  getRecommendation,
  getScoreColor,
  getRecommendationColor
};