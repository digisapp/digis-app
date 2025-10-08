/**
 * Earnings Rollup Functions (Inngest)
 *
 * Daily/monthly earnings aggregation for creator analytics.
 * Replaces BullMQ cron jobs with serverless Inngest functions.
 */

const { inngest } = require('../client');
const { pool } = require('../../utils/db');

/**
 * Daily Earnings Rollup
 *
 * Triggered by: Nightly cron (via QStash or Vercel Cron)
 * Event: "earnings.rollup-daily"
 */
const dailyEarningsRollup = inngest.createFunction(
  {
    id: 'daily-earnings-rollup',
    name: 'Daily Earnings Rollup',
    retries: 3,
    concurrency: { limit: 1 }, // Run one at a time to avoid conflicts
  },
  { event: 'earnings.rollup-daily' },
  async ({ event, step, logger }) => {
    const { targetDate } = event.data || {};
    const rollupDate = targetDate || new Date(Date.now() - 24 * 60 * 60 * 1000); // Yesterday

    // Step 1: Calculate earnings by source
    const earningsBySource = await step.run(
      'calculate-earnings-by-source',
      async () => {
        const result = await pool.query(
          `INSERT INTO earnings_daily_rollup (
            rollup_date,
            creator_id,
            tips_amount,
            subscriptions_amount,
            calls_amount,
            content_sales_amount,
            gifts_amount,
            other_amount,
            total_earnings,
            platform_fee_amount,
            net_earnings,
            transactions_count,
            created_at
          )
          SELECT
            $1::DATE as rollup_date,
            creator_id,
            COALESCE(SUM(CASE WHEN transaction_type = 'tip' THEN amount ELSE 0 END), 0) as tips_amount,
            COALESCE(SUM(CASE WHEN transaction_type = 'subscription' THEN amount ELSE 0 END), 0) as subscriptions_amount,
            COALESCE(SUM(CASE WHEN transaction_type = 'call' THEN amount ELSE 0 END), 0) as calls_amount,
            COALESCE(SUM(CASE WHEN transaction_type = 'content_purchase' THEN amount ELSE 0 END), 0) as content_sales_amount,
            COALESCE(SUM(CASE WHEN transaction_type = 'gift' THEN amount ELSE 0 END), 0) as gifts_amount,
            COALESCE(SUM(CASE WHEN transaction_type NOT IN ('tip', 'subscription', 'call', 'content_purchase', 'gift') THEN amount ELSE 0 END), 0) as other_amount,
            SUM(amount) as total_earnings,
            SUM(platform_fee) as platform_fee_amount,
            SUM(amount - platform_fee) as net_earnings,
            COUNT(*) as transactions_count,
            NOW() as created_at
          FROM creator_earnings
          WHERE DATE(created_at) = $1::DATE
            AND status = 'completed'
          GROUP BY creator_id
          ON CONFLICT (rollup_date, creator_id)
          DO UPDATE SET
            tips_amount = EXCLUDED.tips_amount,
            subscriptions_amount = EXCLUDED.subscriptions_amount,
            calls_amount = EXCLUDED.calls_amount,
            content_sales_amount = EXCLUDED.content_sales_amount,
            gifts_amount = EXCLUDED.gifts_amount,
            other_amount = EXCLUDED.other_amount,
            total_earnings = EXCLUDED.total_earnings,
            platform_fee_amount = EXCLUDED.platform_fee_amount,
            net_earnings = EXCLUDED.net_earnings,
            transactions_count = EXCLUDED.transactions_count,
            updated_at = NOW()
          RETURNING creator_id, total_earnings`,
          [rollupDate]
        );

        logger.info('Daily earnings rollup completed', {
          rollupDate,
          creatorsProcessed: result.rows.length,
        });

        return result.rows;
      }
    );

    // Step 2: Update creator lifetime earnings
    await step.run('update-lifetime-earnings', async () => {
      for (const earning of earningsBySource) {
        await pool.query(
          `UPDATE creator_analytics
           SET lifetime_earnings = (
             SELECT COALESCE(SUM(total_earnings), 0)
             FROM earnings_daily_rollup
             WHERE creator_id = $1
           ),
           updated_at = NOW()
           WHERE creator_id = $1`,
          [earning.creator_id]
        );
      }
    });

    // Step 3: Calculate platform-wide stats
    const platformStats = await step.run(
      'calculate-platform-stats',
      async () => {
        const result = await pool.query(
          `INSERT INTO platform_daily_stats (
            stats_date,
            total_earnings,
            total_transactions,
            active_creators,
            platform_fees_collected,
            created_at
          )
          SELECT
            $1::DATE,
            COALESCE(SUM(total_earnings), 0),
            COALESCE(SUM(transactions_count), 0),
            COUNT(DISTINCT creator_id),
            COALESCE(SUM(platform_fee_amount), 0),
            NOW()
          FROM earnings_daily_rollup
          WHERE rollup_date = $1::DATE
          ON CONFLICT (stats_date)
          DO UPDATE SET
            total_earnings = EXCLUDED.total_earnings,
            total_transactions = EXCLUDED.total_transactions,
            active_creators = EXCLUDED.active_creators,
            platform_fees_collected = EXCLUDED.platform_fees_collected,
            updated_at = NOW()
          RETURNING *`,
          [rollupDate]
        );

        return result.rows[0];
      }
    );

    logger.info('Daily rollup completed', {
      rollupDate,
      creatorsProcessed: earningsBySource.length,
      platformStats,
    });

    return {
      success: true,
      rollupDate,
      creatorsProcessed: earningsBySource.length,
      platformStats,
    };
  }
);

/**
 * Monthly Earnings Rollup
 *
 * Triggered by: Monthly cron (1st of month)
 * Event: "earnings.rollup-monthly"
 */
const monthlyEarningsRollup = inngest.createFunction(
  {
    id: 'monthly-earnings-rollup',
    name: 'Monthly Earnings Rollup',
    retries: 3,
    concurrency: { limit: 1 },
  },
  { event: 'earnings.rollup-monthly' },
  async ({ event, step, logger }) => {
    const { targetMonth } = event.data || {};
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const rollupMonth = targetMonth || lastMonth;

    // Step 1: Aggregate monthly earnings
    const monthlyEarnings = await step.run(
      'aggregate-monthly-earnings',
      async () => {
        const result = await pool.query(
          `INSERT INTO earnings_monthly_rollup (
            rollup_month,
            creator_id,
            total_earnings,
            tips_amount,
            subscriptions_amount,
            calls_amount,
            content_sales_amount,
            gifts_amount,
            platform_fee_amount,
            net_earnings,
            transactions_count,
            active_days,
            created_at
          )
          SELECT
            DATE_TRUNC('month', $1::DATE) as rollup_month,
            creator_id,
            SUM(total_earnings) as total_earnings,
            SUM(tips_amount) as tips_amount,
            SUM(subscriptions_amount) as subscriptions_amount,
            SUM(calls_amount) as calls_amount,
            SUM(content_sales_amount) as content_sales_amount,
            SUM(gifts_amount) as gifts_amount,
            SUM(platform_fee_amount) as platform_fee_amount,
            SUM(net_earnings) as net_earnings,
            SUM(transactions_count) as transactions_count,
            COUNT(DISTINCT rollup_date) as active_days,
            NOW() as created_at
          FROM earnings_daily_rollup
          WHERE DATE_TRUNC('month', rollup_date) = DATE_TRUNC('month', $1::DATE)
          GROUP BY creator_id
          ON CONFLICT (rollup_month, creator_id)
          DO UPDATE SET
            total_earnings = EXCLUDED.total_earnings,
            tips_amount = EXCLUDED.tips_amount,
            subscriptions_amount = EXCLUDED.subscriptions_amount,
            calls_amount = EXCLUDED.calls_amount,
            content_sales_amount = EXCLUDED.content_sales_amount,
            gifts_amount = EXCLUDED.gifts_amount,
            platform_fee_amount = EXCLUDED.platform_fee_amount,
            net_earnings = EXCLUDED.net_earnings,
            transactions_count = EXCLUDED.transactions_count,
            active_days = EXCLUDED.active_days,
            updated_at = NOW()
          RETURNING creator_id, total_earnings`,
          [rollupMonth]
        );

        logger.info('Monthly earnings rollup completed', {
          rollupMonth,
          creatorsProcessed: result.rows.length,
        });

        return result.rows;
      }
    );

    // Step 2: Generate creator monthly statements
    await step.run('generate-monthly-statements', async () => {
      for (const earning of monthlyEarnings) {
        // Send event to generate PDF statement (another Inngest function)
        await step.sendEvent('send-monthly-statement', {
          name: 'creator.generate-monthly-statement',
          data: {
            creatorId: earning.creator_id,
            month: rollupMonth,
            totalEarnings: earning.total_earnings,
          },
        });
      }
    });

    logger.info('Monthly rollup and statement generation completed', {
      rollupMonth,
      creatorsProcessed: monthlyEarnings.length,
    });

    return {
      success: true,
      rollupMonth,
      creatorsProcessed: monthlyEarnings.length,
    };
  }
);

/**
 * Analytics Cache Warmer
 *
 * Pre-calculate popular analytics queries for fast dashboard loading
 * Triggered by: Hourly cron
 * Event: "analytics.warm-cache"
 */
const warmAnalyticsCache = inngest.createFunction(
  {
    id: 'warm-analytics-cache',
    name: 'Warm Analytics Cache',
    retries: 2,
  },
  { event: 'analytics.warm-cache' },
  async ({ event, step, logger }) => {
    const redis = await import('@upstash/redis').then((m) =>
      m.Redis.fromEnv()
    );

    // Step 1: Top creators by earnings (last 30 days)
    await step.run('cache-top-creators', async () => {
      const result = await pool.query(
        `SELECT
          creator_id,
          SUM(total_earnings) as earnings_30d,
          SUM(transactions_count) as transactions_30d
         FROM earnings_daily_rollup
         WHERE rollup_date >= CURRENT_DATE - INTERVAL '30 days'
         GROUP BY creator_id
         ORDER BY earnings_30d DESC
         LIMIT 100`
      );

      await redis.set('analytics:top-creators:30d', JSON.stringify(result.rows), {
        ex: 3600, // 1 hour
      });

      logger.info('Cached top creators', { count: result.rows.length });
    });

    // Step 2: Platform-wide stats (last 7 days)
    await step.run('cache-platform-stats', async () => {
      const result = await pool.query(
        `SELECT
          rollup_date,
          total_earnings,
          total_transactions,
          active_creators
         FROM platform_daily_stats
         WHERE stats_date >= CURRENT_DATE - INTERVAL '7 days'
         ORDER BY stats_date DESC`
      );

      await redis.set('analytics:platform-stats:7d', JSON.stringify(result.rows), {
        ex: 1800, // 30 minutes
      });

      logger.info('Cached platform stats', { days: result.rows.length });
    });

    return { success: true, cacheWarmed: ['top-creators', 'platform-stats'] };
  }
);

module.exports = {
  dailyEarningsRollup,
  monthlyEarningsRollup,
  warmAnalyticsCache,
};
