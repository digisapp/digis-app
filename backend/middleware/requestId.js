const { randomUUID } = require('crypto');

/**
 * Request ID middleware
 * Adds a unique request ID to every request for tracing
 */
function requestId(req, res, next) {
  const id = req.headers['x-request-id'] || randomUUID();
  req.id = id;
  res.setHeader('x-request-id', id);
  next();
}

module.exports = requestId;
