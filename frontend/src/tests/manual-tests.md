# Manual Testing Checklist for Digis App

## 🔐 Authentication Tests
- [ ] **Sign Up with valid email/password**
  - Enter valid credentials
  - Check "I'm a Creator" option
  - Verify account creation and profile saving
- [ ] **Sign Up with invalid data**
  - Test short password (< 6 chars)
  - Test invalid email format
  - Test duplicate email
- [ ] **Sign In with valid credentials**
  - Use existing account
  - Verify successful login
- [ ] **Sign In with invalid credentials**
  - Test wrong password
  - Test non-existent email
- [ ] **Google Sign In**
  - Click Google button
  - Complete OAuth flow
  - Verify account creation/login

## 👤 Profile Management Tests
- [ ] **Create Creator Profile**
  - Fill in bio (test character limit)
  - Add profile picture URL
  - Set price per minute
  - Save and verify
- [ ] **Create User Profile**
  - Fill in bio
  - Add profile picture URL
  - Save and verify
- [ ] **Profile Validation**
  - Test empty bio
  - Test invalid URL
  - Test invalid price (negative, zero)
  - Test bio over 500 characters
- [ ] **Profile Updates**
  - Update existing profile
  - Switch between creator/user
  - Verify changes persist

## 💳 Payment System Tests
- [ ] **Valid Payment**
  - Enter valid card details
  - Process payment
  - Verify success message
  - Check payment in database
- [ ] **Invalid Payment**
  - Test declined card
  - Test expired card
  - Test invalid CVV
  - Test insufficient funds
- [ ] **Payment UI**
  - Verify Stripe elements load
  - Test form validation
  - Test loading states
  - Test success/error messages

## 📹 Video Call Tests
- [ ] **Creator Video Call**
  - Start video call as creator
  - Verify local video appears
  - Test audio/video toggle
  - Test connection status
- [ ] **User Join Video Call**
  - Join as user (after payment)
  - Verify remote video appears
  - Test connection quality
  - Test leaving call
- [ ] **Voice Only Call**
  - Start voice-only session
  - Verify no video elements
  - Test audio quality
- [ ] **Live Streaming**
  - Start streaming as creator
  - Verify streaming mode
  - Test audience join
  - Test stream quality

## 💬 Chat System Tests
- [ ] **Chat Connection**
  - Verify chat connects
  - Check connection status
  - Test reconnection
- [ ] **Send Messages**
  - Send text messages
  - Verify message delivery
  - Test message history
- [ ] **Chat UI**
  - Test peer ID input
  - Test message input
  - Test chat logs
  - Test error handling

## 🎯 User Flow Tests
- [ ] **Complete Creator Flow**
  1. Sign up as creator
  2. Set up profile with pricing
  3. Start video call
  4. Receive payment
  5. Conduct session
- [ ] **Complete User Flow**
  1. Sign up as user
  2. Browse creators
  3. Make payment
  4. Join video call
  5. Chat with creator
- [ ] **Error Handling**
  - Test network disconnection
  - Test server errors
  - Test invalid tokens
  - Test expired sessions

## 🔄 State Management Tests
- [ ] **Navigation**
  - Switch between main/profile views
  - Verify state persistence
  - Test logout/login state
- [ ] **Loading States**
  - Verify loading indicators
  - Test async operations
  - Check error states
- [ ] **Data Persistence**
  - Refresh page during session
  - Verify data reloads
  - Test authentication persistence

## 📱 Responsive Design Tests
- [ ] **Mobile View**
  - Test on mobile devices
  - Verify responsive layout
  - Test touch interactions
- [ ] **Tablet View**
  - Test on tablets
  - Verify UI scaling
  - Test orientation changes
- [ ] **Desktop View**
  - Test on various screen sizes
  - Verify full functionality
  - Test keyboard navigation

## 🛠️ Technical Tests
- [ ] **Console Errors**
  - Check browser console
  - Fix any errors/warnings
  - Verify clean logs
- [ ] **Network Requests**
  - Monitor API calls
  - Check response times
  - Verify error handling
- [ ] **Performance**
  - Test app loading speed
  - Check memory usage
  - Test with slow network

## 🎨 UI/UX Tests
- [ ] **Visual Design**
  - Check consistent styling
  - Verify color scheme
  - Test typography
- [ ] **User Experience**
  - Test intuitive navigation
  - Verify clear messaging
  - Test accessibility
- [ ] **Feedback**
  - Test success messages
  - Test error messages
  - Test loading states

## Test Results Template