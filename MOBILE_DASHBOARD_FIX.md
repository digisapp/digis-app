# Mobile Creator Dashboard Fix - Role-Flicker Issue

## Problem

On mobile, the Creator Dashboard was showing fan-only content:
1. "Explore Creators" search bar at the top
2. "Featured Creators" section at the bottom
3. "Recently Viewed Creators" section at the bottom

This happened due to **role-flicker**: during profile load, `isCreator` was temporarily `undefined/false`, causing the fan dashboard to briefly render even for creators.

---

## Solution

### 1. Updated DashboardRouter to Wait for Role Resolution
**File**: `/frontend/src/components/pages/DashboardRouter.js`

Added loading state until `roleResolved === true`:
```javascript
if (!roleResolved) {
  return <LoadingSpinner message="Loading dashboard..." />;
}
```

### 2. Removed RecentlyViewedCreators on Mobile
**File**: `/frontend/src/App.js` (line 1365)

```javascript
// OLD: {roleResolved && !isCreator && (
// NEW: {roleResolved && !isCreator && !isMobile && (
```

### 3. Passed roleResolved to All DashboardRouter Instances
Updated 3 places in App.js where DashboardRouter is rendered.

---

## Files Changed

1. `/frontend/src/components/pages/DashboardRouter.js` - Added roleResolved prop and loading state
2. `/frontend/src/App.js` - Added roleResolved prop to DashboardRouter calls, added !isMobile check

---

## Result

Mobile creators now see ONLY MobileCreatorDashboard with no fan content during or after login.
