const cron = require('node-cron');
const fetch = require('node-fetch');

// Schedule automatic withdrawals for 1st and 15th of each month at 2 AM
const scheduleWithdrawals = () => {
  // Run on 1st of every month at 2:00 AM
  cron.schedule('0 2 1 * *', async () => {
    console.log('🔄 Running automatic withdrawals for the 1st of the month...');
    await processWithdrawals();
  });

  // Run on 15th of every month at 2:00 AM
  cron.schedule('0 2 15 * *', async () => {
    console.log('🔄 Running automatic withdrawals for the 15th of the month...');
    await processWithdrawals();
  });
  
  console.log('✅ Automatic withdrawal cron jobs scheduled for 1st and 15th of each month');
};

const processWithdrawals = async () => {
  try {
    const response = await fetch(`${process.env.BACKEND_URL}/api/payments/process-auto-withdrawals`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        secretKey: process.env.CRON_SECRET_KEY
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log(`✅ Processed ${result.processedCount} withdrawals totaling $${result.totalAmount}`);
    } else {
      console.error('❌ Failed to process withdrawals:', await response.text());
    }
  } catch (error) {
    console.error('❌ Error processing automatic withdrawals:', error);
  }
};

// For testing - process withdrawals immediately
const testWithdrawals = async () => {
  console.log('🧪 Testing automatic withdrawal process...');
  await processWithdrawals();
};

module.exports = {
  scheduleWithdrawals,
  testWithdrawals
};