console.log('Starting test...');

// Test environment
require('dotenv').config();
console.log('Environment loaded');

// Test database connection
const { pool } = require('./utils/db');
console.log('Database module loaded');

// Test Supabase
try {
  const { initializeSupabaseAdmin } = require('./utils/supabase-admin');
  console.log('Supabase module loaded');
  initializeSupabaseAdmin();
  console.log('Supabase initialized');
} catch (error) {
  console.error('Supabase error:', error.message);
}

// Test a simple Express server
const express = require('express');
const app = express();
console.log('Express initialized');

app.get('/test', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = 3002;
app.listen(PORT, () => {
  console.log(`Test server running on port ${PORT}`);
  process.exit(0);
});