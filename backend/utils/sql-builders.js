/**
 * Safe SQL query builders to prevent injection attacks
 */

/**
 * Build a safe UPDATE query with whitelisted columns
 * @param {string} tableName - Name of the table to update
 * @param {Object} updates - Object with column:value pairs to update
 * @param {Array} allowedColumns - Whitelist of allowed column names
 * @param {Object} whereClause - WHERE clause conditions
 * @returns {Object} - { query: string, values: array }
 */
const buildSafeUpdate = (tableName, updates, allowedColumns, whereClause) => {
  // Validate table name (alphanumeric and underscores only)
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
    throw new Error('Invalid table name');
  }

  const updatePairs = [];
  const values = [];
  let paramIndex = 1;

  // Build SET clause with whitelisted columns only
  for (const [column, value] of Object.entries(updates)) {
    // Skip if column not in whitelist
    if (!allowedColumns.includes(column)) {
      continue;
    }

    // Validate column name format
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(column)) {
      throw new Error(`Invalid column name: ${column}`);
    }

    updatePairs.push(`${column} = $${paramIndex++}`);
    values.push(value);
  }

  if (updatePairs.length === 0) {
    throw new Error('No valid columns to update');
  }

  // Add updated_at if not already included
  if (!updates.updated_at && allowedColumns.includes('updated_at')) {
    updatePairs.push(`updated_at = CURRENT_TIMESTAMP`);
  }

  // Build WHERE clause
  const wherePairs = [];
  for (const [column, value] of Object.entries(whereClause)) {
    // Validate column name
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(column)) {
      throw new Error(`Invalid WHERE column: ${column}`);
    }

    wherePairs.push(`${column} = $${paramIndex++}`);
    values.push(value);
  }

  const query = `
    UPDATE ${tableName}
    SET ${updatePairs.join(', ')}
    WHERE ${wherePairs.join(' AND ')}
    RETURNING *
  `;

  return { query, values };
};

/**
 * Build a safe INSERT query with whitelisted columns
 * @param {string} tableName - Name of the table
 * @param {Object} data - Data to insert
 * @param {Array} allowedColumns - Whitelist of allowed columns
 * @param {boolean} returnInserted - Whether to return the inserted row
 * @returns {Object} - { query: string, values: array }
 */
const buildSafeInsert = (tableName, data, allowedColumns, returnInserted = true) => {
  // Validate table name
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
    throw new Error('Invalid table name');
  }

  const columns = [];
  const placeholders = [];
  const values = [];
  let paramIndex = 1;

  for (const [column, value] of Object.entries(data)) {
    // Skip if not in whitelist
    if (!allowedColumns.includes(column)) {
      continue;
    }

    // Validate column name
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(column)) {
      throw new Error(`Invalid column name: ${column}`);
    }

    columns.push(column);
    placeholders.push(`$${paramIndex++}`);
    values.push(value);
  }

  if (columns.length === 0) {
    throw new Error('No valid columns to insert');
  }

  let query = `
    INSERT INTO ${tableName} (${columns.join(', ')})
    VALUES (${placeholders.join(', ')})
  `;

  if (returnInserted) {
    query += ' RETURNING *';
  }

  return { query, values };
};

/**
 * Build a safe SELECT query with dynamic filters
 * @param {string} tableName - Name of the table
 * @param {Array} selectColumns - Columns to select
 * @param {Object} filters - Filter conditions
 * @param {Object} options - Query options (limit, offset, orderBy)
 * @returns {Object} - { query: string, values: array }
 */
const buildSafeSelect = (tableName, selectColumns = ['*'], filters = {}, options = {}) => {
  // Validate table name
  if (!/^[a-zA-Z_][a-zA-Z0-9_*.(),\s]*$/.test(tableName)) {
    throw new Error('Invalid table name');
  }

  // Validate and build SELECT clause
  const selectClause = selectColumns.map(col => {
    if (col === '*') return col;
    if (!/^[a-zA-Z_][a-zA-Z0-9_*.(),\s]*$/.test(col)) {
      throw new Error(`Invalid column: ${col}`);
    }
    return col;
  }).join(', ');

  // Build WHERE clause
  const wherePairs = [];
  const values = [];
  let paramIndex = 1;

  for (const [column, value] of Object.entries(filters)) {
    // Skip null/undefined filters
    if (value === null || value === undefined) {
      continue;
    }

    // Validate column name
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(column)) {
      throw new Error(`Invalid filter column: ${column}`);
    }

    if (Array.isArray(value)) {
      // Handle IN clause
      const placeholders = value.map(() => `$${paramIndex++}`);
      wherePairs.push(`${column} IN (${placeholders.join(', ')})`);
      values.push(...value);
    } else {
      wherePairs.push(`${column} = $${paramIndex++}`);
      values.push(value);
    }
  }

  let query = `SELECT ${selectClause} FROM ${tableName}`;

  if (wherePairs.length > 0) {
    query += ` WHERE ${wherePairs.join(' AND ')}`;
  }

  // Add ORDER BY if specified
  if (options.orderBy) {
    const { column, direction = 'ASC' } = options.orderBy;
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(column)) {
      throw new Error('Invalid ORDER BY column');
    }
    if (!['ASC', 'DESC'].includes(direction.toUpperCase())) {
      throw new Error('Invalid ORDER BY direction');
    }
    query += ` ORDER BY ${column} ${direction.toUpperCase()}`;
  }

  // Add LIMIT if specified
  if (options.limit) {
    const limit = parseInt(options.limit, 10);
    if (isNaN(limit) || limit < 1) {
      throw new Error('Invalid LIMIT value');
    }
    query += ` LIMIT ${limit}`;
  }

  // Add OFFSET if specified
  if (options.offset) {
    const offset = parseInt(options.offset, 10);
    if (isNaN(offset) || offset < 0) {
      throw new Error('Invalid OFFSET value');
    }
    query += ` OFFSET ${offset}`;
  }

  return { query, values };
};

/**
 * Column whitelists for common tables
 */
const ALLOWED_COLUMNS = {
  users: [
    'supabase_id', 'email', 'username', 'display_name', 'bio',
    'is_creator', 'is_super_admin', 'role', 'creator_type',
    'profile_image_url', 'banner_url', 'is_online', 'last_seen',
    'created_at', 'updated_at', 'age_verified', 'is_verified'
  ],
  creator_applications: [
    'user_id', 'status', 'review_notes', 'reviewed_by',
    'reviewed_at', 'application_data', 'created_at', 'updated_at'
  ],
  tokens: [
    'user_id', 'amount', 'transaction_type', 'reference_id',
    'description', 'created_at'
  ],
  streams: [
    'creator_id', 'title', 'description', 'is_live', 'started_at',
    'ended_at', 'viewer_count', 'stream_type', 'thumbnail_url',
    'created_at', 'updated_at'
  ]
};

module.exports = {
  buildSafeUpdate,
  buildSafeInsert,
  buildSafeSelect,
  ALLOWED_COLUMNS
};