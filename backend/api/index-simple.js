const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
const { logger } = require('../utils/secureLogger');

logger.info('Starting Digis backend server (simplified)...');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Initialize Express app
const app = express();

// Security middleware
app.use(helmet());
app.use(compression());

// CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Body parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Basic routes
app.get('/', (req, res) => {
  res.json({
    name: 'Digis Backend API (Supabase)',
    version: '2.0.0',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV
  });
});

// Load only working routes
try {
  app.use('/api/auth', require('../routes/auth'));
  logger.info('✅ Auth routes loaded');
} catch (error) {
  logger.error('Failed to load auth routes:', error);
}

// Error handling
app.use((err, req, res, _next) => {
  logger.error('Server error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

// Start server
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`
    ✅ Server is running!
    🚀 URL: http://${HOST}:${PORT}
    🔧 Health check: http://${HOST}:${PORT}/health
    📝 Environment: ${process.env.NODE_ENV || 'development'}
  `);
});