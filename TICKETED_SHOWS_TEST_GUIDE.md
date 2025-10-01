# Ticketed Private Shows - Testing Guide

## Prerequisites

1. **Two Test Accounts Required:**
   - Creator account with streaming capabilities
   - Viewer/Fan account with tokens in wallet

2. **Environment Setup:**
   - Backend server running (`npm run dev` in backend/)
   - Frontend running (`npm start` in frontend/)
   - Database migrations completed
   - Socket connections active

## Test Flow 1: Creator Announces Show

### Step 1: Creator Goes Live
1. Log in as creator
2. Navigate to streaming dashboard
3. Start a public live stream
4. Verify stream is active and viewers can join

### Step 2: Announce Private Show
1. Look for "Announce Private Show" button below co-host controls
2. Click to open setup modal
3. Fill in details:
   - Title: "Exclusive Q&A Session"
   - Description: "Ask me anything in this private session!"
   - Token Price: 500
   - Start Time: In 5 minutes (optional)
   - Early Bird Price: 400 (optional)
4. Click "Announce Show"

**Expected Results:**
- Toast notification: "Private show announced! 🎉"
- Show details appear in creator dashboard
- Analytics display showing 0 tickets sold
- Socket event sent to all viewers

### Step 3: Monitor Ticket Sales
1. Watch the ticket counter in real-time
2. Check tokens earned display
3. If countdown was set, verify timer is working

**Expected Results:**
- Live updates as viewers buy tickets
- Token revenue accumulates
- Countdown timer decreases

## Test Flow 2: Viewer Experience

### Step 1: See Announcement
1. Log in as viewer
2. Join creator's live stream
3. Verify you can see video and chat

**Expected Results:**
- Private show announcement appears
- Shows title, description, price
- "Buy Ticket" button is visible
- Ticket count shows other purchases

### Step 2: Purchase Ticket
1. Check wallet balance before purchase
2. Click "Buy Ticket" button
3. Confirm purchase

**Expected Results:**
- Tokens deducted from wallet
- Toast: "Ticket purchased! Enjoy the show! 🎫"
- UI updates to show "You have a ticket!"
- Creator sees ticket sale in real-time

### Step 3: Early Bird Testing (Optional)
1. If early bird pricing is set, verify:
   - Lower price shows with "Early Bird Price!" label
   - Shows savings amount
   - Price increases after deadline

## Test Flow 3: Private Mode Activation

### Step 1: Creator Starts Private Show
1. As creator, click "Start Private Show" button
2. Confirm the action

**Expected Results:**
- Toast: "Private show started! X viewers have access"
- Status changes from "Announced" to "Live"
- Socket events sent to all connected users

### Step 2: Viewer WITH Ticket
1. Verify full video access continues
2. Chat remains available
3. See "Private show is live" indicator

**Expected Results:**
- No interruption in video stream
- Can continue interacting normally
- Special badge or indicator shows ticket holder status

### Step 3: Viewer WITHOUT Ticket
1. Join stream without purchasing ticket
2. When private mode starts:

**Expected Results:**
- Video becomes hidden/blocked
- Lock screen appears with message
- "Buy Ticket & Join Now" button visible
- Chat remains visible and functional
- Can still send messages but can't see video

## Test Flow 4: Mid-Show Purchase

### Step 1: Buy Ticket During Show
1. As non-ticket holder during private show
2. Click "Buy Ticket & Join Now"
3. Complete purchase

**Expected Results:**
- Immediate video access granted
- Socket event enables video
- Toast: "Private show access granted!"
- Can now see the private content

## Test Flow 5: Show Ending

### Step 1: Creator Ends Show
1. Creator clicks "End Private Show" (if implemented)
2. Or stream ends naturally

**Expected Results:**
- All viewers regain normal access
- Analytics saved to database
- Show marked as "ended" in database

## Test Flow 6: Edge Cases

### Test 6.1: Insufficient Tokens
1. Attempt to buy ticket with insufficient balance

**Expected:**
- Error: "Not enough tokens! Please purchase more tokens."
- Redirect option to token purchase

### Test 6.2: Max Tickets Reached
1. Set max tickets to small number (e.g., 2)
2. Have multiple users try to purchase

**Expected:**
- After limit reached, purchase button disabled
- Shows "Sold Out" message

### Test 6.3: Network Issues
1. Disconnect/reconnect during show
2. Refresh page during private mode

**Expected:**
- State persists correctly
- Ticket status maintained
- Video access restored appropriately

## Test Flow 7: Analytics Verification

### Creator Analytics Should Show:
- Total tickets sold
- Total revenue in tokens
- Peak concurrent viewers
- Average watch time
- Early bird vs regular sales

## Socket Events to Monitor

Use browser DevTools to verify these events:

### Emitted Events:
- `ticketed_show_announced`
- `private_mode_started`
- `ticket_purchased`
- `enable_private_video`
- `private_show_ended`

### Rooms:
- `stream:{streamId}` - For all stream participants
- `user:{userId}` - For individual notifications

## Database Verification

Check these tables after testing:

```sql
-- Check active shows
SELECT * FROM ticketed_shows WHERE stream_id = 'YOUR_STREAM_ID';

-- Check ticket purchases
SELECT * FROM show_tickets WHERE show_id = 'YOUR_SHOW_ID';

-- Check analytics
SELECT * FROM show_analytics WHERE show_id = 'YOUR_SHOW_ID';

-- Verify token transactions
SELECT * FROM tokens 
WHERE transaction_type IN ('show_ticket_purchase', 'show_ticket_revenue')
ORDER BY created_at DESC;
```

## Common Issues & Solutions

### Issue: "Cannot read property 'id' of undefined"
**Solution:** Ensure streamId is passed correctly to PrivateShowAnnouncement component

### Issue: Video not hiding for non-ticket holders
**Solution:** 
1. Check socket connection is established
2. Verify `hasAccess` prop is passed to VideoCall
3. Check Agora role is set correctly

### Issue: Tokens not deducting
**Solution:**
1. Verify user has sufficient balance
2. Check database transaction is atomic
3. Ensure both deduction and credit happen

### Issue: Real-time updates not working
**Solution:**
1. Check WebSocket connection
2. Verify socket rooms are joined correctly
3. Check backend is emitting events

## Performance Testing

### Load Test:
1. Have 10+ viewers join stream
2. Multiple simultaneous ticket purchases
3. Monitor:
   - Response times
   - Socket message delivery
   - Database transaction speed

### Stress Points:
- Concurrent ticket purchases
- Large number of viewers
- Rapid show start/stop cycles
- Network interruptions

## Success Criteria

✅ Creator can announce show with all options
✅ Viewers see announcement in real-time
✅ Ticket purchase deducts tokens correctly
✅ Private mode hides video for non-payers
✅ Chat remains visible to all
✅ Mid-show purchases grant immediate access
✅ Analytics track all metrics accurately
✅ Socket events deliver reliably
✅ Database maintains consistency
✅ UI updates reflect state changes

## Test Report Template

```
Date: ___________
Tester: ___________
Environment: Development / Staging / Production

Feature Areas Tested:
[ ] Show Announcement
[ ] Ticket Purchase
[ ] Private Mode Activation
[ ] Video Access Control
[ ] Mid-Show Purchase
[ ] Analytics
[ ] Socket Events
[ ] Error Handling

Issues Found:
1. _____________________
2. _____________________

Overall Status: PASS / FAIL
Notes: _____________________
```

## Automated Testing Commands

```bash
# Run backend tests
cd backend
npm test -- ticketed-shows.test.js

# Run frontend component tests
cd frontend
npm test -- PrivateShowAnnouncement.test.js

# Database integrity check
cd backend
npm run db:test
```

This comprehensive testing guide ensures all aspects of the ticketed shows feature work correctly and provide a smooth experience for both creators and viewers.