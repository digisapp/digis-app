-- Check current users and their creator status
SELECT id, username, email, is_creator, creator_type, display_name 
FROM users 
ORDER BY created_at DESC;

-- Check if Miriam is marked as a creator
UPDATE users 
SET is_creator = true,
    creator_type = 'Entertainment'
WHERE LOWER(email) = 'miriam@digis.com' 
   OR LOWER(username) = 'miriam' 
   OR LOWER(username) = 'miriamcreator';

-- Create some sample creators if none exist
INSERT INTO users (
    id, 
    email, 
    username, 
    display_name,
    is_creator, 
    creator_type,
    bio,
    profile_pic_url,
    stream_price,
    video_price,
    voice_price,
    message_price,
    state,
    country,
    created_at,
    updated_at
) VALUES 
(
    gen_random_uuid(),
    'sophia@digis.com',
    'sophia',
    'Sophia Martinez',
    true,
    'Fitness',
    'Certified fitness trainer specializing in HIIT and yoga. Let''s achieve your fitness goals together!',
    'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400',
    100,
    150,
    50,
    50,
    'California',
    'USA',
    NOW(),
    NOW()
),
(
    gen_random_uuid(),
    'alex@digis.com',
    'alexcreator',
    'Alex Chen',
    true,
    'Tech',
    'Full-stack developer and tech educator. I help you master coding and build amazing projects!',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400',
    120,
    180,
    60,
    50,
    'New York',
    'USA',
    NOW(),
    NOW()
),
(
    gen_random_uuid(),
    'emma@digis.com',
    'emmawellness',
    'Emma Thompson',
    true,
    'Wellness',
    'Holistic wellness coach focusing on mindfulness, meditation, and healthy living.',
    'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400',
    80,
    120,
    40,
    40,
    'Colorado',
    'USA',
    NOW(),
    NOW()
),
(
    gen_random_uuid(),
    'david@digis.com',
    'davidmusic',
    'David Rodriguez',
    true,
    'Music',
    'Professional guitarist and music producer. Learn guitar, music theory, and production techniques!',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400',
    90,
    140,
    45,
    45,
    'Texas',
    'USA',
    NOW(),
    NOW()
),
(
    gen_random_uuid(),
    'isabella@digis.com',
    'bellafashion',
    'Isabella Laurent',
    true,
    'Fashion',
    'Fashion stylist and designer. Get personalized style advice and fashion tips!',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400',
    110,
    160,
    55,
    55,
    'New York',
    'USA',
    NOW(),
    NOW()
),
(
    gen_random_uuid(),
    'michael@digis.com',
    'mikebusiness',
    'Michael Park',
    true,
    'Business',
    'Entrepreneur and business consultant. Scale your business and achieve financial freedom!',
    'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400',
    150,
    200,
    75,
    60,
    'California',
    'USA',
    NOW(),
    NOW()
),
(
    gen_random_uuid(),
    'olivia@digis.com',
    'oliviacooks',
    'Olivia James',
    true,
    'Cooking',
    'Professional chef specializing in healthy, delicious recipes. Master cooking from basics to gourmet!',
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400',
    85,
    130,
    45,
    45,
    'Illinois',
    'USA',
    NOW(),
    NOW()
),
(
    gen_random_uuid(),
    'lucas@digis.com',
    'lucasgaming',
    'Lucas Kim',
    true,
    'Gaming',
    'Pro gamer and streaming coach. Level up your gaming skills and streaming setup!',
    'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400',
    70,
    100,
    35,
    40,
    'Washington',
    'USA',
    NOW(),
    NOW()
)
ON CONFLICT (email) DO UPDATE SET
    is_creator = EXCLUDED.is_creator,
    creator_type = EXCLUDED.creator_type,
    bio = EXCLUDED.bio,
    profile_pic_url = EXCLUDED.profile_pic_url,
    stream_price = EXCLUDED.stream_price,
    video_price = EXCLUDED.video_price,
    voice_price = EXCLUDED.voice_price,
    message_price = EXCLUDED.message_price;

-- Also update any users with usernames containing 'creator' to be creators
UPDATE users 
SET is_creator = true,
    creator_type = CASE 
        WHEN creator_type IS NULL THEN 'Entertainment'
        ELSE creator_type
    END
WHERE LOWER(username) LIKE '%creator%'
   OR LOWER(display_name) LIKE '%creator%';

-- Verify we have creators
SELECT COUNT(*) as total_creators FROM users WHERE is_creator = true;

-- Show all creators
SELECT id, username, email, display_name, is_creator, creator_type, bio 
FROM users 
WHERE is_creator = true
ORDER BY created_at DESC;