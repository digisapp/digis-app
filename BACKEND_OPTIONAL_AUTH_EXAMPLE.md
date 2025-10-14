# Backend Optional Auth Pattern - Implementation Guide

## Overview
This document provides drop-in code for implementing "optional auth" on public endpoints.
Allows both signed-in and signed-out users to access the same endpoint with different capabilities.

---

## 1. Optional Auth Middleware

**File:** `backend/middleware/optionalSupabaseAuth.js`

```javascript
/**
 * Optional Supabase Auth Middleware
 *
 * Parses Authorization header and verifies token, but doesn't 401 if missing/invalid.
 * Sets req.user if token is valid, leaves undefined otherwise.
 *
 * Use for public endpoints that enhance UX for logged-in users.
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Verify Supabase JWT token
 * @param {string} token - JWT access token
 * @returns {Promise<object|null>} User object or null
 */
async function verifySupabaseToken(token) {
  try {
    const { data, error } = await supabase.auth.getUser(token);

    if (error) {
      console.log('Token verification failed:', error.message);
      return null;
    }

    return data.user;
  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
}

/**
 * Optional auth middleware - doesn't fail request if auth missing
 */
async function optionalSupabaseAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';

  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7); // Remove 'Bearer ' prefix

    try {
      const user = await verifySupabaseToken(token);

      if (user) {
        req.user = user;
        req.userId = user.id;
        console.log('✅ Optional auth: User authenticated:', user.id);
      } else {
        console.log('⚠️ Optional auth: Invalid token, continuing as guest');
      }
    } catch (error) {
      console.error('Optional auth error:', error);
      // Continue anyway - this is optional auth
    }
  } else {
    console.log('ℹ️ Optional auth: No token provided, continuing as guest');
  }

  // Always call next() - never block the request
  next();
}

module.exports = { optionalSupabaseAuth };
```

---

## 2. Public Profile Endpoint

**File:** `backend/routes/publicProfiles.js`

```javascript
const express = require('express');
const router = express.Router();
const { optionalSupabaseAuth } = require('../middleware/optionalSupabaseAuth');
const db = require('../utils/db');

/**
 * GET /api/public/profile/:username
 *
 * Public endpoint - works for both signed-in and signed-out users.
 * Signed-in users get enhanced data (following status, relationship, capabilities).
 */
router.get('/profile/:username', optionalSupabaseAuth, async (req, res) => {
  const { username } = req.params;
  const viewerId = req.userId; // Set by optionalSupabaseAuth if authenticated

  try {
    // Fetch creator's public profile
    const creator = await db.query(
      `SELECT
        id, username, display_name, bio, avatar_url,
        follower_count, subscriber_count, is_verified,
        allow_dm, allow_tips, subscription_price
      FROM users
      WHERE username = $1 AND is_creator = true`,
      [username]
    );

    if (creator.rows.length === 0) {
      return res.status(404).json({ error: 'Creator not found' });
    }

    const profile = creator.rows[0];

    // Base capabilities (for guests)
    const capabilities = {
      canFollow: false,
      canMessage: false,
      canTip: false,
      canSubscribe: false,
      canViewContent: false
    };

    let relationship = null;

    // If user is authenticated, check relationship and grant capabilities
    if (viewerId) {
      // Check if viewer is following
      const followCheck = await db.query(
        'SELECT * FROM follows WHERE follower_id = $1 AND following_id = $2',
        [viewerId, profile.id]
      );

      // Check if viewer is subscribed
      const subCheck = await db.query(
        'SELECT * FROM subscriptions WHERE subscriber_id = $1 AND creator_id = $2 AND active = true',
        [viewerId, profile.id]
      );

      const isFollowing = followCheck.rows.length > 0;
      const isSubscribed = subCheck.rows.length > 0;

      relationship = {
        isFollowing,
        isSubscribed,
        canDM: profile.allow_dm && (isSubscribed || profile.allow_dm_from_followers)
      };

      // Grant capabilities for authenticated users
      capabilities.canFollow = !isFollowing;
      capabilities.canMessage = relationship.canDM;
      capabilities.canTip = profile.allow_tips;
      capabilities.canSubscribe = !isSubscribed && profile.subscription_price > 0;
      capabilities.canViewContent = isSubscribed || profile.public_content;
    }

    // Return profile with capabilities
    res.json({
      profile: {
        id: profile.id,
        username: profile.username,
        displayName: profile.display_name,
        bio: profile.bio,
        avatarUrl: profile.avatar_url,
        followerCount: profile.follower_count,
        subscriberCount: profile.subscriber_count,
        isVerified: profile.is_verified,
        subscriptionPrice: profile.subscription_price
      },
      capabilities,
      relationship,
      viewerAuthenticated: !!viewerId
    });

  } catch (error) {
    console.error('Error fetching public profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
```

---

## 3. Protected Action Endpoints

**File:** `backend/routes/follows.js`

```javascript
const express = require('express');
const router = express.Router();
const { requireSupabaseAuth } = require('../middleware/requireSupabaseAuth');
const db = require('../utils/db');

/**
 * POST /api/follows
 *
 * Protected endpoint - requires authentication.
 * Returns 401 JSON (not HTML redirect) if unauthorized.
 */
router.post('/', requireSupabaseAuth, async (req, res) => {
  const { creatorUsername } = req.body;
  const followerId = req.userId; // Set by requireSupabaseAuth middleware

  if (!creatorUsername) {
    return res.status(400).json({ error: 'Creator username is required' });
  }

  try {
    // Find creator by username
    const creator = await db.query(
      'SELECT id FROM users WHERE username = $1',
      [creatorUsername]
    );

    if (creator.rows.length === 0) {
      return res.status(404).json({ error: 'Creator not found' });
    }

    const creatorId = creator.rows[0].id;

    // Check if already following
    const existing = await db.query(
      'SELECT * FROM follows WHERE follower_id = $1 AND following_id = $2',
      [followerId, creatorId]
    );

    if (existing.rows.length > 0) {
      return res.status(200).json({
        ok: true,
        isFollowing: true,
        message: 'Already following'
      });
    }

    // Create follow relationship
    await db.query(
      'INSERT INTO follows (follower_id, following_id, created_at) VALUES ($1, $2, NOW())',
      [followerId, creatorId]
    );

    // Increment follower count
    await db.query(
      'UPDATE users SET follower_count = follower_count + 1 WHERE id = $1',
      [creatorId]
    );

    // Return 201 Created with JSON (not HTML)
    res.status(201).json({
      ok: true,
      isFollowing: true,
      message: 'Successfully followed'
    });

  } catch (error) {
    console.error('Error following creator:', error);
    res.status(500).json({ error: 'Failed to follow creator' });
  }
});

/**
 * DELETE /api/follows/:username
 *
 * Unfollow a creator - requires authentication
 */
router.delete('/:username', requireSupabaseAuth, async (req, res) => {
  const { username } = req.params;
  const followerId = req.userId;

  try {
    const creator = await db.query(
      'SELECT id FROM users WHERE username = $1',
      [username]
    );

    if (creator.rows.length === 0) {
      return res.status(404).json({ error: 'Creator not found' });
    }

    const creatorId = creator.rows[0].id;

    // Delete follow relationship
    const result = await db.query(
      'DELETE FROM follows WHERE follower_id = $1 AND following_id = $2',
      [followerId, creatorId]
    );

    if (result.rowCount === 0) {
      return res.status(200).json({
        ok: true,
        isFollowing: false,
        message: 'Not following'
      });
    }

    // Decrement follower count
    await db.query(
      'UPDATE users SET follower_count = GREATEST(0, follower_count - 1) WHERE id = $1',
      [creatorId]
    );

    res.json({
      ok: true,
      isFollowing: false,
      message: 'Successfully unfollowed'
    });

  } catch (error) {
    console.error('Error unfollowing creator:', error);
    res.status(500).json({ error: 'Failed to unfollow creator' });
  }
});

module.exports = router;
```

---

## 4. Strict Auth Middleware (for comparison)

**File:** `backend/middleware/requireSupabaseAuth.js`

```javascript
/**
 * Strict Supabase Auth Middleware
 *
 * Requires valid token - returns 401 JSON (not redirect) if missing/invalid.
 * Use for protected action endpoints (follow, tip, message, etc.)
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifySupabaseToken(token) {
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error) return null;
    return data.user;
  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
}

/**
 * Strict auth middleware - blocks request if no valid token
 */
async function requireSupabaseAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';

  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authorization header is required'
    });
  }

  const token = authHeader.slice(7);

  try {
    const user = await verifySupabaseToken(token);

    if (!user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired token'
      });
    }

    // Attach user info to request
    req.user = user;
    req.userId = user.id;

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication failed'
    });
  }
}

module.exports = { requireSupabaseAuth };
```

---

## 5. CORS Configuration

**File:** `backend/app.js` or `backend/server.js`

```javascript
const express = require('express');
const cors = require('cors');

const app = express();

// CORS configuration for cross-origin requests
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests from your frontend domain
    const allowedOrigins = [
      'https://digis.cc',
      'https://www.digis.cc',
      'http://localhost:3000', // Development
      'http://localhost:5173'  // Vite dev server
    ];

    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true, // Allow cookies if using cookie-based auth
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400 // Cache preflight requests for 24 hours
};

app.use(cors(corsOptions));

// Body parsers
app.json({ limit: '10mb' });
app.urlencoded({ extended: true, limit: '10mb' });

// Mount routes
app.use('/api/public', require('./routes/publicProfiles'));
app.use('/api/follows', require('./routes/follows'));
// ... other routes

module.exports = app;
```

---

## 6. Username Validation (Server-Side)

**File:** `backend/shared/reservedUsernames.js`

```javascript
/**
 * Reserved Usernames - Server-Side List
 *
 * IMPORTANT: Keep this synchronized with frontend:
 * frontend/src/shared/reservedUsernames.js
 */

const RESERVED_USERNAMES = new Set([
  'explore', 'dashboard', 'admin', 'settings', 'profile',
  'wallet', 'messages', 'notifications', 'login', 'signup',
  'signin', 'register', 'auth', 'logout', 'signout', 'stream',
  'streaming', 'live', 'tv', 'classes', 'shop', 'collections',
  'content', 'digitals', 'offers', 'followers', 'following',
  'subscribers', 'subscriptions', 'analytics', 'earnings',
  'schedule', 'calendar', 'calls', 'call-requests', 'history',
  'terms', 'privacy', 'help', 'support', 'contact', 'about',
  'faq', 'api', 'static', 'assets', 'public', 'cdn', 'media',
  'uploads', 'moderator', 'staff', 'team', 'internal',
  'shop-management', 'cart', 'checkout', 'orders', 'products',
  'kyc', 'verification', 'creator', 'fan', 'user', 'account',
  'billing', 'payment', 'subscribe', 'app', 'home', 'index',
  'main', 'root', 'www', 'blog', 'news', 'search', 'digis',
  'digisapp', 'official', 'test', 'testing', 'debug',
  'supabase-test'
]);

function isReservedUsername(username) {
  if (!username) return true;
  return RESERVED_USERNAMES.has(username.toLowerCase());
}

function validateUsername(username) {
  if (!username || typeof username !== 'string') {
    return { valid: false, error: 'Username is required' };
  }

  const trimmed = username.trim().toLowerCase();

  if (trimmed.length < 3) {
    return { valid: false, error: 'Username must be at least 3 characters' };
  }

  if (trimmed.length > 20) {
    return { valid: false, error: 'Username must be 20 characters or less' };
  }

  if (!/^[a-z0-9._]{3,20}$/.test(trimmed)) {
    return { valid: false, error: 'Username can only contain lowercase letters, numbers, dots, and underscores' };
  }

  if (isReservedUsername(trimmed)) {
    return { valid: false, error: 'This username is reserved' };
  }

  if (/^[._]|[._]$/.test(trimmed)) {
    return { valid: false, error: 'Username cannot start or end with a dot or underscore' };
  }

  if (/[._]{2,}/.test(trimmed)) {
    return { valid: false, error: 'Username cannot have consecutive dots or underscores' };
  }

  return { valid: true, error: null };
}

module.exports = {
  RESERVED_USERNAMES,
  isReservedUsername,
  validateUsername
};
```

---

## 7. Testing Your Backend

### Test Optional Auth Endpoint

```bash
# Guest user (no token)
curl https://backend.digis.cc/api/public/profile/miriam

# Expected: 200 OK with basic capabilities
{
  "profile": { ... },
  "capabilities": {
    "canFollow": false,
    "canMessage": false,
    "canTip": false
  },
  "relationship": null,
  "viewerAuthenticated": false
}

# Logged-in user (with token)
curl -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  https://backend.digis.cc/api/public/profile/miriam

# Expected: 200 OK with enhanced capabilities
{
  "profile": { ... },
  "capabilities": {
    "canFollow": true,
    "canMessage": true,
    "canTip": true
  },
  "relationship": {
    "isFollowing": false,
    "isSubscribed": false
  },
  "viewerAuthenticated": true
}
```

### Test Protected Action Endpoint

```bash
# No token → 401 JSON (not redirect)
curl -X POST https://backend.digis.cc/api/follows \
  -H "Content-Type: application/json" \
  -d '{"creatorUsername":"miriam"}'

# Expected: 401 Unauthorized
{
  "error": "Unauthorized",
  "message": "Authorization header is required"
}

# With token → 201 Created
curl -X POST https://backend.digis.cc/api/follows \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{"creatorUsername":"miriam"}'

# Expected: 201 Created
{
  "ok": true,
  "isFollowing": true,
  "message": "Successfully followed"
}
```

---

## 8. Deployment Checklist

- [ ] `optionalSupabaseAuth` middleware deployed
- [ ] `/api/public/profile/:username` endpoint live
- [ ] `/api/follows` returns 401 JSON (not HTML)
- [ ] CORS configured for frontend domain
- [ ] Reserved usernames list synchronized with frontend
- [ ] Username validation enforced on user creation
- [ ] Database indexes on `follows` table (follower_id, following_id)
- [ ] Rate limiting on follow/unfollow endpoints

---

## Summary

**Pattern:**
- Public endpoints use `optionalSupabaseAuth` (guest + logged-in)
- Action endpoints use `requireSupabaseAuth` (logged-in only)
- Never 302 redirect from API routes (always JSON)
- Return capabilities object to tell frontend what's allowed

**Benefits:**
- SEO-friendly public pages
- Viral link sharing works
- Logged-in users get enhanced UX
- Clean auth walls (no false positives)

---

**Last Updated:** 2025-10-14
**Status:** ✅ Production-Ready Pattern
