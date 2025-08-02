const { Pool } = require('pg');
const winston = require('winston');

// Enhanced logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Parse database URL
const connectionString = process.env.DATABASE_URL;
const ssl = process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false;

// Optimized pool configuration
const pool = new Pool({
  connectionString,
  ssl,
  // Connection pool optimization
  max: 20, // Maximum pool size
  min: 5, // Minimum pool size
  idleTimeoutMillis: 30000, // Close idle clients after 30s
  connectionTimeoutMillis: 5000, // Fail fast on connection
  statement_timeout: 30000, // Cancel queries after 30s
  query_timeout: 30000, // Alternative timeout setting
  // Connection retry logic
  retryConnectionInterval: 1000,
  retryConnectionMaxRetries: 3,
});

// Connection event handlers
pool.on('error', (err, client) => {
  logger.error('Unexpected database error on idle client', err);
});

pool.on('connect', (client) => {
  logger.debug('New client connected to database pool');
});

pool.on('acquire', (client) => {
  logger.debug('Client acquired from pool');
});

pool.on('remove', (client) => {
  logger.debug('Client removed from pool');
});

/**
 * Query builder for safe parameterized queries
 */
class QueryBuilder {
  constructor(table) {
    this.table = table;
    this.conditions = [];
    this.params = [];
    this.orderBy = '';
    this.limitValue = null;
    this.offsetValue = null;
    this.fields = '*';
  }

  select(fields) {
    this.fields = Array.isArray(fields) ? fields.join(', ') : fields;
    return this;
  }

  where(field, operator, value) {
    this.conditions.push(`${field} ${operator} $${this.params.length + 1}`);
    this.params.push(value);
    return this;
  }

  whereIn(field, values) {
    const placeholders = values.map((_, i) => `$${this.params.length + i + 1}`).join(', ');
    this.conditions.push(`${field} IN (${placeholders})`);
    this.params.push(...values);
    return this;
  }

  orderByClause(field, direction = 'ASC') {
    this.orderBy = `ORDER BY ${field} ${direction}`;
    return this;
  }

  limit(value) {
    this.limitValue = value;
    return this;
  }

  offset(value) {
    this.offsetValue = value;
    return this;
  }

  build() {
    let query = `SELECT ${this.fields} FROM ${this.table}`;
    
    if (this.conditions.length > 0) {
      query += ` WHERE ${this.conditions.join(' AND ')}`;
    }
    
    if (this.orderBy) {
      query += ` ${this.orderBy}`;
    }
    
    if (this.limitValue !== null) {
      query += ` LIMIT ${this.limitValue}`;
    }
    
    if (this.offsetValue !== null) {
      query += ` OFFSET ${this.offsetValue}`;
    }
    
    return { text: query, values: this.params };
  }

  async execute() {
    const query = this.build();
    return await executeQuery(query.text, query.values);
  }
}

/**
 * Execute a query with automatic retry and connection management
 */
async function executeQuery(text, params = [], options = {}) {
  const maxRetries = options.maxRetries || 3;
  const retryDelay = options.retryDelay || 1000;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    let client;
    
    try {
      // Get a client from the pool
      client = await pool.connect();
      
      // Set statement timeout for this specific query if provided
      if (options.timeout) {
        await client.query(`SET statement_timeout = ${options.timeout}`);
      }
      
      // Execute the query
      const start = Date.now();
      const result = await client.query(text, params);
      const duration = Date.now() - start;
      
      // Log slow queries
      if (duration > 1000) {
        logger.warn('Slow query detected', {
          query: text,
          duration,
          rowCount: result.rowCount
        });
      }
      
      return result;
      
    } catch (error) {
      logger.error(`Database query error (attempt ${attempt}/${maxRetries})`, {
        error: error.message,
        query: text,
        attempt
      });
      
      // Don't retry on certain errors
      if (error.code === '23505') { // Unique violation
        throw error;
      }
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
      
    } finally {
      // Always release the client back to the pool
      if (client) {
        client.release();
      }
    }
  }
}

/**
 * Transaction helper with automatic rollback
 */
async function withTransaction(callback) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Batch insert helper
 */
async function batchInsert(table, columns, values, options = {}) {
  if (values.length === 0) return { rowCount: 0 };
  
  const chunkSize = options.chunkSize || 1000;
  const results = [];
  
  for (let i = 0; i < values.length; i += chunkSize) {
    const chunk = values.slice(i, i + chunkSize);
    const placeholders = chunk.map((row, rowIndex) => 
      `(${columns.map((_, colIndex) => 
        `$${rowIndex * columns.length + colIndex + 1}`
      ).join(', ')})`
    ).join(', ');
    
    const flatValues = chunk.flat();
    const query = `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${placeholders}`;
    
    const result = await executeQuery(query, flatValues);
    results.push(result);
  }
  
  return {
    rowCount: results.reduce((sum, r) => sum + r.rowCount, 0)
  };
}

/**
 * Health check for database connection
 */
async function healthCheck() {
  try {
    const result = await executeQuery('SELECT NOW() as time, version() as version');
    return {
      status: 'healthy',
      timestamp: result.rows[0].time,
      version: result.rows[0].version,
      poolStats: {
        totalCount: pool.totalCount,
        idleCount: pool.idleCount,
        waitingCount: pool.waitingCount
      }
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
      poolStats: {
        totalCount: pool.totalCount,
        idleCount: pool.idleCount,
        waitingCount: pool.waitingCount
      }
    };
  }
}

/**
 * Graceful shutdown
 */
async function shutdown() {
  logger.info('Closing database pool...');
  await pool.end();
  logger.info('Database pool closed');
}

// Handle process termination
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

module.exports = {
  pool,
  QueryBuilder,
  executeQuery,
  withTransaction,
  batchInsert,
  healthCheck,
  shutdown,
  // Convenience function for building queries
  query: (table) => new QueryBuilder(table),
};