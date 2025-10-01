const {
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendPaymentConfirmationEmail,
  sendCreatorApprovalEmail,
  sendSessionReminderEmail,
  sendEmail
} = require('./services/emailService');

// Test function to send a test email
async function testEmailService() {
  console.log('🚀 Testing Postmark Email Service with Logo...\n');

  try {
    // Test 1: Send a simple test email with logo
    console.log('📧 Sending test email with logo to team@digis.cc...');
    const testResult = await sendEmail(
      'team@digis.cc',
      'Test Email from Digis Platform',
      `<div style="text-align:center; padding:20px;">
        <div style="font-size:32px;font-weight:bold;color:#111827;letter-spacing:-2px;margin-bottom:20px;">digis</div>
        <h1>Test Email with Logo</h1>
        <p>This is a test email from your Digis platform with the logo included.</p>
        <p>If you can see the Digis brand name styled above, your email service is configured correctly!</p>
        <p>Sent at: ${new Date().toISOString()}</p>
      </div>`
    );
    console.log('✅ Test email with logo sent successfully!\n');

    // Uncomment the lines below to test other email templates:

    // Test 2: Welcome email
    // console.log('📧 Sending welcome email...');
    // await sendWelcomeEmail('team@digis.cc', 'Test User');
    // console.log('✅ Welcome email sent!\n');

    // Test 3: Password reset email
    // console.log('📧 Sending password reset email...');
    // await sendPasswordResetEmail('team@digis.cc', 'test-reset-token-123');
    // console.log('✅ Password reset email sent!\n');

    // Test 4: Payment confirmation
    // console.log('📧 Sending payment confirmation...');
    // await sendPaymentConfirmationEmail('team@digis.cc', 1999, 100);
    // console.log('✅ Payment confirmation sent!\n');

    // Test 5: Creator approval
    // console.log('📧 Sending creator approval...');
    // await sendCreatorApprovalEmail('team@digis.cc', 'Test Creator');
    // console.log('✅ Creator approval sent!\n');

    // Test 6: Session reminder
    // console.log('📧 Sending session reminder...');
    // await sendSessionReminderEmail('team@digis.cc', 'John Doe', 'Today at 3:00 PM');
    // console.log('✅ Session reminder sent!\n');

    console.log('🎉 Email service is working correctly!');
    console.log('Check your inbox at team@digis.cc for the test email.');

  } catch (error) {
    console.error('❌ Email test failed:', error.message);
    console.error('\nPossible issues:');
    console.error('1. Make sure team@digis.cc is verified as a Sender Signature in Postmark');
    console.error('2. Check that the API key is correct and active');
    console.error('3. Ensure your Postmark account is not in sandbox mode');
  }
}

// Run the test
testEmailService();