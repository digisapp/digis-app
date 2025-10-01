#!/usr/bin/env node

/**
 * Script to ensure there are creators in the database
 * Run this to populate sample creators and fix creator flags
 */

const { pool } = require('../utils/db');
const { logger } = require('../utils/secureLogger');

async function ensureCreators() {
  try {
    logger.info('🔄 Checking and ensuring creators exist...');

    // First, update any users with 'creator' in their username or display name
    const updateResult = await pool.query(`
      UPDATE users 
      SET is_creator = true,
          creator_type = CASE 
            WHEN creator_type IS NULL THEN 'Entertainment'
            ELSE creator_type
          END
      WHERE (LOWER(username) LIKE '%creator%' 
         OR LOWER(display_name) LIKE '%creator%'
         OR LOWER(email) LIKE '%creator%')
      RETURNING id, username, email, display_name
    `);

    if (updateResult.rows.length > 0) {
      logger.info(`✅ Updated ${updateResult.rows.length} users to creators:`, 
        updateResult.rows.map(u => u.username || u.email));
    }

    // Check how many creators we have
    const countResult = await pool.query(
      'SELECT COUNT(*) as total FROM users WHERE is_creator = true'
    );
    
    const creatorCount = parseInt(countResult.rows[0].total);
    logger.info(`📊 Current creator count: ${creatorCount}`);

    // If we have less than 5 creators, add some sample ones
    if (creatorCount < 5) {
      logger.info('⚠️ Less than 5 creators found, adding sample creators...');

      const sampleCreators = [
        {
          email: 'sophia@digis.com',
          username: 'sophia',
          display_name: 'Sophia Martinez',
          creator_type: 'Fitness',
          bio: 'Certified fitness trainer specializing in HIIT and yoga. Let\'s achieve your fitness goals together!',
          profile_pic_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400',
          stream_price: 100,
          video_price: 150,
          voice_price: 50,
          message_price: 50,
          state: 'California',
          country: 'USA'
        },
        {
          email: 'alex@digis.com',
          username: 'alexcreator',
          display_name: 'Alex Chen',
          creator_type: 'Tech',
          bio: 'Full-stack developer and tech educator. I help you master coding and build amazing projects!',
          profile_pic_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400',
          stream_price: 120,
          video_price: 180,
          voice_price: 60,
          message_price: 50,
          state: 'New York',
          country: 'USA'
        },
        {
          email: 'emma@digis.com',
          username: 'emmawellness',
          display_name: 'Emma Thompson',
          creator_type: 'Wellness',
          bio: 'Holistic wellness coach focusing on mindfulness, meditation, and healthy living.',
          profile_pic_url: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400',
          stream_price: 80,
          video_price: 120,
          voice_price: 40,
          message_price: 40,
          state: 'Colorado',
          country: 'USA'
        },
        {
          email: 'david@digis.com',
          username: 'davidmusic',
          display_name: 'David Rodriguez',
          creator_type: 'Music',
          bio: 'Professional guitarist and music producer. Learn guitar, music theory, and production techniques!',
          profile_pic_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400',
          stream_price: 90,
          video_price: 140,
          voice_price: 45,
          message_price: 45,
          state: 'Texas',
          country: 'USA'
        },
        {
          email: 'isabella@digis.com',
          username: 'bellafashion',
          display_name: 'Isabella Laurent',
          creator_type: 'Fashion',
          bio: 'Fashion stylist and designer. Get personalized style advice and fashion tips!',
          profile_pic_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400',
          stream_price: 110,
          video_price: 160,
          voice_price: 55,
          message_price: 55,
          state: 'New York',
          country: 'USA'
        }
      ];

      for (const creator of sampleCreators) {
        try {
          const insertResult = await pool.query(`
            INSERT INTO users (
              id, email, username, display_name, is_creator, creator_type,
              bio, profile_pic_url, stream_price, video_price, voice_price,
              message_price, state, country, created_at, updated_at
            ) VALUES (
              gen_random_uuid(), $1, $2, $3, true, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW()
            )
            ON CONFLICT (email) DO UPDATE SET
              is_creator = true,
              creator_type = EXCLUDED.creator_type,
              bio = EXCLUDED.bio,
              profile_pic_url = EXCLUDED.profile_pic_url,
              stream_price = EXCLUDED.stream_price,
              video_price = EXCLUDED.video_price,
              voice_price = EXCLUDED.voice_price,
              message_price = EXCLUDED.message_price
            RETURNING username
          `, [
            creator.email, creator.username, creator.display_name, creator.creator_type,
            creator.bio, creator.profile_pic_url, creator.stream_price, creator.video_price,
            creator.voice_price, creator.message_price, creator.state, creator.country
          ]);

          logger.info(`✅ Added/updated creator: ${insertResult.rows[0].username}`);
        } catch (err) {
          // Try without email conflict
          if (err.code === '23505') { // Unique violation
            try {
              const altEmail = creator.email.replace('@', Date.now() + '@');
              const altUsername = creator.username + Date.now();
              
              const insertResult = await pool.query(`
                INSERT INTO users (
                  id, email, username, display_name, is_creator, creator_type,
                  bio, profile_pic_url, stream_price, video_price, voice_price,
                  message_price, state, country, created_at, updated_at
                ) VALUES (
                  gen_random_uuid(), $1, $2, $3, true, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW()
                )
                RETURNING username
              `, [
                altEmail, altUsername, creator.display_name, creator.creator_type,
                creator.bio, creator.profile_pic_url, creator.stream_price, creator.video_price,
                creator.voice_price, creator.message_price, creator.state, creator.country
              ]);

              logger.info(`✅ Added creator with alt credentials: ${insertResult.rows[0].username}`);
            } catch (innerErr) {
              logger.error(`❌ Failed to add creator ${creator.display_name}:`, innerErr.message);
            }
          } else {
            logger.error(`❌ Failed to add creator ${creator.display_name}:`, err.message);
          }
        }
      }
    }

    // Final count
    const finalCount = await pool.query(
      'SELECT COUNT(*) as total FROM users WHERE is_creator = true'
    );
    
    logger.info(`✅ Final creator count: ${finalCount.rows[0].total}`);

    // Show all creators
    const allCreators = await pool.query(`
      SELECT username, email, display_name, creator_type, is_creator 
      FROM users 
      WHERE is_creator = true
      ORDER BY created_at DESC
    `);

    logger.info('📋 All creators:', allCreators.rows);

  } catch (error) {
    logger.error('❌ Error ensuring creators:', error);
  } finally {
    await pool.end();
  }
}

// Run the script
ensureCreators();