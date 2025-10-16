# Fan Public Profile - Test Plan

## Overview
This document outlines the comprehensive test plan for the Fan Public Profile feature (`/u/:username`).

## Testing Checklist

### 1. Privacy & Visibility Tests

#### Public Profiles
- [ ] Visit `/u/public_fan_username` while logged out → Profile renders with all sections visible
- [ ] Verify stats are shown (Tips Given, Comments Posted, Top Creator Supported, Member Since)
- [ ] Verify About Me section shows content if populated
- [ ] Verify SEO meta tags include `<meta name="robots" content="index,follow" />`
- [ ] Verify Open Graph tags are present for social sharing
- [ ] Share link on social media → Verify correct title, description, and image appear

#### Private Profiles
- [ ] Visit `/u/private_fan_username` while logged out → 403 error with "This Profile is Private" message
- [ ] Verify SEO meta tags include `<meta name="robots" content="noindex,nofollow" />`
- [ ] Visit while logged in but NOT following → 403 error
- [ ] Follow the user → Profile becomes visible
- [ ] Verify stats and About Me sections are hidden or limited for private profiles

#### Followers-Only Profiles
- [ ] Visit `/u/followers_only_fan` while logged out → 403 error
- [ ] Visit while logged in but NOT following → 403 error
- [ ] Follow the user → Profile becomes accessible
- [ ] Unfollow → Profile becomes inaccessible again

### 2. 404 & Error Handling

#### Not Found
- [ ] Visit `/u/nonexistent_username` → 404 error with "Profile Not Found" message
- [ ] Verify error page has branded styling (purple gradient background)
- [ ] Click "Go to Home" button → Redirects to homepage

#### Network Errors
- [ ] Simulate network failure → Graceful error message appears
- [ ] Verify loading state shows spinner with "Loading profile..." message
- [ ] Verify loading spinner uses theme-consistent colors (purple gradient)

### 3. Route Conflicts

#### Creator vs Fan Routes
- [ ] If `@johndoe` is a creator: Visit `/creator/johndoe` → Creator profile
- [ ] If `@johndoe` is a fan: Visit `/u/johndoe` → Fan profile
- [ ] Verify `/u/*` route doesn't steal other routes
- [ ] Verify lazy loading works correctly with Suspense fallback

### 4. Edit → Save → View Workflow

#### Profile Update Flow
- [ ] Login as a fan user
- [ ] Navigate to Edit Profile page
- [ ] Update "About Me" field (1-1000 characters) → Saves successfully
- [ ] Update "Location" field (e.g., "Los Angeles, CA") → Saves successfully
- [ ] Refresh `/u/your_username` → Changes persist and display correctly
- [ ] Verify character counters work (About Me: 0/1000)
- [ ] Verify "Save" button is disabled when no changes made

#### Validation
- [ ] Enter 1001 characters in "About Me" → Error message appears
- [ ] Enter 201 characters in "Location" → Error message appears
- [ ] Leave required fields empty → Appropriate validation messages
- [ ] Try to save with invalid data → Backend returns 400 error with clear message

### 5. Input Validation & Sanitization

#### Large Inputs
- [ ] Enter exactly 1000 characters in About Me → Allowed and saves
- [ ] Enter exactly 200 characters in Location → Allowed and saves
- [ ] Enter 1001/201 characters → Blocked with friendly error message
- [ ] Verify backend validation matches frontend validation

#### Non-ASCII & Emoji
- [ ] Enter emojis in About Me (e.g., "I love 🎮 gaming!") → Renders correctly
- [ ] Enter non-ASCII characters (e.g., "Héllo wörld") → Renders correctly
- [ ] Verify no double-escaping or broken characters
- [ ] Verify HTML tags are stripped (e.g., `<script>alert('xss')</script>` becomes plain text)

#### XSS Protection
- [ ] Enter `<script>alert('xss')</script>` in About Me → Stripped on save
- [ ] Enter `<img src=x onerror=alert('xss')>` → Stripped on save
- [ ] Verify output uses plain text rendering (no `dangerouslySetInnerHTML`)

### 6. Mobile Responsiveness

#### Layout Tests
- [ ] View profile on iPhone (375px width) → Layout adapts properly
- [ ] View profile on iPad (768px width) → Layout adapts properly
- [ ] View profile on desktop (1920px width) → Layout uses max-width container
- [ ] Verify stats grid switches from 2 columns (mobile) to 4 columns (desktop)
- [ ] Long bios wrap gracefully without overflow
- [ ] Profile cards don't overflow or break layout
- [ ] Skeleton/loading states look on-brand
- [ ] Safe area insets work correctly on notched devices

### 7. Stats Calculation

#### Backend Queries
- [ ] Verify Tips Given aggregates from both `gift_transactions` and `tip_transactions`
- [ ] Verify Comments Posted counts from `stream_chat` table
- [ ] Verify Top Creator Supported calculates correctly from combined tips + gifts
- [ ] Verify Member Since uses `created_at` timestamp
- [ ] Test with user who has 0 tips → Shows "0" instead of null/undefined
- [ ] Test with user who has never commented → Shows "0"
- [ ] Test with user who has tipped multiple creators → Shows correct top creator

### 8. Performance & Rate Limiting

#### Rate Limiting
- [ ] Make 31 requests to `/api/users/fan-profile/:username` within 1 minute → 30th request succeeds, 31st returns 429 error
- [ ] Verify rate limit headers are returned (X-RateLimit-Limit, X-RateLimit-Remaining)
- [ ] Wait 1 minute → Rate limit resets

#### Database Performance
- [ ] Check query execution time for fan profile endpoint → Should be < 200ms
- [ ] Verify indexes exist on:
  - `users(username)` (case-insensitive)
  - `users(is_creator)`
  - `follows(follower_id, followed_id)`
  - `gift_transactions(sender_id, recipient_id)`
  - `tip_transactions(sender_id, recipient_id)`
- [ ] Run EXPLAIN ANALYZE on stats query → Verify uses indexes

### 9. SEO & Social Sharing

#### Meta Tags (Public Profiles)
- [ ] View page source → Verify `<title>@username - Digis Fan Profile</title>`
- [ ] Verify meta description uses bio or fallback text
- [ ] Verify Open Graph tags: `og:title`, `og:description`, `og:image`, `og:url`
- [ ] Verify Twitter Card tags: `twitter:card`, `twitter:title`, `twitter:image`
- [ ] Paste URL in Facebook/Twitter → Verify preview card appears correctly

#### Meta Tags (Private Profiles)
- [ ] View page source for private profile → Verify `<meta name="robots" content="noindex,nofollow" />`
- [ ] Verify Open Graph tags are NOT included for private profiles
- [ ] Verify search engines don't index private profiles

### 10. Follow/Unfollow Functionality

#### Follow Button
- [ ] Click "Follow" button while logged out → Toast error: "Please sign in to follow this user"
- [ ] Login and click "Follow" → Button changes to "Following" with solid heart icon
- [ ] Click "Following" button → Unfollows user, button reverts to "Follow"
- [ ] Verify follow state persists on page reload
- [ ] Verify own profile doesn't show follow button

### 11. Database Migration

#### Migration Script
- [ ] Run `migrations/008_fan_profile_fields.sql` on dev database → Completes without errors
- [ ] Verify columns added: `about_me`, `location`, `fan_rank`, `badges`, `profile_visibility`
- [ ] Verify default `profile_visibility = 'private'` for existing users
- [ ] Verify constraints added: `about_me` ≤ 1000 chars, `location` ≤ 200 chars
- [ ] Verify indexes created successfully
- [ ] Run migration on production database (dry run first!)

### 12. Edge Cases

#### Empty States
- [ ] View profile with no About Me → Shows "No about me section yet"
- [ ] View profile with no location → Location field hidden
- [ ] View profile with no interests → Interests section hidden
- [ ] View profile with no badges → Badges section hidden
- [ ] View profile with no fan rank → Fan rank card hidden

#### Special Characters
- [ ] Username with underscores (e.g., `john_doe`) → Works correctly
- [ ] Display name with spaces (e.g., "John Doe Jr.") → Renders correctly
- [ ] Location with commas (e.g., "Los Angeles, CA, USA") → Renders correctly

#### Concurrent Updates
- [ ] Open Edit Profile in two tabs → Update in tab 1 → Refresh tab 2 → Shows latest changes
- [ ] Multiple users view same profile → All see consistent data

### 13. Security Tests

#### Authentication
- [ ] Access private profile without auth token → 403 error
- [ ] Access private profile with invalid auth token → 403 error
- [ ] Access private profile with valid auth token but not following → 403 error

#### SQL Injection
- [ ] Try SQL injection in username parameter: `/u/admin'--` → Safely escaped
- [ ] Try SQL injection in About Me field → Safely escaped

#### CSRF Protection
- [ ] Verify CSRF tokens are used for state-changing operations (follow/unfollow)

### 14. Accessibility

#### Screen Readers
- [ ] Use screen reader → Verify proper heading hierarchy (h1, h2, h3)
- [ ] Verify alt text exists for profile images
- [ ] Verify ARIA labels on interactive elements

#### Keyboard Navigation
- [ ] Tab through page → All interactive elements focusable
- [ ] Press Enter on Follow button → Triggers follow action
- [ ] Verify focus indicators are visible

### 15. Browser Compatibility

- [ ] Test on Chrome (latest) → Works correctly
- [ ] Test on Firefox (latest) → Works correctly
- [ ] Test on Safari (latest) → Works correctly
- [ ] Test on Edge (latest) → Works correctly
- [ ] Test on mobile Safari → Works correctly
- [ ] Test on mobile Chrome → Works correctly

## Regression Tests

After deployment, verify:
- [ ] Existing creator profiles (`/creator/:username`) still work
- [ ] User authentication still works
- [ ] Token transactions still work
- [ ] Follow/unfollow on other pages still works
- [ ] No console errors on any page

## Performance Benchmarks

Target metrics:
- **Time to First Byte (TTFB)**: < 200ms
- **First Contentful Paint (FCP)**: < 1.5s
- **Largest Contentful Paint (LCP)**: < 2.5s
- **Cumulative Layout Shift (CLS)**: < 0.1
- **First Input Delay (FID)**: < 100ms

## Sign-Off

- [ ] All high-priority tests pass
- [ ] All security tests pass
- [ ] Performance benchmarks met
- [ ] No critical bugs found
- [ ] Documentation updated
- [ ] Ready for production deployment

---

**Last Updated**: 2025-10-16
**Feature**: Fan Public Profiles (`/u/:username`)
**Version**: 1.0.0
