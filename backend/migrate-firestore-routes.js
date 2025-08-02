const fs = require('fs');
const path = require('path');

// Routes that use Firestore
const routesToMigrate = [
  'gifts.js', 'tips.js', 'polls.js', 'questions.js', 
  'badges.js', 'discovery.js', 'privacy.js'
];

const routesDir = path.join(__dirname, 'routes');

console.log('Migrating Firestore routes to PostgreSQL...\n');

// Read the template for PostgreSQL routes
const postgresTemplate = `const express = require('express');
const { pool } = require('../utils/db');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Middleware
router.use(authenticateToken);

// TODO: Implement route handlers using PostgreSQL instead of Firestore
// Example:
// router.post('/example', async (req, res) => {
//   try {
//     const userId = req.user.id;
//     const result = await pool.query('SELECT * FROM table WHERE user_id = $1', [userId]);
//     res.json({ data: result.rows });
//   } catch (error) {
//     console.error('Error:', error);
//     res.status(500).json({ error: 'Server error' });
//   }
// });

module.exports = router;
`;

routesToMigrate.forEach(file => {
  const filePath = path.join(routesDir, file);
  
  try {
    // Create a temporary file with PostgreSQL template
    const tempFilePath = filePath + '.temp';
    fs.writeFileSync(tempFilePath, postgresTemplate);
    
    // Move original to backup if not already backed up
    if (!fs.existsSync(filePath + '.firestore-backup')) {
      fs.renameSync(filePath, filePath + '.firestore-backup');
    }
    
    // Move temp to actual file
    fs.renameSync(tempFilePath, filePath);
    
    console.log(`✅ ${file} - Migrated to PostgreSQL template`);
  } catch (error) {
    console.error(`❌ ${file} - Error: ${error.message}`);
  }
});

console.log('\n✨ Migration complete!');
console.log('📝 Note: The routes now have PostgreSQL templates. You need to implement the specific logic for each route.');