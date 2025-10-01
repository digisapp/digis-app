-- Check Miriam's user record and role
SELECT 
    email, 
    username,
    is_creator,
    role,
    is_admin,
    creator_type,
    creator_rate,
    voice_rate,
    stream_rate
FROM users 
WHERE email = 'miriam@examodels.com';

-- Update Miriam to be a creator if not already
UPDATE users 
SET 
    is_creator = true,
    role = 'creator',
    creator_type = 'Content Creator',
    creator_rate = 50,
    voice_rate = 40,
    stream_rate = 30
WHERE email = 'miriam@examodels.com';

-- Verify the update
SELECT 
    email, 
    username,
    is_creator,
    role,
    is_admin,
    creator_type
FROM users 
WHERE email = 'miriam@examodels.com';
