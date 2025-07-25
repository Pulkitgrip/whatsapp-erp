const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Simple in-memory user store for testing
const users = [
  {
    id: 1,
    email: 'admin@company.com',
    password: 'admin123', // Plain text for testing
    role: 'admin'
  },
  {
    id: 2,
    email: 'kevin@alchemytech.ca',
    password: 'Test@123', // Plain text for testing
    role: 'admin'
  }
];

// Debug endpoint
router.get('/', (req, res) => {
  res.json({
    message: 'Auth routes are working',
    endpoints: {
      'POST /api/auth/login': 'Login with email and password',
      'POST /api/auth/signup': 'Register a new user',
      'GET /api/auth/profile': 'Get user profile (protected)'
    }
  });
});

// Login endpoint
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Find user
    const user = users.find(u => u.email === email);
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }
    
    // Check password (plain text comparison for testing)
    const passwordMatch = (password === user.password);
    if (!passwordMatch) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }
    
    // Generate token
    const token = jwt.sign(
      { userId: user.id }, 
      'test-secret-key',  // Use a secure secret in production
      { expiresIn: '1h' }
    );
    
    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          email: user.email,
          role: user.role
        },
        token
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: error.message 
    });
  }
});

// Signup endpoint
router.post('/signup', async (req, res) => {
  try {
    const { email, password, role = 'user' } = req.body;
    
    // Check if user already exists
    if (users.some(u => u.email === email)) {
      return res.status(400).json({
        success: false,
        message: 'User already exists'
      });
    }
    
    // Create new user
    const newUser = {
      id: users.length + 1,
      email,
      password, // Plain text for testing
      role
    };
    
    users.push(newUser);
    
    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: {
        user: {
          id: newUser.id,
          email: newUser.email,
          role: newUser.role
        }
      }
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Auth middleware
const authMiddleware = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
    }
    
    const decoded = jwt.verify(token, 'test-secret-key');
    req.user = users.find(u => u.id === decoded.userId);
    
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'User not found' 
      });
    }
    
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ 
      success: false, 
      message: 'Invalid token', 
      error: error.message 
    });
  }
};

// Profile endpoint (protected)
router.get('/profile', authMiddleware, (req, res) => {
  res.json({
    success: true,
    message: 'Profile retrieved successfully',
    data: {
      user: {
        id: req.user.id,
        email: req.user.email,
        role: req.user.role
      }
    }
  });
});

module.exports = router; 