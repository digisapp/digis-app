// Load environment variables first
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { pool, testConnection } = require('./db');
const { logger } = require('../utils/secureLogger');

const runMigrations = async () => {
  logger.info('🔄 Starting migration process...');
  
  const isConnected = await testConnection();
  if (!isConnected) {
    logger.error('❌ Cannot run migrations: Database connection failed');
    throw new Error('Database connection failed');
  }

  const client = await pool.connect();
  
  try {
    logger.info('✅ Database connection successful!');
    logger.info('🔄 Checking existing table structure...');
    
    const existingTables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    const tableNames = existingTables.rows.map(row => row.table_name);
    logger.info('📊 Existing tables found:', tableNames);
    
    const requiredTables = [
      'users', 'sessions', 'payments', 'chat_messages', 
      'token_balances', 'token_transactions', 'payouts', 'fraud_alerts',
      'followers', 'messages', 'user_online_status', 'notifications', 'notification_preferences',
      'stream_goals', 'achievements', 'user_challenges', 'creator_applications', 'session_ratings',
      'subscription_plans', 'creator_subscriptions', 'content_moderation', 'blocked_content', 'user_penalties',
      'stream_recordings', 'recording_views', 'recording_purchases', 'recording_clips', 'clip_views', 'clip_likes',
      'creator_offers', 'offer_purchases'
    ];
    const missingTables = requiredTables.filter(table => !tableNames.includes(table));
    
    if (missingTables.length > 0) {
      logger.info('⚠️ Missing tables detected:', missingTables);
      logger.info('🔄 Creating missing tables...');
      
      for (const table of missingTables) {
        await createTable(client, table);
      }
    } else {
      logger.info('✅ All required tables exist!');
    }
    
    logger.info('🔄 Checking and adding missing columns...');
    
    await addMissingColumns(client, 'users', [
      { name: 'total_sessions', type: 'INTEGER DEFAULT 0' },
      { name: 'total_earnings', type: 'DECIMAL(10,2) DEFAULT 0.00' },
      { name: 'total_spent', type: 'DECIMAL(10,2) DEFAULT 0.00' },
      { name: 'created_at', type: 'TIMESTAMP DEFAULT NOW()' },
      { name: 'updated_at', type: 'TIMESTAMP DEFAULT NOW()' },
      { name: 'auto_refill_enabled', type: 'BOOLEAN DEFAULT FALSE' },
      { name: 'auto_refill_package', type: 'INTEGER DEFAULT 0' },
      { name: 'last_purchase_amount', type: 'INTEGER DEFAULT 0' },
      { name: 'username', type: 'VARCHAR(50) UNIQUE' },
      { name: 'show_token_balance', type: 'BOOLEAN DEFAULT FALSE' },
      { name: 'stream_price', type: 'DECIMAL(10,2) DEFAULT 5.00' },
      { name: 'video_price', type: 'DECIMAL(10,2) DEFAULT 8.00' },
      { name: 'voice_price', type: 'DECIMAL(10,2) DEFAULT 6.00' },
      { name: 'message_price', type: 'DECIMAL(10,2) DEFAULT 2.00' },
      { name: 'email', type: 'VARCHAR(255)' },
      { name: 'last_sign_in_at', type: 'TIMESTAMP' },
      { name: 'is_super_admin', type: 'BOOLEAN DEFAULT FALSE' },
      { name: 'role', type: 'VARCHAR(50) DEFAULT \'user\'' },
      { name: 'stripe_customer_id', type: 'VARCHAR(255)' },
      { name: 'moderation_strikes', type: 'INTEGER DEFAULT 0' },
      { name: 'is_suspended', type: 'BOOLEAN DEFAULT FALSE' },
      { name: 'suspension_end', type: 'TIMESTAMP' },
      { name: 'profile_blocked', type: 'BOOLEAN DEFAULT FALSE' },
      { name: 'profile_block_reason', type: 'TEXT' }
    ]);
    
    await addMissingColumns(client, 'sessions', [
      { name: 'status', type: 'VARCHAR(50) DEFAULT \'active\'' },
      { name: 'created_at', type: 'TIMESTAMP DEFAULT NOW()' },
      { name: 'updated_at', type: 'TIMESTAMP DEFAULT NOW()' },
      { name: 'price_per_min', type: 'DECIMAL(10,2) DEFAULT 0.00' },
      { name: 'total_amount', type: 'DECIMAL(10,2) DEFAULT 0.00' },
      { name: 'duration_minutes', type: 'INTEGER DEFAULT 0' },
      { name: 'fan_id', type: 'INTEGER REFERENCES users(id) ON DELETE CASCADE' }
    ]);
    
    await addMissingColumns(client, 'payments', [
      { name: 'status', type: 'VARCHAR(50) DEFAULT \'pending\'' },
      { name: 'stripe_payment_intent_id', type: 'VARCHAR(255)' },
      { name: 'created_at', type: 'TIMESTAMP DEFAULT NOW()' },
      { name: 'updated_at', type: 'TIMESTAMP DEFAULT NOW()' },
      { name: 'user_id', type: 'VARCHAR(255)' },
      { name: 'duration_minutes', type: 'INTEGER DEFAULT 0' }
    ]);

    await addMissingColumns(client, 'chat_messages', [
      { name: 'is_blocked', type: 'BOOLEAN DEFAULT FALSE' },
      { name: 'blocked_reason', type: 'TEXT' }
    ]);
    
    logger.info('🔄 Creating indexes...');
    await createIndexes(client);
    
    logger.info('🔄 Adding constraints...');
    await addConstraints(client);
    
    logger.info('✅ Database migration completed successfully!');
    
    await showTableSummary(client);
    
  } catch (error) {
    logger.error('❌ Migration process failed:', error.message);
    throw error;
  } finally {
    client.release();
  }
};

const createTable = async (client, tableName) => {
  try {
    switch (tableName) {
      case 'users':
        await client.query(`
          CREATE TABLE users (
            id SERIAL PRIMARY KEY,
            supabase_id VARCHAR(255) UNIQUE NOT NULL,
            username VARCHAR(50) UNIQUE,
            is_creator BOOLEAN DEFAULT FALSE,
            bio TEXT,
            profile_pic_url TEXT,
            price_per_min DECIMAL(10,2) DEFAULT 1.00,
            total_sessions INTEGER DEFAULT 0,
            total_earnings DECIMAL(10,2) DEFAULT 0.00,
            total_spent DECIMAL(10,2) DEFAULT 0.00,
            show_token_balance BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),
            auto_refill_enabled BOOLEAN DEFAULT FALSE,
            auto_refill_package INTEGER DEFAULT 0,
            last_purchase_amount INTEGER DEFAULT 0
          )
        `);
        logger.info('✅ Created users table');
        break;
        
      case 'sessions':
        await client.query(`
          CREATE TABLE sessions (
            id SERIAL PRIMARY KEY,
            creator_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            fan_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            start_time TIMESTAMP DEFAULT NOW(),
            end_time TIMESTAMP,
            type VARCHAR(50) DEFAULT 'video',
            status VARCHAR(50) DEFAULT 'active',
            price_per_min DECIMAL(10,2) DEFAULT 0.00,
            total_amount DECIMAL(10,2) DEFAULT 0.00,
            duration_minutes INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
          )
        `);
        logger.info('✅ Created sessions table');
        break;
        
      case 'payments':
        await client.query(`
          CREATE TABLE payments (
            id SERIAL PRIMARY KEY,
            session_id INTEGER REFERENCES sessions(id) ON DELETE SET NULL,
            user_id VARCHAR(255) REFERENCES users(supabase_id) ON DELETE CASCADE,
            amount DECIMAL(10,2) NOT NULL,
            tip DECIMAL(10,2) DEFAULT 0.00,
            status VARCHAR(50) DEFAULT 'pending',
            stripe_payment_intent_id VARCHAR(255),
            duration_minutes INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
          )
        `);
        logger.info('✅ Created payments table');
        break;
        
      case 'chat_messages':
        await client.query(`
          CREATE TABLE chat_messages (
            id SERIAL PRIMARY KEY,
            channel VARCHAR(64) NOT NULL,
            sender_id VARCHAR(255) REFERENCES users(supabase_id) ON DELETE CASCADE,
            message TEXT NOT NULL,
            type VARCHAR(50) DEFAULT 'text',
            file_url TEXT,
            created_at TIMESTAMP DEFAULT NOW()
          )
        `);
        logger.info('✅ Created chat_messages table');
        break;
        
      case 'token_balances':
        await client.query(`
          CREATE TABLE token_balances (
            id SERIAL PRIMARY KEY,
            user_id VARCHAR(255) UNIQUE REFERENCES users(supabase_id) ON DELETE CASCADE,
            balance INTEGER NOT NULL DEFAULT 0,
            updated_at TIMESTAMP DEFAULT NOW(),
            CHECK (balance >= 0)
          )
        `);
        logger.info('✅ Created token_balances table');
        break;
        
      case 'token_transactions':
        await client.query(`
          CREATE TABLE token_transactions (
            id SERIAL PRIMARY KEY,
            user_id VARCHAR(255) REFERENCES users(supabase_id) ON DELETE CASCADE,
            type VARCHAR(50) NOT NULL,
            tokens INTEGER NOT NULL,
            amount_usd DECIMAL(10,2),
            bonus_tokens INTEGER DEFAULT 0,
            stripe_payment_intent_id VARCHAR(255),
            status VARCHAR(50) DEFAULT 'pending',
            session_id INTEGER REFERENCES sessions(id) ON DELETE SET NULL,
            created_at TIMESTAMP DEFAULT NOW(),
            CHECK (tokens >= 0),
            CHECK (amount_usd >= 0 OR amount_usd IS NULL)
          )
        `);
        logger.info('✅ Created token_transactions table');
        break;
        
      case 'payouts':
        await client.query(`
          CREATE TABLE payouts (
            id SERIAL PRIMARY KEY,
            creator_id VARCHAR(255) REFERENCES users(supabase_id) ON DELETE CASCADE,
            tokens_redeemed INTEGER NOT NULL,
            payout_amount DECIMAL(10,2) NOT NULL,
            status VARCHAR(50) DEFAULT 'pending',
            stripe_payout_id VARCHAR(255),
            created_at TIMESTAMP DEFAULT NOW(),
            CHECK (tokens_redeemed >= 0),
            CHECK (payout_amount >= 0)
          )
        `);
        logger.info('✅ Created payouts table');
        break;
        
      case 'fraud_alerts':
        await client.query(`
          CREATE TABLE fraud_alerts (
            id SERIAL PRIMARY KEY,
            user_id VARCHAR(255) REFERENCES users(supabase_id) ON DELETE CASCADE,
            alert_type VARCHAR(50) NOT NULL,
            details JSONB,
            resolved BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT NOW()
          )
        `);
        logger.info('✅ Created fraud_alerts table');
        break;
        
      case 'followers':
        await client.query(`
          CREATE TABLE followers (
            id SERIAL PRIMARY KEY,
            creator_id VARCHAR(255) REFERENCES users(supabase_id) ON DELETE CASCADE,
            follower_id VARCHAR(255) REFERENCES users(supabase_id) ON DELETE CASCADE,
            created_at TIMESTAMP DEFAULT NOW(),
            UNIQUE(creator_id, follower_id)
          )
        `);
        logger.info('✅ Created followers table');
        break;
        
      case 'messages':
        await client.query(`
          CREATE TABLE messages (
            id SERIAL PRIMARY KEY,
            sender_id VARCHAR(255) REFERENCES users(supabase_id) ON DELETE CASCADE,
            recipient_id VARCHAR(255) REFERENCES users(supabase_id) ON DELETE CASCADE,
            subject VARCHAR(255),
            content TEXT NOT NULL,
            message_type VARCHAR(50) DEFAULT 'direct',
            read_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
          )
        `);
        logger.info('✅ Created messages table');
        break;
        
      case 'user_online_status':
        await client.query(`
          CREATE TABLE user_online_status (
            id SERIAL PRIMARY KEY,
            user_id VARCHAR(255) UNIQUE REFERENCES users(supabase_id) ON DELETE CASCADE,
            is_online BOOLEAN DEFAULT FALSE,
            last_seen TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
          )
        `);
        logger.info('✅ Created user_online_status table');
        break;
        
      case 'notifications':
        await client.query(`
          CREATE TABLE notifications (
            id SERIAL PRIMARY KEY,
            recipient_id VARCHAR(255) REFERENCES users(supabase_id) ON DELETE CASCADE,
            sender_id VARCHAR(255) REFERENCES users(supabase_id) ON DELETE CASCADE,
            type VARCHAR(50) NOT NULL,
            title VARCHAR(255) NOT NULL,
            message TEXT NOT NULL,
            data JSONB DEFAULT '{}',
            read_at TIMESTAMP,
            expires_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT NOW()
          )
        `);
        logger.info('✅ Created notifications table');
        break;
        
      case 'notification_preferences':
        await client.query(`
          CREATE TABLE notification_preferences (
            id SERIAL PRIMARY KEY,
            user_id VARCHAR(255) UNIQUE REFERENCES users(supabase_id) ON DELETE CASCADE,
            preferences JSONB NOT NULL DEFAULT '{
              "messages": true,
              "session_requests": true,
              "tips": true,
              "follows": true,
              "creator_online": true,
              "system": true,
              "email_notifications": false,
              "push_notifications": true
            }',
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
          )
        `);
        logger.info('✅ Created notification_preferences table');
        break;

      case 'stream_goals':
        await client.query(`
          CREATE TABLE stream_goals (
            id SERIAL PRIMARY KEY,
            stream_id INTEGER REFERENCES sessions(id) ON DELETE CASCADE,
            creator_id VARCHAR(255) REFERENCES users(supabase_id) ON DELETE CASCADE,
            goal_amount DECIMAL(12,2) NOT NULL,
            description TEXT,
            category VARCHAR(50) DEFAULT 'tokens',
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),
            UNIQUE(stream_id),
            CHECK (goal_amount > 0),
            CHECK (category IN ('tokens', 'subscribers', 'views', 'custom'))
          )
        `);
        logger.info('✅ Created stream_goals table');
        break;

      case 'achievements':
        await client.query(`
          CREATE TABLE achievements (
            id SERIAL PRIMARY KEY,
            user_id VARCHAR(255) REFERENCES users(supabase_id) ON DELETE CASCADE,
            type VARCHAR(50) NOT NULL,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            points INTEGER DEFAULT 0,
            metadata JSONB,
            created_at TIMESTAMP DEFAULT NOW(),
            CHECK (points >= 0),
            CHECK (type IN ('goal_reached', 'streak', 'milestone', 'social', 'custom'))
          )
        `);
        logger.info('✅ Created achievements table');
        break;

      case 'user_challenges':
        await client.query(`
          CREATE TABLE user_challenges (
            id SERIAL PRIMARY KEY,
            user_id VARCHAR(255) REFERENCES users(supabase_id) ON DELETE CASCADE,
            challenge_id VARCHAR(100) NOT NULL,
            type VARCHAR(20) NOT NULL,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            target_value TEXT NOT NULL,
            reward_tokens INTEGER DEFAULT 0,
            reward_points INTEGER DEFAULT 0,
            status VARCHAR(20) DEFAULT 'active',
            progress INTEGER DEFAULT 0,
            date_assigned DATE NOT NULL,
            completed_at TIMESTAMP,
            metadata JSONB,
            created_at TIMESTAMP DEFAULT NOW(),
            CHECK (status IN ('active', 'completed', 'expired')),
            CHECK (type IN ('daily', 'weekly', 'monthly', 'special')),
            CHECK (progress >= 0),
            CHECK (reward_tokens >= 0),
            CHECK (reward_points >= 0)
          )
        `);
        logger.info('✅ Created user_challenges table');
        break;

      case 'creator_applications':
        await client.query(`
          CREATE TABLE creator_applications (
            id SERIAL PRIMARY KEY,
            user_id VARCHAR(255) REFERENCES users(supabase_id) ON DELETE CASCADE,
            bio TEXT NOT NULL,
            specialties JSONB,
            experience TEXT,
            social_media JSONB,
            pricing JSONB NOT NULL,
            availability JSONB,
            status VARCHAR(20) DEFAULT 'pending',
            submitted_at TIMESTAMP DEFAULT NOW(),
            reviewed_at TIMESTAMP,
            reviewed_by VARCHAR(255) REFERENCES users(supabase_id) ON DELETE SET NULL,
            review_notes TEXT,
            rejection_reason TEXT,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),
            CHECK (status IN ('pending', 'approved', 'rejected', 'under_review')),
            UNIQUE(user_id, status) -- Prevent multiple pending applications per user
          )
        `);
        logger.info('✅ Created creator_applications table');
        break;

      case 'session_ratings':
        await client.query(`
          CREATE TABLE session_ratings (
            id SERIAL PRIMARY KEY,
            session_id INTEGER REFERENCES sessions(id) ON DELETE CASCADE,
            rater_id VARCHAR(255) REFERENCES users(supabase_id) ON DELETE CASCADE,
            rating INTEGER NOT NULL,
            review_text TEXT,
            created_at TIMESTAMP DEFAULT NOW(),
            CHECK (rating >= 1 AND rating <= 5),
            UNIQUE(session_id, rater_id)
          )
        `);
        logger.info('✅ Created session_ratings table');
        break;

      case 'subscription_plans':
        await client.query(`
          CREATE TABLE subscription_plans (
            id SERIAL PRIMARY KEY,
            creator_id VARCHAR(255) REFERENCES users(supabase_id) ON DELETE CASCADE,
            name VARCHAR(255) NOT NULL,
            description TEXT,
            price DECIMAL(10,2) NOT NULL,
            billing_interval VARCHAR(20) DEFAULT 'month',
            features JSONB DEFAULT '[]',
            perks JSONB DEFAULT '[]',
            stripe_product_id VARCHAR(255),
            stripe_price_id VARCHAR(255),
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),
            CHECK (price > 0),
            CHECK (billing_interval IN ('month', 'year'))
          )
        `);
        logger.info('✅ Created subscription_plans table');
        break;

      case 'creator_subscriptions':
        await client.query(`
          CREATE TABLE creator_subscriptions (
            id SERIAL PRIMARY KEY,
            subscriber_id VARCHAR(255) REFERENCES users(supabase_id) ON DELETE CASCADE,
            creator_id VARCHAR(255) REFERENCES users(supabase_id) ON DELETE CASCADE,
            plan_id INTEGER REFERENCES subscription_plans(id) ON DELETE CASCADE,
            stripe_subscription_id VARCHAR(255),
            status VARCHAR(50) DEFAULT 'active',
            current_period_start TIMESTAMP,
            current_period_end TIMESTAMP,
            canceled_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),
            CHECK (status IN ('active', 'canceled', 'cancel_at_period_end', 'past_due', 'incomplete'))
          )
        `);
        logger.info('✅ Created creator_subscriptions table');
        break;

      case 'content_moderation':
        await client.query(`
          CREATE TABLE content_moderation (
            id SERIAL PRIMARY KEY,
            content_type VARCHAR(50) NOT NULL,
            content_id VARCHAR(255),
            user_id VARCHAR(255) REFERENCES users(supabase_id) ON DELETE CASCADE,
            original_content TEXT,
            moderation_result JSONB,
            is_violation BOOLEAN DEFAULT FALSE,
            confidence_score INTEGER DEFAULT 0,
            severity VARCHAR(20) DEFAULT 'low',
            action_taken VARCHAR(50),
            status VARCHAR(20) DEFAULT 'pending',
            admin_review TEXT,
            reviewed_by VARCHAR(255) REFERENCES users(supabase_id) ON DELETE SET NULL,
            reviewed_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT NOW(),
            CHECK (severity IN ('low', 'medium', 'high')),
            CHECK (status IN ('pending', 'approved', 'rejected', 'flagged', 'escalated'))
          )
        `);
        logger.info('✅ Created content_moderation table');
        break;

      case 'blocked_content':
        await client.query(`
          CREATE TABLE blocked_content (
            id SERIAL PRIMARY KEY,
            content_type VARCHAR(50) NOT NULL,
            content_id VARCHAR(255) NOT NULL,
            user_id VARCHAR(255) REFERENCES users(supabase_id) ON DELETE CASCADE,
            reason TEXT,
            blocked_at TIMESTAMP DEFAULT NOW(),
            unblocked_at TIMESTAMP,
            unblocked_by VARCHAR(255) REFERENCES users(supabase_id) ON DELETE SET NULL
          )
        `);
        logger.info('✅ Created blocked_content table');
        break;

      case 'user_penalties':
        await client.query(`
          CREATE TABLE user_penalties (
            id SERIAL PRIMARY KEY,
            user_id VARCHAR(255) REFERENCES users(supabase_id) ON DELETE CASCADE,
            penalty_type VARCHAR(50) NOT NULL,
            severity VARCHAR(20) NOT NULL,
            duration_days INTEGER DEFAULT 0,
            reason TEXT,
            applied_by VARCHAR(255) REFERENCES users(supabase_id) ON DELETE SET NULL,
            created_at TIMESTAMP DEFAULT NOW(),
            expires_at TIMESTAMP,
            is_active BOOLEAN DEFAULT TRUE,
            CHECK (penalty_type IN ('warning', 'suspension', 'ban', 'restriction')),
            CHECK (severity IN ('low', 'medium', 'high'))
          )
        `);
        logger.info('✅ Created user_penalties table');
        break;

      case 'stream_recordings':
        await client.query(`
          CREATE TABLE stream_recordings (
            id SERIAL PRIMARY KEY,
            session_id INTEGER REFERENCES sessions(id) ON DELETE CASCADE,
            creator_id VARCHAR(255) REFERENCES users(supabase_id) ON DELETE CASCADE,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            is_private BOOLEAN DEFAULT FALSE,
            status VARCHAR(50) DEFAULT 'recording',
            duration_seconds INTEGER DEFAULT 0,
            file_url TEXT,
            thumbnail_url TEXT,
            file_size BIGINT DEFAULT 0,
            external_recording_id VARCHAR(255),
            recording_settings JSONB,
            recording_config JSONB,
            processing_result JSONB,
            started_at TIMESTAMP DEFAULT NOW(),
            ended_at TIMESTAMP,
            processed_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),
            CHECK (status IN ('recording', 'processing', 'completed', 'failed', 'deleted'))
          )
        `);
        logger.info('✅ Created stream_recordings table');
        break;

      case 'recording_views':
        await client.query(`
          CREATE TABLE recording_views (
            id SERIAL PRIMARY KEY,
            recording_id INTEGER REFERENCES stream_recordings(id) ON DELETE CASCADE,
            viewer_id VARCHAR(255) REFERENCES users(supabase_id) ON DELETE CASCADE,
            watch_duration INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT NOW()
          )
        `);
        logger.info('✅ Created recording_views table');
        break;

      case 'recording_purchases':
        await client.query(`
          CREATE TABLE recording_purchases (
            id SERIAL PRIMARY KEY,
            user_id VARCHAR(255) REFERENCES users(supabase_id) ON DELETE CASCADE,
            recording_id INTEGER REFERENCES stream_recordings(id) ON DELETE CASCADE,
            price_paid DECIMAL(10,2) NOT NULL,
            payment_method VARCHAR(50) DEFAULT 'tokens',
            stripe_payment_intent_id VARCHAR(255),
            created_at TIMESTAMP DEFAULT NOW(),
            UNIQUE(user_id, recording_id)
          )
        `);
        logger.info('✅ Created recording_purchases table');
        break;

      case 'recording_clips':
        await client.query(`
          CREATE TABLE recording_clips (
            id SERIAL PRIMARY KEY,
            recording_id INTEGER REFERENCES stream_recordings(id) ON DELETE CASCADE,
            creator_id VARCHAR(255) REFERENCES users(supabase_id) ON DELETE CASCADE,
            created_by VARCHAR(255) REFERENCES users(supabase_id) ON DELETE CASCADE,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            start_time INTEGER NOT NULL,
            end_time INTEGER NOT NULL,
            duration_seconds INTEGER NOT NULL,
            clip_url TEXT,
            thumbnail_url TEXT,
            file_size BIGINT DEFAULT 0,
            is_public BOOLEAN DEFAULT TRUE,
            status VARCHAR(50) DEFAULT 'processing',
            processing_result JSONB,
            created_at TIMESTAMP DEFAULT NOW(),
            completed_at TIMESTAMP,
            CHECK (status IN ('processing', 'completed', 'failed')),
            CHECK (start_time >= 0),
            CHECK (end_time > start_time),
            CHECK (duration_seconds > 0)
          )
        `);
        logger.info('✅ Created recording_clips table');
        break;

      case 'clip_views':
        await client.query(`
          CREATE TABLE clip_views (
            id SERIAL PRIMARY KEY,
            clip_id INTEGER REFERENCES recording_clips(id) ON DELETE CASCADE,
            viewer_id VARCHAR(255) REFERENCES users(supabase_id) ON DELETE CASCADE,
            watch_duration INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT NOW()
          )
        `);
        logger.info('✅ Created clip_views table');
        break;

      case 'clip_likes':
        await client.query(`
          CREATE TABLE clip_likes (
            id SERIAL PRIMARY KEY,
            clip_id INTEGER REFERENCES recording_clips(id) ON DELETE CASCADE,
            user_id VARCHAR(255) REFERENCES users(supabase_id) ON DELETE CASCADE,
            created_at TIMESTAMP DEFAULT NOW(),
            UNIQUE(clip_id, user_id)
          )
        `);
        logger.info('✅ Created clip_likes table');
        break;

      case 'creator_offers':
        await client.query(`
          CREATE TABLE creator_offers (
            id SERIAL PRIMARY KEY,
            creator_id VARCHAR(255) REFERENCES users(supabase_id) ON DELETE CASCADE,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            category VARCHAR(100),
            price_tokens INTEGER NOT NULL,
            delivery_time VARCHAR(100),
            max_quantity INTEGER,
            active BOOLEAN DEFAULT true,
            display_order INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),
            CHECK (price_tokens > 0),
            CHECK (max_quantity IS NULL OR max_quantity > 0)
          )
        `);
        logger.info('✅ Created creator_offers table');
        break;

      case 'offer_purchases':
        await client.query(`
          CREATE TABLE offer_purchases (
            id SERIAL PRIMARY KEY,
            offer_id INTEGER REFERENCES creator_offers(id) ON DELETE CASCADE,
            buyer_id VARCHAR(255) REFERENCES users(supabase_id) ON DELETE CASCADE,
            creator_id VARCHAR(255) REFERENCES users(supabase_id) ON DELETE CASCADE,
            tokens_paid INTEGER NOT NULL,
            status VARCHAR(50) DEFAULT 'pending',
            notes TEXT,
            completed_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),
            CHECK (tokens_paid > 0),
            CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled', 'refunded'))
          )
        `);
        logger.info('✅ Created offer_purchases table');
        break;
        
      default:
        logger.info(`⚠️ Unknown table: ${tableName}`);
    }
  } catch (error) {
    logger.error(`❌ Error creating table ${tableName}:`, error.message);
    throw error;
  }
};

const addMissingColumns = async (client, tableName, columns) => {
  try {
    const existingColumns = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = $1
    `, [tableName]);
    
    const existingColumnNames = existingColumns.rows.map(row => row.column_name);
    
    for (const column of columns) {
      if (!existingColumnNames.includes(column.name)) {
        try {
          await client.query(`ALTER TABLE ${tableName} ADD COLUMN ${column.name} ${column.type}`);
          logger.info(`✅ Added column ${column.name} to ${tableName}`);
        } catch (error) {
          logger.info(`⚠️ Column ${column.name} might already exist in ${tableName}:`, error.message);
        }
      } else {
        logger.info(`✓ Column ${column.name} already exists in ${tableName}`);
      }
    }
  } catch (error) {
    logger.error(`❌ Error adding columns to ${tableName}:`, error.message);
  }
};

const createIndexes = async (client) => {
  const indexes = [
    { table: 'users', name: 'idx_users_supabase_id', column: 'supabase_id' },
    { table: 'users', name: 'idx_users_is_creator', column: 'is_creator' },
    { table: 'users', name: 'idx_users_created_at', column: 'created_at' },
    { table: 'sessions', name: 'idx_sessions_creator_id', column: 'creator_id' },
    { table: 'sessions', name: 'idx_sessions_fan_id', column: 'fan_id' },
    { table: 'sessions', name: 'idx_sessions_status', column: 'status' },
    { table: 'sessions', name: 'idx_sessions_start_time', column: 'start_time' },
    { table: 'sessions', name: 'idx_sessions_type', column: 'type' },
    { table: 'payments', name: 'idx_payments_session_id', column: 'session_id' },
    { table: 'payments', name: 'idx_payments_status', column: 'status' },
    { table: 'payments', name: 'idx_payments_stripe_id', column: 'stripe_payment_intent_id' },
    { table: 'payments', name: 'idx_payments_created_at', column: 'created_at' },
    { table: 'payments', name: 'idx_payments_user_id', column: 'user_id' },
    { table: 'chat_messages', name: 'idx_chat_messages_channel', column: 'channel' },
    { table: 'chat_messages', name: 'idx_chat_messages_sender_id', column: 'sender_id' },
    { table: 'chat_messages', name: 'idx_chat_messages_created_at', column: 'created_at' },
    { table: 'token_balances', name: 'idx_token_balances_user_id', column: 'user_id' },
    { table: 'token_transactions', name: 'idx_token_transactions_user_id', column: 'user_id' },
    { table: 'token_transactions', name: 'idx_token_transactions_type', column: 'type' },
    { table: 'token_transactions', name: 'idx_token_transactions_created_at', column: 'created_at' },
    { table: 'token_transactions', name: 'idx_token_transactions_session_id', column: 'session_id' },
    { table: 'payouts', name: 'idx_payouts_creator_id', column: 'creator_id' },
    { table: 'payouts', name: 'idx_payouts_status', column: 'status' },
    { table: 'payouts', name: 'idx_payouts_created_at', column: 'created_at' },
    { table: 'fraud_alerts', name: 'idx_fraud_alerts_user_id', column: 'user_id' },
    { table: 'fraud_alerts', name: 'idx_fraud_alerts_type', column: 'alert_type' },
    { table: 'fraud_alerts', name: 'idx_fraud_alerts_created_at', column: 'created_at' },
    { table: 'followers', name: 'idx_followers_creator_id', column: 'creator_id' },
    { table: 'followers', name: 'idx_followers_follower_id', column: 'follower_id' },
    { table: 'followers', name: 'idx_followers_created_at', column: 'created_at' },
    { table: 'messages', name: 'idx_messages_sender_id', column: 'sender_id' },
    { table: 'messages', name: 'idx_messages_recipient_id', column: 'recipient_id' },
    { table: 'messages', name: 'idx_messages_created_at', column: 'created_at' },
    { table: 'messages', name: 'idx_messages_read_at', column: 'read_at' },
    { table: 'user_online_status', name: 'idx_user_online_status_user_id', column: 'user_id' },
    { table: 'user_online_status', name: 'idx_user_online_status_is_online', column: 'is_online' },
    { table: 'notifications', name: 'idx_notifications_recipient_id', column: 'recipient_id' },
    { table: 'notifications', name: 'idx_notifications_sender_id', column: 'sender_id' },
    { table: 'notifications', name: 'idx_notifications_type', column: 'type' },
    { table: 'notifications', name: 'idx_notifications_read_at', column: 'read_at' },
    { table: 'notifications', name: 'idx_notifications_created_at', column: 'created_at' },
    { table: 'notifications', name: 'idx_notifications_expires_at', column: 'expires_at' },
    { table: 'notification_preferences', name: 'idx_notification_preferences_user_id', column: 'user_id' }
  ];
  
  for (const index of indexes) {
    try {
      await client.query(`CREATE INDEX IF NOT EXISTS ${index.name} ON ${index.table}(${index.column})`);
      logger.info(`✅ Created index ${index.name}`);
    } catch (error) {
      logger.info(`⚠️ Index ${index.name} might already exist:`, error.message);
    }
  }
};

const addConstraints = async (client) => {
  const constraints = [
    { table: 'users', name: 'check_price_per_min', constraint: 'CHECK (price_per_min >= 0)' },
    { table: 'users', name: 'check_total_earnings', constraint: 'CHECK (total_earnings >= 0)' },
    { table: 'users', name: 'check_total_spent', constraint: 'CHECK (total_spent >= 0)' },
    { table: 'users', name: 'check_total_sessions', constraint: 'CHECK (total_sessions >= 0)' },
    { table: 'users', name: 'check_auto_refill_package', constraint: 'CHECK (auto_refill_package >= 0)' },
    { table: 'users', name: 'check_last_purchase_amount', constraint: 'CHECK (last_purchase_amount >= 0)' },
    { table: 'sessions', name: 'check_end_time', constraint: 'CHECK (end_time IS NULL OR end_time >= start_time)' },
    { table: 'sessions', name: 'check_different_users', constraint: 'CHECK (creator_id != fan_id)' },
    { table: 'sessions', name: 'check_session_type', constraint: 'CHECK (type IN (\'video\', \'voice\', \'stream\'))' },
    { table: 'sessions', name: 'check_session_status', constraint: 'CHECK (status IN (\'active\', \'ended\', \'cancelled\'))' },
    { table: 'sessions', name: 'check_price_per_min_sessions', constraint: 'CHECK (price_per_min >= 0)' },
    { table: 'sessions', name: 'check_total_amount', constraint: 'CHECK (total_amount >= 0)' },
    { table: 'sessions', name: 'check_duration_minutes', constraint: 'CHECK (duration_minutes >= 0)' },
    { table: 'payments', name: 'check_amount', constraint: 'CHECK (amount > 0)' },
    { table: 'payments', name: 'check_tip', constraint: 'CHECK (tip >= 0)' },
    { table: 'payments', name: 'check_payment_status', constraint: 'CHECK (status IN (\'pending\', \'completed\', \'failed\', \'refunded\', \'requires_action\'))' },
    { table: 'payments', name: 'check_duration_minutes_payments', constraint: 'CHECK (duration_minutes >= 0)' },
    { table: 'token_balances', name: 'check_balance', constraint: 'CHECK (balance >= 0)' },
    { table: 'token_transactions', name: 'check_tokens', constraint: 'CHECK (tokens >= 0)' },
    { table: 'token_transactions', name: 'check_bonus_tokens', constraint: 'CHECK (bonus_tokens >= 0)' },
    { table: 'token_transactions', name: 'check_transaction_type', constraint: 'CHECK (type IN (\'purchase\', \'tip\', \'call\', \'refund\', \'payout\'))' },
    { table: 'token_transactions', name: 'check_transaction_status', constraint: 'CHECK (status IN (\'pending\', \'completed\', \'failed\', \'refunded\'))' },
    { table: 'payouts', name: 'check_tokens_redeemed', constraint: 'CHECK (tokens_redeemed >= 0)' },
    { table: 'payouts', name: 'check_payout_amount', constraint: 'CHECK (payout_amount >= 0)' },
    { table: 'payouts', name: 'check_payout_status', constraint: 'CHECK (status IN (\'pending\', \'completed\', \'failed\'))' },
    { table: 'notifications', name: 'check_notification_type', constraint: 'CHECK (type IN (\'message\', \'session_request\', \'session_started\', \'session_ended\', \'tip_received\', \'follow\', \'creator_online\', \'system\'))' },
    { table: 'notifications', name: 'check_expires_after_created', constraint: 'CHECK (expires_at IS NULL OR expires_at > created_at)' },
    { table: 'notifications', name: 'check_read_after_created', constraint: 'CHECK (read_at IS NULL OR read_at >= created_at)' }
  ];
  
  for (const constraint of constraints) {
    try {
      await client.query(`ALTER TABLE ${constraint.table} ADD CONSTRAINT IF NOT EXISTS ${constraint.name} ${constraint.constraint}`);
      logger.info(`✅ Added constraint ${constraint.name} to ${constraint.table}`);
    } catch (error) {
      logger.info(`⚠️ Constraint ${constraint.name} might already exist:`, error.message);
    }
  }
};

const showTableSummary = async (client) => {
  try {
    logger.info('\n📋 Final Database Summary:');
    logger.info('=' .repeat(50));
    
    const tables = await client.query(`
      SELECT 
        t.table_name,
        (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
      FROM information_schema.tables t
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY t.table_name
    `);
    
    for (const table of tables.rows) {
      try {
        const rowCount = await client.query(`SELECT COUNT(*) as count FROM ${table.table_name}`);
        logger.info(`📄 ${table.table_name}: ${table.column_count} columns, ${rowCount.rows[0].count} rows`);
      } catch (error) {
        logger.info(`📄 ${table.table_name}: ${table.column_count} columns, ? rows`);
      }
    }
    
    logger.info('\n🎉 Database is ready for Digis platform with token economy!');
    
  } catch (error) {
    logger.error('❌ Error showing table summary:', error.message);
  }
};

const rollbackMigration = async (tableName) => {
  const client = await pool.connect();
  
  try {
    logger.info(`🔄 Rolling back table: ${tableName}`);
    
    await client.query(`DROP TABLE IF EXISTS ${tableName} CASCADE`);
    logger.info(`✅ Dropped table ${tableName}`);
    
  } catch (error) {
    logger.error(`❌ Rollback failed for ${tableName}:`, error.message);
    throw error;
  } finally {
    client.release();
  }
};

const showMigrationStatus = async () => {
  const client = await pool.connect();
  
  try {
    logger.info('📊 Migration Status Report');
    logger.info('=' .repeat(50));
    
    const isConnected = await testConnection();
    logger.info('🔗 Database Connection:', isConnected ? 'Connected' : 'Failed');
    
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    logger.info('\n📋 Available Tables:');
    tables.rows.forEach(table => {
      logger.info(`   📄 ${table.table_name}`);
    });
    
    logger.info('\n📊 Table Details:');
    for (const table of tables.rows) {
      try {
        const columns = await client.query(`
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns
          WHERE table_name = $1
          ORDER BY ordinal_position
        `, [table.table_name]);
        
        logger.info(`\n📄 ${table.table_name}:`);
        columns.rows.forEach(col => {
          logger.info(`   • ${col.column_name} (${col.data_type})`);
        });
      } catch (error) {
        logger.info(`   ❌ Error reading ${table.table_name} structure`);
      }
    }
    
  } catch (error) {
    logger.error('❌ Failed to show migration status:', error.message);
    throw error;
  } finally {
    client.release();
  }
};

const resetDatabase = async () => {
  const client = await pool.connect();
  
  try {
    logger.info('⚠️ DANGER: This will drop all tables and data!');
    logger.info('🔄 Resetting database...');
    
    const tables = [
      'fraud_alerts', 'payouts', 'token_transactions', 'token_balances', 
      'chat_messages', 'payments', 'sessions', 'users'
    ];
    
    for (const table of tables) {
      try {
        await client.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
        logger.info(`✅ Dropped table ${table}`);
      } catch (error) {
        logger.info(`⚠️ Warning dropping ${table}:`, error.message);
      }
    }
    
    logger.info('✅ Database reset completed');
    
  } catch (error) {
    logger.error('❌ Database reset failed:', error.message);
    throw error;
  } finally {
    client.release();
  }
};

if (require.main === module) {
  const command = process.argv[2];
  const tableName = process.argv[3];
  
  const commands = {
    up: () => runMigrations(),
    down: () => {
      if (!tableName) {
        logger.error('❌ Table name required for rollback');
        logger.info('Usage: node migrate.js down <table_name>');
        process.exit(1);
      }
      return rollbackMigration(tableName);
    },
    status: () => showMigrationStatus(),
    reset: () => resetDatabase()
  };
  
  if (commands[command]) {
    commands[command]()
      .then(() => {
        logger.info(`\n✅ Command '${command}' completed successfully`);
        process.exit(0);
      })
      .catch((error) => {
        logger.error(`\n❌ Command '${command}' failed:`, error.message);
        process.exit(1);
      });
  } else {
    logger.info('Digis Database Migration Tool');
    logger.info('=' .repeat(30));
    logger.info('Usage:');
    logger.info('  node migrate.js up           - Run migrations');
    logger.info('  node migrate.js down <table> - Drop a specific table');
    logger.info('  node migrate.js status       - Show migration status');
    logger.info('  node migrate.js reset        - Reset database (DANGER!)');
    logger.info('');
    logger.info('Examples:');
    logger.info('  node migrate.js up');
    logger.info('  node migrate.js down payments');
    logger.info('  node migrate.js status');
    process.exit(1);
  }
}

module.exports = { 
  runMigrations,
  rollbackMigration,
  showMigrationStatus,
  resetDatabase
};