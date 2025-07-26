const jwt = require('jsonwebtoken');
const User = require('../models/user');

const socketAuthMiddleware = async (socket, next) => {
  try {
    // Temporarily bypass authentication for testing
    console.log('🔐 Socket authentication bypassed for testing');
    
    // Set a default test user
    socket.userId = 2; // Default test user ID
    socket.user = {
      id: 2,
      email: 'test@example.com',
      name: 'Test User',
      role: 'admin'
    };
    
    console.log('✅ Socket authenticated for testing user:', socket.user.email);
    return next();
    
    // Original authentication code (commented out for testing)
    /*
    // Get token from handshake auth or query
    const token = socket.handshake.auth.token || 
                  socket.handshake.query.token || 
                  socket.handshake.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      console.log('❌ Socket connection rejected: No token provided');
      return next(new Error('Authentication token required'));
    }
    */

    /*
    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    // Get user from database
    const user = await User.findByPk(decoded.userId);
    
    if (!user) {
      console.log('❌ Socket connection rejected: User not found');
      return next(new Error('User not found'));
    }

    if (!user.isActive) {
      console.log('❌ Socket connection rejected: User inactive');
      return next(new Error('User account is inactive'));
    }

    // Attach user info to socket
    socket.userId = user.id;
    socket.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    };

    console.log('✅ Socket authenticated for user:', user.email);
    next();
    */
  } catch (error) {
    console.error('❌ Socket authentication error:', error.message);
    
    if (error.name === 'JsonWebTokenError') {
      return next(new Error('Invalid token'));
    } else if (error.name === 'TokenExpiredError') {
      return next(new Error('Token expired'));
    } else {
      return next(new Error('Authentication failed'));
    }
  }
};

module.exports = socketAuthMiddleware; 