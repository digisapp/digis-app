# Email Integration Guide

## Overview
The Digis platform uses Postmark for email delivery with a focus on essential communications only, avoiding spammy transaction emails. All emails include the Digis logo for brand consistency.

## Emails Currently Sent

### 1. Welcome Emails (Automated)
- **Creator Welcome Email**: Sent when a new creator signs up
  - Subject: "Welcome to Digis, Creator — let's get you earning"
  - Contains: Next steps, dashboard link, creator guide

- **Fan Welcome Email**: Sent when a new fan signs up
  - Subject: "Welcome to Digis — start discovering creators"
  - Contains: Getting started guide, dashboard link, help center

### 2. Creator Approval Email (Automated)
- Sent when admin approves a creator application
- Subject: "Congratulations! You're Now a Digis Creator 🌟"
- Contains: Next steps, dashboard link, creator guide

### 3. Password Reset Email (On-demand)
- Sent when user requests password reset
- Subject: "Reset Your Digis Password"
- Contains: Reset link valid for 1 hour

### 4. Session Reminder Email (Future - Not Yet Implemented)
- Will be sent before scheduled sessions
- Subject: "Reminder: Upcoming Session with [Creator Name]"

## Emails NOT Being Sent (Per User Request)

❌ **Transaction Emails** - Too spammy, not implemented:
- Token purchase confirmations
- Token spending notifications
- Tip confirmations
- Session payment receipts

## Integration Points

### Authentication Flow (`/backend/routes/auth.js`)
```javascript
// Welcome emails sent on user creation
if (accountType === 'creator') {
  sendCreatorWelcomeEmail(email, username);
} else {
  sendFanWelcomeEmail(email, username);
}
```

### Admin Flow (`/backend/routes/admin.js`)
```javascript
// Creator approval email
sendCreatorApprovalEmail(email, creatorName);
```

## Testing Emails

To test the email service:
```bash
cd backend
node testEmail.js
```

## Configuration

Environment variables in `.env`:
```
POSTMARK_API_KEY=your-api-key
POSTMARK_FROM_EMAIL=team@digis.cc
EMAIL_ENABLED=true
```

## Important Notes

1. **Non-blocking**: All emails are sent asynchronously to not block user actions
2. **Error Handling**: Email failures are logged but don't fail the main operation
3. **Anti-spam**: Only essential emails are sent, no transaction notifications
4. **Testing**: Use `testEmail.js` to verify email functionality
5. **Branding**: All emails include the Digis logo (`digis-logo-black.png`) hosted at https://digis.cc/
6. **Logo Requirements**: Ensure the logo files are accessible at your domain for proper display in emails

## Future Enhancements

- [ ] Password reset flow integration
- [ ] Session reminder scheduling
- [ ] Weekly creator earnings summary (opt-in)
- [ ] Important platform announcements (opt-in)