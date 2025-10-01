# Supabase Grafana Dashboard Setup Guide

## Overview
This guide helps you set up comprehensive monitoring for your Supabase PostgreSQL database using Grafana, providing visibility into 200+ performance and health metrics.

## Prerequisites
- Active Supabase project
- Grafana Cloud account or self-hosted Grafana instance
- Database connection details from Supabase

## Step 1: Enable pg_stat_statements Extension

First, enable the required PostgreSQL extensions in your Supabase dashboard:

1. Go to your Supabase Dashboard
2. Navigate to Database → Extensions
3. Enable the following extensions:
   - `pg_stat_statements` (for query performance metrics)
   - `pg_stat_monitor` (if available, for enhanced monitoring)

## Step 2: Get Database Connection Details

From your Supabase dashboard:
1. Go to Settings → Database
2. Note down:
   - Host
   - Database name
   - Port (usually 5432)
   - User (postgres)
   - Password

## Step 3: Set Up Grafana

### Option A: Grafana Cloud (Recommended)
1. Sign up for free at https://grafana.com
2. Create a new stack
3. Install PostgreSQL data source plugin

### Option B: Self-Hosted Grafana
```bash
# Using Docker
docker run -d \
  -p 3000:3000 \
  --name=grafana \
  -e "GF_INSTALL_PLUGINS=grafana-postgresql-datasource" \
  grafana/grafana-oss
```

## Step 4: Configure PostgreSQL Data Source

1. In Grafana, go to Configuration → Data Sources
2. Add new data source → PostgreSQL
3. Configure connection:
   ```
   Host: [your-project].supabase.co:5432
   Database: postgres
   User: postgres
   Password: [your-password]
   SSL Mode: require
   Version: 14.x (or your PostgreSQL version)
   ```
4. Additional settings:
   - Max open connections: 5
   - Max idle connections: 2
   - Max lifetime: 14400

## Step 5: Import Supabase Dashboard

Use these dashboard IDs for comprehensive monitoring:

1. **PostgreSQL Database Dashboard** (ID: 9628)
   - Overall database performance
   - Connection metrics
   - Query performance
   - Cache hit ratios

2. **PostgreSQL Query Performance** (ID: 10991)
   - Slow query analysis
   - Query execution times
   - Most frequent queries

3. **Supabase Specific Metrics** (Custom)
   - Real-time subscriptions
   - Storage usage
   - Auth metrics

## Step 6: Key Metrics to Monitor

### Database Performance
- **Connection pool utilization**
- **Query response times**
- **Cache hit ratio** (target: >99%)
- **Transaction rate**
- **Database size growth**

### Query Performance
- **Slow queries** (>100ms)
- **Most time-consuming queries**
- **Index usage**
- **Sequential scans vs index scans**

### Resource Utilization
- **CPU usage**
- **Memory consumption**
- **Disk I/O**
- **Network throughput**

### Application Specific
- **Active sessions count**
- **Token transactions/minute**
- **API response times**
- **WebSocket connections**

## Step 7: Set Up Alerts

Configure alerts for critical metrics:

```yaml
# Example alert rules
alerts:
  - name: High Database CPU
    condition: cpu_usage > 80%
    duration: 5m
    
  - name: Slow Queries
    condition: query_time > 1000ms
    count: > 10 in 5m
    
  - name: Connection Pool Exhausted
    condition: available_connections < 5
    duration: 2m
    
  - name: Low Cache Hit Ratio
    condition: cache_hit_ratio < 95%
    duration: 10m
```

## Step 8: Custom Queries for Digis Platform

Add these custom panels to monitor platform-specific metrics:

### Active Creator Sessions
```sql
SELECT 
  COUNT(*) as active_sessions,
  AVG(EXTRACT(EPOCH FROM (NOW() - started_at))) as avg_duration
FROM sessions 
WHERE status = 'active';
```

### Token Economy Health
```sql
SELECT 
  DATE_TRUNC('hour', created_at) as time,
  SUM(amount) as tokens_purchased,
  COUNT(DISTINCT user_id) as unique_buyers
FROM token_purchases
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY time
ORDER BY time;
```

### Creator Performance
```sql
SELECT 
  c.username,
  COUNT(s.id) as total_sessions,
  AVG(s.duration_minutes) as avg_session_length,
  SUM(s.tokens_earned) as total_earnings
FROM creators c
LEFT JOIN sessions s ON c.id = s.creator_id
WHERE s.created_at > NOW() - INTERVAL '7 days'
GROUP BY c.username
ORDER BY total_earnings DESC
LIMIT 10;
```

## Step 9: Automated Monitoring Script

Create a monitoring script that runs periodically to collect custom metrics:

```javascript
// Save as backend/utils/metrics-collector.js
const db = require('./db');
const { createClient } = require('@supabase/supabase-js');

class MetricsCollector {
  async collectDatabaseMetrics() {
    const metrics = {};
    
    // Database size
    const sizeQuery = `
      SELECT 
        pg_database_size(current_database()) as db_size,
        pg_size_pretty(pg_database_size(current_database())) as db_size_pretty
    `;
    
    // Active connections
    const connectionsQuery = `
      SELECT 
        count(*) as total_connections,
        count(*) FILTER (WHERE state = 'active') as active_connections,
        count(*) FILTER (WHERE state = 'idle') as idle_connections
      FROM pg_stat_activity
    `;
    
    // Cache hit ratio
    const cacheQuery = `
      SELECT 
        sum(heap_blks_hit) / nullif(sum(heap_blks_hit) + sum(heap_blks_read), 0) as cache_hit_ratio
      FROM pg_statio_user_tables
    `;
    
    // Collect all metrics
    const [size, connections, cache] = await Promise.all([
      db.query(sizeQuery),
      db.query(connectionsQuery),
      db.query(cacheQuery)
    ]);
    
    return {
      database_size: size.rows[0].db_size,
      database_size_pretty: size.rows[0].db_size_pretty,
      total_connections: connections.rows[0].total_connections,
      active_connections: connections.rows[0].active_connections,
      idle_connections: connections.rows[0].idle_connections,
      cache_hit_ratio: cache.rows[0].cache_hit_ratio,
      timestamp: new Date()
    };
  }
  
  async collectApplicationMetrics() {
    const metrics = {};
    
    // Platform activity metrics
    const activityQuery = `
      SELECT 
        (SELECT COUNT(*) FROM users WHERE created_at > NOW() - INTERVAL '24 hours') as new_users_24h,
        (SELECT COUNT(*) FROM sessions WHERE status = 'active') as active_sessions,
        (SELECT COUNT(*) FROM creators WHERE is_online = true) as online_creators,
        (SELECT SUM(amount) FROM token_purchases WHERE created_at > NOW() - INTERVAL '1 hour') as tokens_purchased_1h
    `;
    
    const activity = await db.query(activityQuery);
    
    return {
      ...activity.rows[0],
      timestamp: new Date()
    };
  }
}

module.exports = MetricsCollector;
```

## Step 10: Integration with Backend

Add monitoring endpoint to your backend:

```javascript
// Add to backend/routes/monitoring.js
const express = require('express');
const router = express.Router();
const MetricsCollector = require('../utils/metrics-collector');

const collector = new MetricsCollector();

router.get('/metrics', async (req, res) => {
  try {
    const [dbMetrics, appMetrics] = await Promise.all([
      collector.collectDatabaseMetrics(),
      collector.collectApplicationMetrics()
    ]);
    
    res.json({
      database: dbMetrics,
      application: appMetrics
    });
  } catch (error) {
    console.error('Error collecting metrics:', error);
    res.status(500).json({ error: 'Failed to collect metrics' });
  }
});

module.exports = router;
```

## Dashboard Panels Configuration

### 1. Real-Time Overview
- Current active sessions
- Online creators count
- Tokens in circulation
- Revenue today

### 2. Performance Metrics
- API response times (p50, p95, p99)
- Database query times
- WebSocket latency
- Video call quality metrics

### 3. Business Metrics
- User acquisition rate
- Creator retention
- Token purchase conversion
- Average session duration

### 4. Infrastructure Health
- CPU utilization
- Memory usage
- Disk I/O
- Network bandwidth

## Maintenance Schedule

### Daily
- Review slow query log
- Check error rates
- Monitor disk space

### Weekly
- Analyze query performance trends
- Review index usage
- Check backup status

### Monthly
- Database optimization (VACUUM, ANALYZE)
- Review and update alert thresholds
- Performance baseline updates

## Troubleshooting

### Common Issues

1. **Connection Refused**
   - Verify Supabase allows external connections
   - Check firewall rules
   - Ensure SSL mode is set to 'require'

2. **Permission Denied**
   - Use the correct database user
   - Grant necessary permissions for monitoring queries

3. **High Query Times**
   - Run EXPLAIN ANALYZE on slow queries
   - Check for missing indexes
   - Review connection pool settings

## Additional Resources

- [Supabase Observability](https://supabase.com/docs/guides/platform/observability)
- [PostgreSQL Monitoring](https://www.postgresql.org/docs/current/monitoring.html)
- [Grafana PostgreSQL Dashboard](https://grafana.com/grafana/dashboards/9628)
- [pg_stat_statements Documentation](https://www.postgresql.org/docs/current/pgstatstatements.html)

## Security Considerations

1. **Use read-only database user for Grafana**
2. **Implement IP whitelisting**
3. **Use SSL/TLS for all connections**
4. **Rotate monitoring credentials regularly**
5. **Limit data retention based on compliance requirements**

## Next Steps

1. Set up the Grafana dashboard
2. Configure alerts for critical metrics
3. Create custom dashboards for business metrics
4. Implement automated reporting
5. Set up incident response procedures