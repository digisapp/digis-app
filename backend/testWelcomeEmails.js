const {
  sendCreatorWelcomeEmail,
  sendFanWelcomeEmail,
  sendCreatorApprovalEmail
} = require('./services/emailService');

async function testWelcomeEmails() {
  console.log('🚀 Sending test emails with Digis logo...\n');

  try {
    // Test 1: Creator Welcome Email
    console.log('📧 Sending Creator Welcome Email...');
    await sendCreatorWelcomeEmail('team@digis.cc', 'Test Creator');
    console.log('✅ Creator welcome email sent!\n');

    // Wait a second between emails
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test 2: Fan Welcome Email
    console.log('📧 Sending Fan Welcome Email...');
    await sendFanWelcomeEmail('team@digis.cc', 'Test Fan');
    console.log('✅ Fan welcome email sent!\n');

    // Wait a second between emails
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test 3: Creator Approval Email
    console.log('📧 Sending Creator Approval Email...');
    await sendCreatorApprovalEmail('team@digis.cc', 'Approved Creator');
    console.log('✅ Creator approval email sent!\n');

    console.log('🎉 All test emails sent successfully!');
    console.log('📬 Check your inbox at team@digis.cc to see the emails with the Digis logo.');
    console.log('\n💡 Note: Make sure to upload digis-logo-black.png to https://digis.cc/ for production use.');

  } catch (error) {
    console.error('❌ Error sending test emails:', error.message);
    console.error('\nTroubleshooting:');
    console.error('1. Check that your Postmark API key is valid');
    console.error('2. Ensure team@digis.cc is not in the suppression list');
    console.error('3. Verify your Postmark account is active');
  }
}

// Run the test
testWelcomeEmails();