const postmark = require('postmark');
const { rateLimiter } = require('../utils/redis');

// Initialize Postmark client with your Server API Token
const client = new postmark.ServerClient('61043964-bcce-4c53-8479-f97a8a3f0843');

// Main email sending function with rate limiting
async function sendEmail(to, subject, htmlBody, textBody = null) {
  try {
    // Check rate limit: max 5 emails per minute per email address
    const rateKey = `email:${to}`;
    const limit = await rateLimiter.check(rateKey, 5, 60);

    if (!limit.allowed) {
      console.warn(`⚠️ Email rate limit exceeded for ${to}. Remaining: ${limit.remaining}`);
      throw new Error(`Rate limit exceeded. Please try again in ${limit.reset} seconds.`);
    }

    const response = await client.sendEmail({
      From: 'team@digis.cc', // Your verified Sender Signature
      To: to,
      Subject: subject,
      HtmlBody: htmlBody,
      TextBody: textBody || htmlBody.replace(/<[^>]*>/g, ''), // Strip HTML for text version
      MessageStream: 'outbound', // Default stream for transactional emails
    });
    console.log(`✅ Email sent successfully: ${response.MessageID} (${limit.remaining} emails remaining)`);
    return response;
  } catch (error) {
    console.error('❌ Error sending email:', error.message);
    throw error;
  }
}

// Creator welcome email
async function sendCreatorWelcomeEmail(userEmail, userName = 'Creator') {
  const subject = "Welcome to Digis, Creator — let's get you earning";
  const htmlBody = `
    <!doctype html>
    <html lang="en">
      <body style="margin:0;background:#f6f7f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
        <!-- Preheader -->
        <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Welcome to Digis — connect payouts, set pricing, go live.</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 0;">
          <tr><td align="center">
            <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;padding:32px;">
              <!-- Logo Header -->
              <tr><td align="center" style="padding-bottom:24px;">
                <div style="font-size:32px;font-weight:bold;color:#111827;letter-spacing:-2px;">digis</div>
              </td></tr>
              <tr><td style="font-size:16px;line-height:24px;">
                <p style="margin:0 0 16px 0;font-size:18px;">Hi ${userName} 👋</p>
                <p style="margin:0 0 16px 0;">
                  Welcome to <strong>Digis</strong>! You're minutes away from connecting with fans through
                  live streams, video calls, and exclusive content.
                </p>

                <p style="margin:24px 0 8px 0;font-weight:bold;">Do this next</p>
                <ol style="margin:0 0 24px 18px;padding:0;">
                  <li>Complete your creator profile & bio</li>
                  <li>Connect payouts with Stripe</li>
                  <li>Set your pricing & availability</li>
                  <li>Start your first stream or enable video calls</li>
                </ol>

                <p style="margin:0 0 24px 0;">
                  <a href="https://digis.cc/creator-dashboard" style="display:inline-block;background:#111827;color:#fff;
                     text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:600;">
                    Open Creator Dashboard
                  </a>
                </p>

                <p style="margin:0 0 8px 0;">Questions? Reply to this email or read the quick guide.</p>
                <p style="margin:0;">
                  <a href="https://digis.cc/creator-guide" style="color:#0f172a;">Creator Getting-Started Guide</a>
                </p>

                <p style="margin:24px 0 0 0;">— Team Digis</p>
              </td></tr>
            </table>
            <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="color:#64748b;font-size:12px;margin-top:12px;">
              <tr><td align="center" style="padding:8px 0;">
                You're receiving this because you signed up as a Creator on Digis.
                If this wasn't you, <a href="https://digis.cc/support" style="color:#64748b;">contact support</a>.
              </td></tr>
            </table>
          </td></tr>
        </table>
      </body>
    </html>
  `;

  const textBody = `Hi ${userName} 👋

Welcome to Digis! You're minutes away from connecting with fans through live streams, video calls, and exclusive drops.

Next steps:
1. Complete your creator profile & bio
2. Connect payouts with Stripe
3. Set your pricing & availability
4. Start your first stream or enable video calls

👉 Creator Dashboard: https://digis.cc/creator-dashboard

Need help? Reply to this email or visit https://digis.cc/creator-guide

— Team Digis`;

  return sendEmail(userEmail, subject, htmlBody, textBody);
}

// Fan welcome email
async function sendFanWelcomeEmail(userEmail, userName = 'there') {
  const subject = 'Welcome to Digis — start discovering creators';
  const htmlBody = `
    <!doctype html>
    <html lang="en">
      <body style="margin:0;background:#f6f7f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
        <!-- Preheader -->
        <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Welcome to Digis — discover creators, follow, and join live streams.</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 0;">
          <tr><td align="center">
            <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;padding:32px;">
              <!-- Logo Header -->
              <tr><td align="center" style="padding-bottom:24px;">
                <div style="font-size:32px;font-weight:bold;color:#111827;letter-spacing:-2px;">digis</div>
              </td></tr>
              <tr><td style="font-size:16px;line-height:24px;">
                <p style="margin:0 0 16px 0;font-size:18px;">Hi ${userName} 👋</p>
                <p style="margin:0 0 16px 0;">
                  Welcome to <strong>Digis</strong>—your place to discover creators, join live streams,
                  and book video calls.
                </p>

                <p style="margin:24px 0 8px 0;font-weight:bold;">Get started</p>
                <ol style="margin:0 0 24px 18px;padding:0;">
                  <li>Finish your profile & set interests</li>
                  <li>Follow creators you love</li>
                  <li>Add tokens to unlock premium features</li>
                  <li>Enable notifications so you never miss a live</li>
                </ol>

                <p style="margin:0 0 24px 0;">
                  <a href="https://digis.cc/dashboard" style="display:inline-block;background:#111827;color:#fff;
                     text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:600;">
                    Go to Dashboard
                  </a>
                </p>

                <p style="margin:0 0 8px 0;">Have questions? Just reply and we'll help.</p>
                <p style="margin:0;">
                  <a href="https://digis.cc/help" style="color:#0f172a;">Help Center</a>
                </p>

                <p style="margin:24px 0 0 0;">— Team Digis</p>
              </td></tr>
            </table>
            <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="color:#64748b;font-size:12px;margin-top:12px;">
              <tr><td align="center" style="padding:8px 0;">
                You're receiving this because you created a Digis account.
                If this wasn't you, <a href="https://digis.cc/support" style="color:#64748b;">contact support</a>.
              </td></tr>
            </table>
          </td></tr>
        </table>
      </body>
    </html>
  `;

  const textBody = `Hi ${userName} 👋

Welcome to Digis—your place to discover creators, join live streams, and book video calls.

Get started:
1. Finish your profile & set interests
2. Follow creators you love
3. Add tokens to unlock premium features
4. Enable notifications so you never miss a live

👉 Go to your dashboard: https://digis.cc/dashboard

Need help? Reply to this email or visit https://digis.cc/help

— Team Digis`;

  return sendEmail(userEmail, subject, htmlBody, textBody);
}

// Legacy welcome email (kept for backward compatibility)
async function sendWelcomeEmail(userEmail, userName = 'there', isCreator = false) {
  if (isCreator) {
    return sendCreatorWelcomeEmail(userEmail, userName);
  }
  return sendFanWelcomeEmail(userEmail, userName);
}

// Password reset email
async function sendPasswordResetEmail(userEmail, resetToken) {
  const resetUrl = `https://digis.cc/reset-password?token=${resetToken}`;
  const subject = 'Reset Your Digis Password';
  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .logo { text-align: center; padding: 20px 0; }
        .header { background: #f44336; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .button { display: inline-block; padding: 12px 30px; background: #f44336; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo">
          <div style="font-size:32px;font-weight:bold;color:#111827;letter-spacing:-2px;">digis</div>
        </div>
        <div class="header">
          <h1>Password Reset Request</h1>
        </div>
        <div class="content">
          <p>We received a request to reset your password for your Digis account.</p>
          <p>Click the button below to reset your password. This link will expire in 1 hour.</p>
          <center>
            <a href="${resetUrl}" class="button">Reset Password</a>
          </center>
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #667eea;">${resetUrl}</p>
          <p><strong>If you didn't request this, please ignore this email.</strong></p>
          <p>Best regards,<br>The Digis Team</p>
        </div>
        <div class="footer">
          <p>© 2024 Digis. All rights reserved.</p>
          <p>This is a security-related email for your account at digis.cc</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(userEmail, subject, htmlBody);
}

// Payment confirmation email
async function sendPaymentConfirmationEmail(userEmail, amount, tokens) {
  const subject = 'Payment Confirmed - Tokens Added! 💰';
  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .logo { text-align: center; padding: 20px 0; }
        .header { background: #4caf50; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .receipt { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; }
        .button { display: inline-block; padding: 12px 30px; background: #4caf50; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo">
          <div style="font-size:32px;font-weight:bold;color:#111827;letter-spacing:-2px;">digis</div>
        </div>
        <div class="header">
          <h1>Payment Successful!</h1>
        </div>
        <div class="content">
          <p>Thank you for your purchase!</p>
          <div class="receipt">
            <h3>Receipt Details:</h3>
            <p><strong>Amount Paid:</strong> $${(amount / 100).toFixed(2)}</p>
            <p><strong>Tokens Received:</strong> ${tokens}</p>
            <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
          </div>
          <p>Your tokens have been added to your account and are ready to use!</p>
          <center>
            <a href="https://digis.cc/wallet" class="button">View Wallet</a>
          </center>
          <p>Thank you for supporting creators on Digis!</p>
          <p>Best regards,<br>The Digis Team</p>
        </div>
        <div class="footer">
          <p>© 2024 Digis. All rights reserved.</p>
          <p>This receipt is for your records</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(userEmail, subject, htmlBody);
}

// Creator approval email
async function sendCreatorApprovalEmail(userEmail, creatorName) {
  const subject = 'Congratulations! You\'re Now a Digis Creator 🌟';
  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .logo { text-align: center; padding: 20px 0; }
        .header { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .button { display: inline-block; padding: 12px 30px; background: #f5576c; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo">
          <div style="font-size:32px;font-weight:bold;color:#111827;letter-spacing:-2px;">digis</div>
        </div>
        <div class="header">
          <h1>Welcome to the Creator Community!</h1>
        </div>
        <div class="content">
          <h2>Congratulations, ${creatorName}! 🎉</h2>
          <p>Your creator application has been approved! You can now start earning on Digis.</p>
          <h3>Next Steps:</h3>
          <ul>
            <li>Set up your creator profile and rates</li>
            <li>Upload profile pictures and intro video</li>
            <li>Configure your availability schedule</li>
            <li>Start accepting calls and streaming</li>
          </ul>
          <center>
            <a href="https://digis.cc/creator-dashboard" class="button">Go to Creator Dashboard</a>
          </center>
          <p>Need help getting started? Check out our <a href="https://digis.cc/creator-guide">Creator Guide</a>.</p>
          <p>Welcome aboard!<br>The Digis Team</p>
        </div>
        <div class="footer">
          <p>© 2024 Digis. All rights reserved.</p>
          <p>You're receiving this because your creator application was approved</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(userEmail, subject, htmlBody);
}

// Session reminder email
async function sendSessionReminderEmail(userEmail, creatorName, sessionTime) {
  const subject = `Reminder: Upcoming Session with ${creatorName}`;
  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .logo { text-align: center; padding: 20px 0; }
        .header { background: #2196f3; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .button { display: inline-block; padding: 12px 30px; background: #2196f3; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo">
          <div style="font-size:32px;font-weight:bold;color:#111827;letter-spacing:-2px;">digis</div>
        </div>
        <div class="header">
          <h1>Session Reminder</h1>
        </div>
        <div class="content">
          <p>This is a reminder about your upcoming session:</p>
          <div style="background: white; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Creator:</strong> ${creatorName}</p>
            <p><strong>Time:</strong> ${sessionTime}</p>
          </div>
          <p>Make sure you have enough tokens in your wallet for the session.</p>
          <center>
            <a href="https://digis.cc/sessions" class="button">View Session Details</a>
          </center>
          <p>See you there!<br>The Digis Team</p>
        </div>
        <div class="footer">
          <p>© 2024 Digis. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(userEmail, subject, htmlBody);
}

// Class enrollment confirmation email
async function sendClassEnrollmentConfirmationEmail(userEmail, userName, classDetails) {
  const { title, startTime, duration, creatorName, tokenPrice, description, category } = classDetails;
  const formattedDate = new Date(startTime).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  const formattedTime = new Date(startTime).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  const subject = `Class Confirmed: ${title} ✨`;
  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .logo { text-align: center; padding: 20px 0; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .class-details { background: white; padding: 25px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea; }
        .button { display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
        .info-row { margin: 10px 0; padding: 10px 0; border-bottom: 1px solid #eee; }
        .info-row:last-child { border-bottom: none; }
        .label { font-weight: bold; color: #555; display: inline-block; width: 120px; }
        .reminder-box { background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107; }
        .success-badge { background: #d4edda; color: #155724; padding: 5px 10px; border-radius: 20px; display: inline-block; margin-top: 10px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo">
          <div style="font-size:32px;font-weight:bold;color:#111827;letter-spacing:-2px;">digis</div>
        </div>
        <div class="header">
          <h1 style="margin: 0;">🎉 You're Enrolled!</h1>
          <p style="margin: 10px 0 0 0; font-size: 18px;">Class Registration Confirmed</p>
        </div>
        <div class="content">
          <p>Hi ${userName},</p>
          <p>Great news! You've successfully enrolled in the following class:</p>

          <div class="class-details">
            <h2 style="color: #333; margin-top: 0;">${title}</h2>
            <div class="info-row">
              <span class="label">Instructor:</span>
              <span>${creatorName}</span>
            </div>
            <div class="info-row">
              <span class="label">Date:</span>
              <span>${formattedDate}</span>
            </div>
            <div class="info-row">
              <span class="label">Time:</span>
              <span>${formattedTime}</span>
            </div>
            <div class="info-row">
              <span class="label">Duration:</span>
              <span>${duration} minutes</span>
            </div>
            <div class="info-row">
              <span class="label">Category:</span>
              <span>${category || 'General'}</span>
            </div>
            <div class="info-row">
              <span class="label">Tokens Paid:</span>
              <span>${tokenPrice} tokens</span>
            </div>
            ${description ? `
            <div class="info-row" style="border-bottom: none; margin-top: 15px;">
              <p style="margin: 0; color: #666;"><strong>About this class:</strong><br>${description}</p>
            </div>
            ` : ''}
            <span class="success-badge">✓ Payment Processed</span>
          </div>

          <div class="reminder-box">
            <strong>⏰ We'll send you a reminder</strong>
            <p style="margin: 5px 0 0 0; font-size: 14px;">You'll receive an email reminder 1 hour before the class starts.</p>
          </div>

          <h3>What's Next?</h3>
          <ul style="line-height: 2;">
            <li>Add this class to your calendar</li>
            <li>Make sure you have a stable internet connection</li>
            <li>Join 5 minutes early to test your audio/video</li>
            <li>Prepare any questions you'd like to ask</li>
          </ul>

          <center>
            <a href="https://digis.cc/classes" class="button">View My Classes</a>
          </center>

          <p style="margin-top: 30px;">If you need to cancel, please do so at least 2 hours before the class starts to receive a refund.</p>

          <p>See you in class!<br>
          <strong>The Digis Team</strong></p>
        </div>
        <div class="footer">
          <p>© 2024 Digis. All rights reserved.</p>
          <p>You're receiving this confirmation because you enrolled in a class on Digis.</p>
          <p><a href="https://digis.cc/support" style="color: #666;">Contact Support</a> | <a href="https://digis.cc/classes" style="color: #666;">Manage Classes</a></p>
        </div>
      </div>
    </body>
    </html>
  `;

  const textBody = `Hi ${userName},

Great news! You've successfully enrolled in the following class:

${title}

Class Details:
- Instructor: ${creatorName}
- Date: ${formattedDate}
- Time: ${formattedTime}
- Duration: ${duration} minutes
- Tokens Paid: ${tokenPrice} tokens
${description ? `\nAbout: ${description}` : ''}

What's Next:
• Add this class to your calendar
• Make sure you have a stable internet connection
• Join 5 minutes early to test your audio/video
• Prepare any questions you'd like to ask

We'll send you a reminder 1 hour before the class starts.

View your classes: https://digis.cc/classes

See you in class!
— The Digis Team`;

  return sendEmail(userEmail, subject, htmlBody, textBody);
}

// Export all functions
module.exports = {
  sendEmail,
  sendWelcomeEmail,
  sendCreatorWelcomeEmail,
  sendFanWelcomeEmail,
  sendPasswordResetEmail,
  sendPaymentConfirmationEmail,
  sendCreatorApprovalEmail,
  sendSessionReminderEmail,
  sendClassEnrollmentConfirmationEmail
};