-- Sample creators for testing public landing page
INSERT INTO users (
  firebase_uid,
  supabase_id, 
  email, 
  username,
  display_name,
  is_creator, 
  bio, 
  price_per_min,
  video_price,
  voice_price,
  stream_price,
  total_sessions, 
  total_earnings,
  profile_pic_url,
  created_at,
  updated_at
) VALUES 
(
  'test-creator-1',
  'test-creator-1',
  'alice@example.com',
  'alice_creative',
  'Alice Creative',
  true,
  'Creative artist and live streamer. Love connecting with my audience! 🎨✨',
  5.00,
  5.00,
  3.00,
  2.50,
  25,
  1250.00,
  'https://images.unsplash.com/photo-1494790108755-2616b332b611?w=150&h=150&fit=crop&crop=face',
  NOW(),
  NOW()
),
(
  'test-creator-2',
  'test-creator-2',
  'bob@example.com',
  'bob_music',
  'Bob Music',
  true,
  'Musician and songwriter. Join my live sessions for exclusive performances! 🎵🎸',
  8.00,
  8.00,
  5.00,
  4.00,
  40,
  3200.00,
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
  NOW(),
  NOW()
),
(
  'test-creator-3',
  'test-creator-3',
  'charlie@example.com',
  'charlie_fitness',
  'Charlie Fitness',
  true,
  'Fitness coach and wellness expert. Let''s get healthy together! 💪🏃‍♂️',
  6.50,
  6.50,
  4.00,
  3.00,
  60,
  3900.00,
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
  NOW(),
  NOW()
),
(
  'test-creator-4',
  'test-creator-4',
  'diana@example.com',
  'diana_cooking',
  'Diana Cooking',
  true,
  'Professional chef sharing cooking secrets and recipes. Taste the magic! 👩‍🍳🍳',
  7.00,
  7.00,
  4.50,
  3.50,
  35,
  2450.00,
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face',
  NOW(),
  NOW()
),
(
  'test-creator-5',
  'test-creator-5',
  'evan@example.com',
  'evan_gaming',
  'Evan Gaming',
  true,
  'Pro gamer and streamer. Join my gaming sessions and level up together! 🎮🔥',
  4.50,
  4.50,
  3.00,
  2.00,
  80,
  3600.00,
  'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&h=150&fit=crop&crop=face',
  NOW(),
  NOW()
),
(
  'test-creator-6',
  'test-creator-6',
  'fiona@example.com',
  'fiona_yoga',
  'Fiona Yoga',
  true,
  'Yoga instructor and mindfulness coach. Find your inner peace with me! 🧘‍♀️☮️',
  5.50,
  5.50,
  3.50,
  2.50,
  45,
  2475.00,
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=face',
  NOW(),
  NOW()
);

-- Add some follower counts (simulate followers)
-- Note: These would normally be calculated from the followers table, but for testing we'll add some sample data
UPDATE users SET total_sessions = 
  CASE username
    WHEN 'alice_creative' THEN 125
    WHEN 'bob_music' THEN 89
    WHEN 'charlie_fitness' THEN 200
    WHEN 'diana_cooking' THEN 156
    WHEN 'evan_gaming' THEN 340
    WHEN 'fiona_yoga' THEN 78
  END
WHERE username IN ('alice_creative', 'bob_music', 'charlie_fitness', 'diana_cooking', 'evan_gaming', 'fiona_yoga');