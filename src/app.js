require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

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

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'WhatsApp ERP API',
    endpoints: {
      auth: '/api/auth/*',
      whatsapp: '/api/whatsapp/*'
    }
  });
});

// Auth routes
app.get('/api/auth', (req, res) => {
  res.json({
    success: true,
    message: 'Auth routes are working',
    endpoints: {
      'POST /api/auth/login': 'Login with email and password',
      'POST /api/auth/signup': 'Register a new user',
      'GET /api/auth/profile': 'Get user profile (protected)'
    }
  });
});

// Login endpoint
app.post('/api/auth/login', async (req, res) => {
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
app.get('/api/auth/profile', authMiddleware, (req, res) => {
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

// WhatsApp status endpoint (protected)
app.get('/api/whatsapp/status', authMiddleware, (req, res) => {
  res.json({
    success: true,
    data: {
      connected: false,
      connectionState: 'disconnected',
      message: 'WhatsApp is not connected'
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: `Route ${req.originalUrl} not found`,
    timestamp: Date.now()
  });
});

// Start server
const PORT = 3002;
app.listen(PORT, () => {
  console.log(`
🚀 Simple WhatsApp ERP API Server running on port ${PORT}
📝 Available endpoints:
  • GET http://localhost:${PORT}/api/auth
  • POST http://localhost:${PORT}/api/auth/login
  • GET http://localhost:${PORT}/api/auth/profile (protected)
  • GET http://localhost:${PORT}/api/whatsapp/status (protected)
  `);
});

module.exports = app; 