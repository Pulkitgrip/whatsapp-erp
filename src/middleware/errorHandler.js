const createError = require('http-errors');

module.exports = (err, req, res, next) => {
  // If the error is not an http-error, convert it
  if (!err.status) {
    err = createError(500, err.message || 'Internal Server Error');
  }
  res.status(err.status).json({
    status: err.status,
    message: err.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
}; 