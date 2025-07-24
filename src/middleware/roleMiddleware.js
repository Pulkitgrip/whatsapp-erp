const createError = require('http-errors');

/**
 * Role-based authorization middleware
 * @param {string|Array} allowedRoles - Single role or array of roles that are allowed
 * @returns {Function} Express middleware function
 */
module.exports = function requireRole(allowedRoles) {
  return (req, res, next) => {
    try {
      // Check if user is authenticated (should be set by authMiddleware)
      if (!req.user) {
        return next(createError(401, 'Authentication required'));
      }

      // Convert single role to array for consistent handling
      const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
      
      // Check if user's role is in the allowed roles
      if (!roles.includes(req.user.role)) {
        return next(createError(403, 'Insufficient permissions'));
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}


