const express = require('express');
// const { pool } = require('../utils/db'); // TODO: Use when implementing routes
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Middleware
router.use(authenticateToken);

// TODO: Implement route handlers using PostgreSQL/Supabase
// Example:
// router.post('/example', async (req, res) => {
//   try {
//     const userId = req.user.supabase_id;
//     const result = await pool.query('SELECT * FROM table WHERE user_id = $1', [userId]);
//     res.json({ data: result.rows });
//   } catch (error) {
//     console.error('Error:', error);
//     res.status(500).json({ error: 'Server error' });
//   }
// });

module.exports = router;
