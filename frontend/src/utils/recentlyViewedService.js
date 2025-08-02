// Recently Viewed Creators Service
class RecentlyViewedService {
  constructor() {
    this.storageKey = 'digis_recently_viewed_creators';
    this.maxItems = 10; // Maximum number of creators to track
  }

  // Get recently viewed creators from localStorage
  getRecentlyViewed() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error reading recently viewed creators:', error);
      return [];
    }
  }

  // Add a creator to recently viewed (or move to top if already exists)
  addCreator(creator) {
    if (!creator || !creator.id) return;

    try {
      let recentlyViewed = this.getRecentlyViewed();
      
      // Remove if already exists (to avoid duplicates)
      recentlyViewed = recentlyViewed.filter(item => item.id !== creator.id);
      
      // Add creator data with timestamp
      const creatorData = {
        id: creator.id,
        username: creator.username || creator.id || creator.supabase_id,
        bio: creator.bio,
        profilePicUrl: creator.profilePicUrl || creator.profile_pic_url,
        isOnline: creator.isOnline,
        category: creator.category,
        rating: creator.rating,
        reviewCount: creator.reviewCount,
        followerCount: creator.followerCount,
        streamPrice: creator.streamPrice || creator.price_per_min,
        videoPrice: creator.videoPrice || creator.price_per_min,
        voicePrice: creator.voicePrice || creator.price_per_min,
        messagePrice: creator.messagePrice || creator.price_per_min,
        specialties: creator.specialties,
        viewedAt: new Date().toISOString()
      };

      // Add to beginning of array
      recentlyViewed.unshift(creatorData);
      
      // Keep only the most recent items
      recentlyViewed = recentlyViewed.slice(0, this.maxItems);
      
      localStorage.setItem(this.storageKey, JSON.stringify(recentlyViewed));
      
      // Dispatch custom event for components to listen to
      window.dispatchEvent(new CustomEvent('recentlyViewedUpdated', {
        detail: { recentlyViewed }
      }));
      
      return recentlyViewed;
    } catch (error) {
      console.error('Error adding creator to recently viewed:', error);
      return this.getRecentlyViewed();
    }
  }

  // Remove a creator from recently viewed
  removeCreator(creatorId) {
    try {
      let recentlyViewed = this.getRecentlyViewed();
      recentlyViewed = recentlyViewed.filter(item => item.id !== creatorId);
      
      localStorage.setItem(this.storageKey, JSON.stringify(recentlyViewed));
      
      window.dispatchEvent(new CustomEvent('recentlyViewedUpdated', {
        detail: { recentlyViewed }
      }));
      
      return recentlyViewed;
    } catch (error) {
      console.error('Error removing creator from recently viewed:', error);
      return this.getRecentlyViewed();
    }
  }

  // Clear all recently viewed creators
  clearAll() {
    try {
      localStorage.removeItem(this.storageKey);
      
      window.dispatchEvent(new CustomEvent('recentlyViewedUpdated', {
        detail: { recentlyViewed: [] }
      }));
      
      return [];
    } catch (error) {
      console.error('Error clearing recently viewed creators:', error);
      return [];
    }
  }

  // Get creators viewed in the last N hours
  getRecentCreators(hoursBack = 24) {
    try {
      const recentlyViewed = this.getRecentlyViewed();
      const cutoffTime = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
      
      return recentlyViewed.filter(creator => {
        const viewedAt = new Date(creator.viewedAt);
        return viewedAt > cutoffTime;
      });
    } catch (error) {
      console.error('Error getting recent creators:', error);
      return [];
    }
  }

  // Get creators by category from recently viewed
  getCreatorsByCategory(category) {
    try {
      const recentlyViewed = this.getRecentlyViewed();
      return recentlyViewed.filter(creator => creator.category === category);
    } catch (error) {
      console.error('Error getting creators by category:', error);
      return [];
    }
  }

  // Get analytics data for recently viewed
  getAnalytics() {
    try {
      const recentlyViewed = this.getRecentlyViewed();
      
      const categories = {};
      const viewsByHour = new Array(24).fill(0);
      
      recentlyViewed.forEach(creator => {
        // Count by category
        if (creator.category) {
          categories[creator.category] = (categories[creator.category] || 0) + 1;
        }
        
        // Count by hour of day
        if (creator.viewedAt) {
          const hour = new Date(creator.viewedAt).getHours();
          viewsByHour[hour]++;
        }
      });
      
      return {
        totalViewed: recentlyViewed.length,
        categories,
        viewsByHour,
        mostRecentCategory: Object.keys(categories).sort((a, b) => categories[b] - categories[a])[0]
      };
    } catch (error) {
      console.error('Error getting analytics:', error);
      return {
        totalViewed: 0,
        categories: {},
        viewsByHour: new Array(24).fill(0),
        mostRecentCategory: null
      };
    }
  }
}

// Create and export singleton instance
const recentlyViewedService = new RecentlyViewedService();
export default recentlyViewedService;