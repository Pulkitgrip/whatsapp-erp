require('dotenv').config();
const express = require('express');
const cors = require('cors');
const errorHandler = require('./middleware/errorHandler');
const createError = require('http-errors');
const fs = require('fs');
const path = require('path');

const app = express();

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// CORS configuration
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://your-frontend-domain.com' // Replace with your actual frontend domain
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Import routes
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/product');
const categoryRoutes = require('./routes/category');
const whatsappRoutes = require('./routes/whatsapp');

// Import services
const sessionCleanupService = require('./services/sessionCleanupService');

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/whatsapp', whatsappRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'WhatsApp ERP API',
    version: '2.0.0'
  });
});

// Session cleanup stats endpoint (admin only)
app.get('/api/admin/cleanup-stats', require('./middleware/authMiddleware'), async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        status: 403,
        message: 'Access denied. Admin role required.',
        data: null
      });
    }

    const stats = await sessionCleanupService.getCleanupStats();
    res.json({
      status: 200,
      message: 'Cleanup statistics retrieved successfully',
      data: stats
    });
  } catch (error) {
    console.error('Error getting cleanup stats:', error);
    res.status(500).json({
      status: 500,
      message: 'Failed to get cleanup statistics',
      error: error.message
    });
  }
});

// Root endpoint with API documentation
app.get('/', (req, res) => {
  res.json({
    message: 'WhatsApp ERP API Server',
    version: '2.0.0',
    features: [
      'Multi-user WhatsApp connections',
      'Persistent chat storage',
      'Product catalog management',
      'Order processing via WhatsApp',
      'User authentication and authorization',
      'Automatic session cleanup and management'
    ],
    endpoints: {
      auth: '/api/auth/login, /api/auth/signup, /api/auth/profile',
      products: '/api/products (GET, POST)',
      categories: '/api/categories (GET, POST)',
      whatsapp: {
        connection: '/api/whatsapp/connect, /api/whatsapp/disconnect, /api/whatsapp/status',
        messaging: '/api/whatsapp/send-message, /api/whatsapp/send-catalog',
        conversations: '/api/whatsapp/conversations, /api/whatsapp/conversations/messages/:conversationId',
        contacts: '/api/whatsapp/contacts, /api/whatsapp/contact/add',
        qr: '/api/whatsapp/qr'
      },
      admin: '/api/admin/cleanup-stats'
    },
    documentation: 'Visit /health for service status'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    status: 404,
    message: 'Endpoint not found',
    availableEndpoints: [
      '/api/auth/*',
      '/api/products',
      '/api/categories',
      '/api/whatsapp/*',
      '/api/admin/*',
      '/health'
    ]
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Global Error Handler:', error);
  
  res.status(error.status || 500).json({
    status: error.status || 500,
    message: error.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
});

// Initialize database
const sequelize = require('./sequelize');

async function initializeDatabase() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully');
    
    // Sync database models
    await sequelize.sync({ alter: false });
    console.log('✅ Database models synchronized');
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  }
}

// Initialize the database before starting the server
initializeDatabase().then(() => {
  const PORT = process.env.PORT || 5000;
  const server = app.listen(PORT, () => {
    console.log(`
🚀 WhatsApp ERP Server v2.0 is running!
==========================================
📡 Server: http://localhost:${PORT}
📖 API Documentation: http://localhost:${PORT}/
🏥 Health Check: http://localhost:${PORT}/health

📝 Multi-User WhatsApp Features:
• Each user can connect their own WhatsApp
• Persistent connections with database storage
• Messages only stored from known contacts
• Individual conversation management
• User-specific QR codes and connection status
• Automatic session cleanup and monitoring

📱 New API Endpoints:
• POST /api/whatsapp/connect - Connect user's WhatsApp
• GET /api/whatsapp/status - Check connection status
• GET /api/whatsapp/qr - Get user's QR code (SSE)
• GET /api/whatsapp/conversations - Get user's chats
• POST /api/whatsapp/contact/add - Add contact to whitelist
• GET /api/admin/cleanup-stats - Session cleanup statistics (admin)

🔐 Authentication Required:
All WhatsApp endpoints now require JWT authentication.

🤖 Bot Features (per user):
• Product catalog browsing
• Order placement via chat
• Order status tracking
• Automated customer responses

🔧 Session Management:
• Automatic cleanup of stale connections
• Database-based auth storage for Vercel
• Memory and database state synchronization

To get started:
1. Create account: POST /api/auth/signup
2. Login: POST /api/auth/login
3. Connect WhatsApp: POST /api/whatsapp/connect
4. Get QR code: GET /api/whatsapp/qr
5. Add contacts: POST /api/whatsapp/contact/add
==========================================
    `);

    // Start session cleanup service
    try {
      sessionCleanupService.start();
      console.log('🧹 Session cleanup service started');
    } catch (error) {
      console.error('❌ Failed to start session cleanup service:', error);
    }
  });

  // Handle server errors
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`❌ Port ${PORT} is already in use`);
      process.exit(1);
    } else {
      console.error('❌ Server error:', error);
      process.exit(1);
    }
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('\n🔄 Received SIGTERM, shutting down gracefully...');
  
  try {
    // Stop session cleanup service
    sessionCleanupService.stop();
    console.log('🧹 Session cleanup service stopped');
    
    // Close database connection
    await sequelize.close();
    console.log('🗄️ Database connection closed');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during graceful shutdown:', error);
    process.exit(1);
  }
});

process.on('SIGINT', async () => {
  console.log('\n🔄 Received SIGINT, shutting down gracefully...');
  
  try {
    // Stop session cleanup service
    sessionCleanupService.stop();
    console.log('🧹 Session cleanup service stopped');
    
    // Close database connection
    await sequelize.close();
    console.log('🗄️ Database connection closed');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during graceful shutdown:', error);
    process.exit(1);
  }
});

module.exports = app;
