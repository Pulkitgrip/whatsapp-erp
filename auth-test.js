const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
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

// Routes
app.get('/', (req, res) => {
  res.json({
    message: 'Auth Test API',
    endpoints: {
      '/login': 'POST - Login with email and password',
      '/protected': 'GET - Test protected route (requires token)',
    }
  });
});

app.post('/login', async (req, res) => {
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

// Protected route middleware
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

// Protected route
app.get('/protected', authMiddleware, (req, res) => {
  res.json({
    success: true,
    message: 'You have access to this protected route',
    data: {
      user: {
        id: req.user.id,
        email: req.user.email,
        role: req.user.role
      }
    }
  });
});

// Start server
const PORT = 3001;
app.listen(PORT, () => {
  console.log(`
🔐 Auth Test Server running on port ${PORT}
📝 Available endpoints:
  • POST http://localhost:${PORT}/login
  • GET http://localhost:${PORT}/protected (requires token)

🧪 Test commands:
  • Login: curl -X POST http://localhost:${PORT}/login -H "Content-Type: application/json" -d '{"email":"admin@company.com","password":"admin123"}'
  • Protected: curl -X GET http://localhost:${PORT}/protected -H "Authorization: Bearer YOUR_TOKEN"
  `);
}); 