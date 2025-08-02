import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  StarIcon,
  ChatBubbleBottomCenterTextIcon,
  UserCircleIcon
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
import { supabase } from '../utils/supabase-auth.js';
import { getAuthToken } from '../utils/auth-helpers';

const ClassReviews = ({ classId, user, className = "" }) => {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    averageRating: 0,
    totalReviews: 0,
    ratingDistribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
  });

  useEffect(() => {
    if (classId) {
      fetchReviews();
    }
  }, [classId]);

  const fetchReviews = async () => {
    try {
      setLoading(true);
      const authToken = user ? await getAuthToken() : null;
      
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/classes/${classId}/reviews`, {
        headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {}
      });

      if (response.ok) {
        const data = await response.json();
        setReviews(data.reviews || []);
        setStats(data.stats || stats);
      } else {
        // Mock reviews for development
        const mockReviews = generateMockReviews();
        setReviews(mockReviews);
        setStats(calculateStats(mockReviews));
      }
    } catch (error) {
      console.error('Error fetching reviews:', error);
      const mockReviews = generateMockReviews();
      setReviews(mockReviews);
      setStats(calculateStats(mockReviews));
    } finally {
      setLoading(false);
    }
  };

  const generateMockReviews = () => [
    {
      id: 1,
      rating: 5,
      review: "Absolutely amazing class! Sarah's teaching style is so clear and motivating. I learned proper form and felt energized throughout the entire session. Can't wait for the next one!",
      userName: "Jessica M.",
      userAvatar: null,
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      helpful: 12
    },
    {
      id: 2,
      rating: 4,
      review: "Great workout class with good variety of exercises. The instructor was knowledgeable and the pace was perfect for intermediate level. Would definitely recommend!",
      userName: "Michael R.",
      userAvatar: null,
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      helpful: 8
    },
    {
      id: 3,
      rating: 5,
      review: "This was exactly what I needed! Perfect balance of challenge and accessibility. Sarah creates such a welcoming environment and gives great modifications for different skill levels.",
      userName: "Amanda K.",
      userAvatar: null,
      createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      helpful: 15
    },
    {
      id: 4,
      rating: 4,
      review: "Very good class overall. The instruction was clear and the workout was effective. Audio quality was perfect and the interaction with other participants was great.",
      userName: "David L.",
      userAvatar: null,
      createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      helpful: 6
    }
  ];

  const calculateStats = (reviewList) => {
    if (reviewList.length === 0) {
      return {
        averageRating: 0,
        totalReviews: 0,
        ratingDistribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
      };
    }

    const totalRating = reviewList.reduce((sum, review) => sum + review.rating, 0);
    const averageRating = totalRating / reviewList.length;
    
    const ratingDistribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    reviewList.forEach(review => {
      ratingDistribution[review.rating]++;
    });

    return {
      averageRating: Math.round(averageRating * 10) / 10,
      totalReviews: reviewList.length,
      ratingDistribution
    };
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = now - date;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  };

  const RatingStars = ({ rating, size = 'w-4 h-4' }) => (
    <div className="flex items-center">
      {[1, 2, 3, 4, 5].map((star) => (
        star <= rating ? (
          <StarIconSolid key={star} className={`${size} text-yellow-400`} />
        ) : (
          <StarIcon key={star} className={`${size} text-gray-300`} />
        )
      ))}
    </div>
  );

  const RatingDistributionBar = ({ rating, count, total }) => {
    const percentage = total > 0 ? (count / total) * 100 : 0;
    
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="w-4 text-gray-600">{rating}</span>
        <StarIconSolid className="w-3 h-3 text-yellow-400" />
        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className="h-full bg-yellow-400 transition-all duration-300" 
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className="w-8 text-xs text-gray-500">{count}</span>
      </div>
    );
  };

  if (loading) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="border border-gray-200 rounded-lg p-4">
              <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-full mb-1"></div>
              <div className="h-3 bg-gray-200 rounded w-3/4"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <ChatBubbleBottomCenterTextIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Reviews Yet</h3>
        <p className="text-gray-600">Be the first to review this class!</p>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Rating Summary */}
      <div className="mb-8">
        <div className="flex items-start gap-6">
          {/* Average Rating */}
          <div className="text-center">
            <div className="text-4xl font-bold text-gray-900 mb-1">
              {stats.averageRating.toFixed(1)}
            </div>
            <RatingStars rating={Math.round(stats.averageRating)} size="w-5 h-5" />
            <div className="text-sm text-gray-600 mt-1">
              {stats.totalReviews} review{stats.totalReviews !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Rating Distribution */}
          <div className="flex-1 space-y-1">
            {[5, 4, 3, 2, 1].map(rating => (
              <RatingDistributionBar
                key={rating}
                rating={rating}
                count={stats.ratingDistribution[rating]}
                total={stats.totalReviews}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Individual Reviews */}
      <div className="space-y-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Student Reviews
        </h3>
        
        {reviews.map((review, index) => (
          <motion.div
            key={review.id}
            className="border border-gray-200 rounded-lg p-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            {/* Review Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-purple-400 rounded-full flex items-center justify-center text-white font-bold text-sm">
                  {review.userAvatar ? (
                    <img
                      src={review.userAvatar}
                      alt={review.userName}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    review.userName.charAt(0)
                  )}
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">{review.userName}</h4>
                  <div className="flex items-center gap-2">
                    <RatingStars rating={review.rating} />
                    <span className="text-sm text-gray-500">{formatDate(review.createdAt)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Review Content */}
            <p className="text-gray-700 leading-relaxed mb-3">{review.review}</p>

            {/* Review Actions */}
            <div className="flex items-center justify-between text-sm">
              <div className="text-gray-500">
                Was this helpful?
              </div>
              <div className="flex items-center gap-4">
                <button className="text-gray-500 hover:text-blue-600 transition-colors">
                  👍 {review.helpful || 0}
                </button>
                <button className="text-gray-500 hover:text-gray-700 transition-colors">
                  Report
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Load More (if needed) */}
      {reviews.length >= 10 && (
        <div className="text-center mt-8">
          <button className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
            Load More Reviews
          </button>
        </div>
      )}
    </div>
  );
};

export default ClassReviews;