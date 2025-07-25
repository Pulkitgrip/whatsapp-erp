const express = require('express');
const router = express.Router();
const { signup, login, getProfile } = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');

// Public routes
router.post('/signup', signup);
router.post('/login', login);

// Protected routes
router.get('/profile', authMiddleware, getProfile);

// Debug endpoint to check if auth routes are working
router.get('/', (req, res) => {
  res.json({
    message: 'Auth routes are working',
    endpoints: {
      'POST /api/auth/signup': 'Register new user',
      'POST /api/auth/login': 'User login',
      'GET /api/auth/profile': 'Get user profile (requires auth)'
    }
  });
});

module.exports = router; 