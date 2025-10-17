// Tiny shim that loads your existing backend handler.
const handler = require('../backend/api/index.js');
module.exports = handler; // must export a (req, res) handler or an express app
