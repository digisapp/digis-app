# Stripe Connect Testing Checklist

## Prerequisites
- [ ] Stripe account set up with Connect enabled
- [ ] Test mode API keys configured in `.env`
- [ ] Backend running with Stripe webhook endpoint configured

## 1. Creator Onboarding Flow

### Initial Setup
- [ ] Navigate to Wallet page as a creator account
- [ ] Verify "Complete Your Banking Setup" alert appears if not onboarded
- [ ] Click "Complete Setup" button
- [ ] Verify redirect to Stripe Connect onboarding

### Stripe Connect Onboarding
- [ ] Fill in business type (Individual/Company)
- [ ] Enter personal/business information
- [ ] Add bank account details (use Stripe test accounts)
- [ ] Complete identity verification (test mode auto-approves)
- [ ] Submit onboarding form

### Return to Platform
- [ ] Verify redirect back to platform after completion
- [ ] Check that banking status shows as "Active"
- [ ] Confirm payout settings are enabled

## 2. Earnings & Payout Flow

### Earning Tokens
- [ ] Receive tips from fans
- [ ] Complete video/voice calls
- [ ] Sell content or products
- [ ] Verify token balance updates correctly

### Payout Dashboard
- [ ] Navigate to Wallet > Payouts tab
- [ ] Verify pending balance shows correctly ($0.05 per token)
- [ ] Check lifetime earnings display
- [ ] Confirm next payout date shows (1st or 15th)

### Manual Payout Request
- [ ] Ensure minimum balance met ($50)
- [ ] Click "Request Payout" button
- [ ] Verify payout shows as "Processing"
- [ ] Check email for payout confirmation

### Automatic Payouts
- [ ] Verify bi-weekly schedule (1st & 15th)
- [ ] Check auto-withdrawal toggle works
- [ ] Test reserved balance settings
- [ ] Confirm withdrawable amount calculation

## 3. Payout History & Tracking

### History Tab
- [ ] View all past payouts
- [ ] Check status badges (Pending/Processing/Paid/Failed)
- [ ] Verify date ranges and amounts
- [ ] Test pagination if many payouts

### Earnings Tab
- [ ] View recent earnings breakdown
- [ ] Check earning types (tips, calls, content, etc.)
- [ ] Verify fan information displayed
- [ ] Confirm USD conversion accurate

## 4. Error Handling

### Banking Not Set Up
- [ ] Attempt payout without banking setup
- [ ] Verify appropriate error message
- [ ] Check redirect to onboarding

### Insufficient Balance
- [ ] Try payout below minimum ($50)
- [ ] Verify error message displayed
- [ ] Check balance requirements shown

### Failed Payouts
- [ ] Test with invalid bank account (Stripe test mode)
- [ ] Verify failed status displayed
- [ ] Check retry mechanism available

## 5. Security & Compliance

### Data Protection
- [ ] Verify no sensitive bank details displayed in full
- [ ] Check HTTPS on all payment pages
- [ ] Confirm PCI compliance maintained

### Platform Fees
- [ ] Verify platform fee calculation (configured rate)
- [ ] Check fee transparency in payout details
- [ ] Confirm net amount calculations correct

## Test Data for Stripe Connect

### Test Bank Accounts (US)
- Routing: 110000000
- Account: 000123456789 (Success)
- Account: 000111111113 (Payout Failure)

### Test Verification
- SSN: 000-00-0000 (Test mode accepts)
- EIN: 00-0000000 (For companies)

### Test Cards for Purchases
- 4242 4242 4242 4242 - Success
- 4000 0000 0000 9995 - Insufficient funds
- 4000 0000 0000 0002 - Card declined

## Monitoring & Logs

### Backend Logs
- [ ] Check Stripe webhook events received
- [ ] Verify payout processing logs
- [ ] Monitor error logs for failures

### Stripe Dashboard
- [ ] View Connect accounts in Stripe Dashboard
- [ ] Check payout reports
- [ ] Monitor platform earnings

## Notes
- Always test in Stripe TEST mode first
- Use Stripe CLI for local webhook testing
- Document any issues found with screenshots
- Test on both desktop and mobile devices