/**
 * Vercel Cron Job: Automated Bi-Monthly Payouts (Trigger Only)
 *
 * This endpoint is triggered by Vercel Cron on the 1st and 15th of each month at 2 AM UTC.
 * It ONLY triggers an Inngest event - actual processing happens in Inngest workers.
 *
 * Architecture:
 * - Vercel Cron → Trigger Inngest event (fast, lightweight)
 * - Inngest → Process payouts (durable, retriable, scalable)
 *
 * Security: Requires CRON_SECRET in Authorization header to prevent unauthorized access.
 */

const { inngest } = require('../../inngest/client');

module.exports = async (req, res) => {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify request is from Vercel Cron
  const authHeader = req.headers.authorization;
  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;

  if (!process.env.CRON_SECRET) {
    console.error('❌ CRON_SECRET not configured in environment variables');
    return res.status(500).json({
      error: 'Cron job not configured',
      message: 'CRON_SECRET environment variable is missing'
    });
  }

  if (authHeader !== expectedAuth) {
    console.warn('⚠️ Unauthorized cron job access attempt');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const now = new Date();
    const dayOfMonth = now.getDate();

    // Only run on 1st and 15th
    if (dayOfMonth !== 1 && dayOfMonth !== 15) {
      console.log('⏭️ Not a payout day, skipping', { dayOfMonth });
      return res.status(200).json({
        success: true,
        skipped: true,
        reason: 'Not a scheduled payout day (1st or 15th)',
        dayOfMonth,
        timestamp: now.toISOString()
      });
    }

    console.log('🚀 Triggering payout batch creation via Inngest...', { dayOfMonth });

    // Trigger Inngest event (fast - returns immediately)
    const eventId = await inngest.send({
      name: 'payout.create-batch',
      data: {
        cutoffAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        scheduleType: 'bi_monthly',
        dayOfMonth,
        triggeredBy: 'vercel_cron',
      },
    });

    console.log('✅ Payout batch creation triggered', { eventId });

    res.status(200).json({
      success: true,
      message: 'Payout batch queued for processing',
      eventId,
      dayOfMonth,
      timestamp: now.toISOString(),
      note: 'Processing will continue in background via Inngest'
    });
  } catch (error) {
    console.error('❌ Failed to trigger payout batch:', error);

    res.status(500).json({
      error: 'Failed to trigger payout batch',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
};
