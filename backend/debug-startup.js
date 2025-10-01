const path = require('path');
console.log('Loading environment...');
require('dotenv').config({ path: path.join(__dirname, '.env') });

console.log('Loading express...');
const express = require('express');

console.log('Creating app...');
const app = express();

console.log('Adding test route...');
app.get('/test', (req, res) => {
  res.json({ status: 'ok' });
});

console.log('Loading auth middleware...');
const { authenticateToken } = require('./middleware/auth');
console.log('Auth middleware loaded:', typeof authenticateToken);

console.log('Loading auth routes...');
try {
  const authRoutes = require('./routes/auth');
  console.log('Auth routes loaded successfully');
  app.use('/api/auth', authRoutes);
} catch (error) {
  console.error('Auth routes error:', error.message);
}

console.log('Starting server...');
const PORT = process.env.PORT || 3001;
const server = app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  
  // Test the server
  setTimeout(() => {
    console.log('Server started successfully!');
    server.close();
    process.exit(0);
  }, 1000);
});

server.on('error', (error) => {
  console.error('Server error:', error);
  process.exit(1);
});