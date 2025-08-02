const { pool } = require('./utils/db');

async function insertTestData() {
  try {
    console.log('🔄 Inserting test creator data...');
    
    const creators = [
      {
        supabase_id: 'test-creator-1',
        email: 'alice@example.com',
        username: 'alice_creative',
        bio: 'Creative artist and live streamer. Love connecting with my audience! 🎨✨',
        streamPrice: 4.00,
        videoPrice: 6.00,
        voicePrice: 4.50,
        messagePrice: 1.50,
        total_sessions: 125,
        total_earnings: 1250.00,
        profile_pic_url: 'https://images.unsplash.com/photo-1494790108755-2616b332b611?w=150&h=150&fit=crop&crop=face'
      },
      {
        supabase_id: 'test-creator-2',
        email: 'bob@example.com',
        username: 'bob_music',
        bio: 'Musician and songwriter. Join my live sessions for exclusive performances! 🎵🎸',
        streamPrice: 6.00,
        videoPrice: 10.00,
        voicePrice: 8.00,
        messagePrice: 3.00,
        total_sessions: 89,
        total_earnings: 3200.00,
        profile_pic_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face'
      },
      {
        supabase_id: 'test-creator-3',
        email: 'charlie@example.com',
        username: 'charlie_fitness',
        bio: 'Fitness coach and wellness expert. Let\'s get healthy together! 💪🏃‍♂️',
        streamPrice: 5.00,
        videoPrice: 8.00,
        voicePrice: 6.00,
        messagePrice: 2.50,
        total_sessions: 200,
        total_earnings: 3900.00,
        profile_pic_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face'
      },
      {
        supabase_id: 'test-creator-4',
        email: 'diana@example.com',
        username: 'diana_cooking',
        bio: 'Professional chef sharing cooking secrets and recipes. Taste the magic! 👩‍🍳🍳',
        streamPrice: 5.50,
        videoPrice: 9.00,
        voicePrice: 7.00,
        messagePrice: 2.00,
        total_sessions: 156,
        total_earnings: 2450.00,
        profile_pic_url: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face'
      },
      {
        supabase_id: 'test-creator-5',
        email: 'evan@example.com',
        username: 'evan_gaming',
        bio: 'Pro gamer and streamer. Join my gaming sessions and level up together! 🎮🔥',
        streamPrice: 3.50,
        videoPrice: 5.50,
        voicePrice: 4.00,
        messagePrice: 1.00,
        total_sessions: 340,
        total_earnings: 3600.00,
        profile_pic_url: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&h=150&fit=crop&crop=face'
      },
      {
        supabase_id: 'test-creator-6',
        email: 'fiona@example.com',
        username: 'fiona_yoga',
        bio: 'Yoga instructor and mindfulness coach. Find your inner peace with me! 🧘‍♀️☮️',
        streamPrice: 4.50,
        videoPrice: 7.00,
        voicePrice: 5.50,
        messagePrice: 2.00,
        total_sessions: 78,
        total_earnings: 2475.00,
        profile_pic_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=face'
      }
    ];

    for (const creator of creators) {
      try {
        const query = `
          INSERT INTO users (
            supabase_id, username, is_creator, bio, 
            stream_price, video_price, voice_price, message_price,
            total_sessions, total_earnings, profile_pic_url, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
          ON CONFLICT (supabase_id) DO UPDATE SET
            username = EXCLUDED.username,
            bio = EXCLUDED.bio,
            stream_price = EXCLUDED.stream_price,
            video_price = EXCLUDED.video_price,
            voice_price = EXCLUDED.voice_price,
            message_price = EXCLUDED.message_price,
            total_sessions = EXCLUDED.total_sessions,
            total_earnings = EXCLUDED.total_earnings,
            profile_pic_url = EXCLUDED.profile_pic_url,
            updated_at = NOW()
        `;
        
        await pool.query(query, [
          creator.supabase_id,
          creator.username,
          true, // is_creator
          creator.bio,
          creator.streamPrice || 5.00,
          creator.videoPrice || 8.00,
          creator.voicePrice || 6.00,
          creator.messagePrice || 2.00,
          creator.total_sessions,
          creator.total_earnings,
          creator.profile_pic_url
        ]);
        
        console.log(`✅ Created/updated creator: @${creator.username}`);
      } catch (err) {
        console.error(`❌ Error creating creator @${creator.username}:`, err.message);
      }
    }

    // Verify the data was inserted
    const result = await pool.query(
      'SELECT username, bio, price_per_min, total_sessions FROM users WHERE is_creator = true AND username IS NOT NULL'
    );
    
    console.log('\n🎯 Test creators in database:');
    result.rows.forEach(creator => {
      console.log(`  @${creator.username} - $${creator.price_per_min}/min - ${creator.total_sessions} sessions`);
    });
    
    console.log('\n✅ Test data insertion completed!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error inserting test data:', error);
    process.exit(1);
  }
}

insertTestData();