-- FIX EXPLORE CREATORS PAGE
-- This script adds all missing columns and ensures creators are visible

-- ============================================
-- 1. ADD ALL MISSING PRICE COLUMNS TO USERS TABLE
-- ============================================

DO $$ 
BEGIN
    -- Add video_price column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'video_price') THEN
        ALTER TABLE users ADD COLUMN video_price INTEGER DEFAULT 150;
    END IF;
    
    -- Add voice_price column (different from voice_rate)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'voice_price') THEN
        ALTER TABLE users ADD COLUMN voice_price INTEGER DEFAULT 50;
    END IF;
    
    -- Add text_message_price column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'text_message_price') THEN
        ALTER TABLE users ADD COLUMN text_message_price INTEGER DEFAULT 50;
    END IF;
    
    -- Add image_message_price column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'image_message_price') THEN
        ALTER TABLE users ADD COLUMN image_message_price INTEGER DEFAULT 100;
    END IF;
    
    -- Add audio_message_price column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'audio_message_price') THEN
        ALTER TABLE users ADD COLUMN audio_message_price INTEGER DEFAULT 150;
    END IF;
    
    -- Add video_message_price column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'video_message_price') THEN
        ALTER TABLE users ADD COLUMN video_message_price INTEGER DEFAULT 200;
    END IF;
    
    -- Add state column for location
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'state') THEN
        ALTER TABLE users ADD COLUMN state VARCHAR(100);
    END IF;
    
    -- Add country column for location
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'country') THEN
        ALTER TABLE users ADD COLUMN country VARCHAR(100) DEFAULT 'United States';
    END IF;
    
    -- Add is_verified column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'is_verified') THEN
        ALTER TABLE users ADD COLUMN is_verified BOOLEAN DEFAULT false;
    END IF;
    
    -- Add creator_card_image column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'creator_card_image') THEN
        ALTER TABLE users ADD COLUMN creator_card_image TEXT;
    END IF;
END $$;

-- ============================================
-- 2. UPDATE MIRIAM TO BE A FULLY CONFIGURED CREATOR
-- ============================================

UPDATE users 
SET 
    is_creator = true,
    role = 'creator',
    creator_type = 'Content Creator',
    creator_rate = 50,
    voice_rate = 40,
    stream_rate = 30,
    stream_price = 100,
    video_price = 150,
    voice_price = 50,
    message_price = 50,
    text_message_price = 50,
    image_message_price = 100,
    audio_message_price = 150,
    video_message_price = 200,
    available_for_calls = true,
    is_verified = true,
    bio = 'Professional content creator specializing in lifestyle and wellness content.',
    display_name = 'Miriam',
    username = COALESCE(username, 'miriam'),
    state = 'California',
    country = 'United States',
    last_active = NOW()
WHERE email = 'miriam@examodels.com';

-- ============================================
-- 3. CREATE ADDITIONAL TEST CREATORS
-- ============================================

-- Create test creator 1
INSERT INTO users (
    supabase_id,
    email,
    username,
    display_name,
    is_creator,
    role,
    creator_type,
    bio,
    stream_price,
    video_price,
    voice_price,
    message_price,
    text_message_price,
    image_message_price,
    audio_message_price,
    video_message_price,
    available_for_calls,
    is_verified,
    state,
    country,
    created_at,
    updated_at,
    last_active
) VALUES (
    gen_random_uuid(),
    'sarah@example.com',
    'sarah_creative',
    'Sarah Creative',
    true,
    'creator',
    'Artist',
    'Digital artist and creative coach helping others unlock their artistic potential.',
    80,
    120,
    40,
    40,
    40,
    80,
    120,
    160,
    true,
    true,
    'New York',
    'United States',
    NOW() - INTERVAL '7 days',
    NOW(),
    NOW() - INTERVAL '2 minutes'
) ON CONFLICT (email) DO UPDATE SET
    is_creator = true,
    role = 'creator',
    creator_type = 'Artist';

-- Create test creator 2
INSERT INTO users (
    supabase_id,
    email,
    username,
    display_name,
    is_creator,
    role,
    creator_type,
    bio,
    stream_price,
    video_price,
    voice_price,
    message_price,
    text_message_price,
    image_message_price,
    audio_message_price,
    video_message_price,
    available_for_calls,
    is_verified,
    state,
    country,
    created_at,
    updated_at,
    last_active
) VALUES (
    gen_random_uuid(),
    'alex@example.com',
    'alex_fitness',
    'Alex Fitness',
    true,
    'creator',
    'Fitness Coach',
    'Certified personal trainer specializing in home workouts and nutrition.',
    120,
    180,
    60,
    60,
    60,
    120,
    180,
    240,
    true,
    true,
    'Texas',
    'United States',
    NOW() - INTERVAL '14 days',
    NOW(),
    NOW() - INTERVAL '10 minutes'
) ON CONFLICT (email) DO UPDATE SET
    is_creator = true,
    role = 'creator',
    creator_type = 'Fitness Coach';

-- Create test creator 3
INSERT INTO users (
    supabase_id,
    email,
    username,
    display_name,
    is_creator,
    role,
    creator_type,
    bio,
    stream_price,
    video_price,
    voice_price,
    message_price,
    text_message_price,
    image_message_price,
    audio_message_price,
    video_message_price,
    available_for_calls,
    is_verified,
    state,
    country,
    created_at,
    updated_at,
    last_active
) VALUES (
    gen_random_uuid(),
    'emma@example.com',
    'emma_music',
    'Emma Music',
    true,
    'creator',
    'Musician',
    'Singer-songwriter sharing original music and teaching vocal techniques.',
    90,
    135,
    45,
    45,
    45,
    90,
    135,
    180,
    true,
    true,
    'Florida',
    'United States',
    NOW() - INTERVAL '21 days',
    NOW(),
    NOW() - INTERVAL '1 hour'
) ON CONFLICT (email) DO UPDATE SET
    is_creator = true,
    role = 'creator',
    creator_type = 'Musician';

-- ============================================
-- 4. VERIFY CREATORS ARE VISIBLE
-- ============================================

-- Check all creators in the system
SELECT 
    email,
    username,
    display_name,
    is_creator,
    role,
    creator_type,
    stream_price,
    video_price,
    is_verified,
    CASE 
        WHEN last_active > NOW() - INTERVAL '5 minutes' THEN 'Online' 
        ELSE 'Offline' 
    END as status
FROM users
WHERE is_creator = true
ORDER BY created_at DESC;

-- Count total creators
SELECT 
    COUNT(*) as total_creators,
    COUNT(CASE WHEN is_verified = true THEN 1 END) as verified_creators,
    COUNT(CASE WHEN last_active > NOW() - INTERVAL '5 minutes' THEN 1 END) as online_creators
FROM users
WHERE is_creator = true;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
SELECT 
    '✅ Explore Creators page fixed!' as message,
    'You should now see creators listed' as result,
    COUNT(*) as total_creators_available
FROM users
WHERE is_creator = true;