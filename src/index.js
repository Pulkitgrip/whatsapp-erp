require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createServer } = require('http');
const { Server } = require('socket.io');
const errorHandler = require('./middleware/errorHandler');
const createError = require('http-errors');
const fs = require('fs');
const path = require('path');

const app = express();
const server = createServer(app);

// Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: [
      'http://localhost:5173',
      'https://erp-whatsapp.vercel.app',
      'http://localhost:3000',
      'http://localhost:3001'
    ],
    methods: ['GET', 'POST'],
    credentials: true
  },
  path: '/socket.io'
});

// Set Socket.IO instance in WhatsApp service for real-time events
const whatsappService = require('./services/whatsappMultiUserService');
whatsappService.setSocketIO(io);

// Socket.IO authentication middleware
const socketAuthMiddleware = require('./middleware/socketAuthMiddleware');

// Apply authentication middleware to socket connections
io.use(socketAuthMiddleware);

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('🔌 New socket connection:', socket.id);
  
  // Handle authentication
  socket.on('authenticate', async (data) => {
    try {
      console.log('🔐 Socket authentication attempt:', data);
      // Authentication is handled by middleware, so if we reach here, it's authenticated
      socket.emit('authenticated', { 
        success: true, 
        message: 'Socket authenticated successfully',
        userId: socket.userId 
      });
    } catch (error) {
      console.error('❌ Socket authentication error:', error);
      socket.emit('auth_error', { 
        success: false, 
        message: 'Authentication failed' 
      });
    }
  });

  // Handle WhatsApp QR code requests
  socket.on('get_qr_code', async (data) => {
    try {
      console.log('📱 QR code request from socket:', socket.id, 'for user:', socket.userId);
      
      // Import WhatsApp service (singleton instance)
      const whatsappService = require('./services/whatsappMultiUserService');
      
      // Get QR code for the authenticated user
      const qrCode = await whatsappService.getQrCode(socket.userId, data.forceNew);
      
      if (qrCode && qrCode.qrCode) {
        // Convert QR code string to data URL
        const QRCode = require('qrcode');
        try {
          const qrDataUrl = await QRCode.toDataURL(qrCode.qrCode);
          socket.emit('qr_code_response', {
            success: true,
            data: qrDataUrl
          });
        } catch (qrError) {
          console.error('Error generating QR code data URL:', qrError);
          socket.emit('qr_code_response', {
            success: false,
            error: 'Failed to generate QR code image'
          });
        }
      } else if (qrCode && qrCode.connected) {
        socket.emit('qr_code_response', {
          success: true,
          data: {
            connected: true,
            connectionState: 'open'
          }
        });
      } else {
        socket.emit('qr_code_response', {
          success: false,
          error: 'Failed to generate QR code'
        });
      }
    } catch (error) {
      console.error('❌ QR code error:', error);
      socket.emit('qr_code_response', {
        success: false,
        error: error.message || 'Failed to get QR code'
      });
    }
  });

  // Handle connection status requests
  socket.on('get_connection_status', async () => {
    try {
      console.log('📊 Connection status request from socket:', socket.id, 'for user:', socket.userId);
      
      const whatsappService = require('./services/whatsappMultiUserService');
      
      const status = await whatsappService.getConnectionStatus(socket.userId);
      
      socket.emit('connection_status', status);
    } catch (error) {
      console.error('❌ Connection status error:', error);
      socket.emit('connection_status', {
        connected: false,
        connectionState: 'error',
        error: error.message
      });
    }
  });

  // Handle contacts requests
  socket.on('get_contacts', async () => {
    try {
      console.log('👥 Contacts request from socket:', socket.id, 'for user:', socket.userId);
      
      const whatsappService = require('./services/whatsappMultiUserService');
      console.log({whatsappService})
      const contacts = await whatsappService.getContacts(socket.userId);
      console.log({contacts})
      
      socket.emit('contacts_response', {
        success: true,
        data: contacts
      });
    } catch (error) {
      console.error('❌ Contacts error:', error);
      socket.emit('contacts_response', {
        success: false,
        error: error.message || 'Failed to get contacts'
      });
    }
  });

  // Handle messages between requests
  socket.on('get_messages_between', async (data) => {
    try {
      console.log('💬 Messages request from socket:', socket.id, 'for user:', socket.userId);
      
      const whatsappService = require('./services/whatsappMultiUserService');
      
      const messages = await whatsappService.getMessagesBetween(
        socket.userId,
        data.fromNumber,
        data.toNumber,
        data.limit,
        data.offset
      );
      
      socket.emit('messages_between_response', {
        success: true,
        data: messages
      });
    } catch (error) {
      console.error('❌ Messages error:', error);
      socket.emit('messages_between_response', {
        success: false,
        error: error.message || 'Failed to get messages'
      });
    }
  });

  // Handle message sending
  socket.on('send_message', async (data) => {
    try {
      console.log('📤 Send message request from socket:', socket.id, 'for user:', socket.userId);
      
      const whatsappService = require('./services/whatsappMultiUserService');
      
      const result = await whatsappService.sendMessage(
        socket.userId,
        data.to,
        data.message,
        data.conversationId
      );
      
      if (result.success) {
        socket.emit('message_sent_success', result);
      } else {
        socket.emit('message_send_error', result);
      }
    } catch (error) {
      console.error('❌ Send message error:', error);
      socket.emit('message_send_error', {
        success: false,
        error: error.message || 'Failed to send message'
      });
    }
  });

  // Handle conversation joining
  socket.on('join_conversation', (data) => {
    try {
      console.log('👥 Join conversation request:', data);
      socket.join(data.conversationId);
      socket.emit('joined_conversation', {
        success: true,
        conversationId: data.conversationId
      });
    } catch (error) {
      console.error('❌ Join conversation error:', error);
      socket.emit('joined_conversation', {
        success: false,
        error: error.message
      });
    }
  });

  // Handle conversation leaving
  socket.on('leave_conversation', (data) => {
    try {
      console.log('👋 Leave conversation request:', data);
      socket.leave(data.conversationId);
      socket.emit('left_conversation', {
        success: true,
        conversationId: data.conversationId
      });
    } catch (error) {
      console.error('❌ Leave conversation error:', error);
      socket.emit('left_conversation', {
        success: false,
        error: error.message
      });
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('🔌 Socket disconnected:', socket.id);
  });
});

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// CORS configuration - allow all origins
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:5173',
      'https://erp-whatsapp.vercel.app',
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:8000'
    ];
    
    if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
      callback(null, true);
    } else {
      callback(null, true); // Allow all origins for now
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Import routes
const whatsappRoutes = require('./routes/whatsapp');
const indexRoutes = require('./routes/index');
// Import services
const sessionCleanupService = require('./services/sessionCleanupService');

// Register routes directly
// app.use('/api/auth', authRoutes);
// app.use('/api/products', productRoutes);
// app.use('/api/categories', categoryRoutes);
app.use('/api/', indexRoutes);
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
    success: true,
    data: {
      name: "WhatsApp Bot API",
      version: "1.0.0",
      description: "API for WhatsApp automation using Baileys SDK",
      endpoints: {
        "GET /health": "Health check",
        "GET /api/whatsapp/status": "Get WhatsApp connection status",
        "POST /api/whatsapp/connect": "Connect to WhatsApp (requires API key)",
        "POST /api/whatsapp/disconnect": "Disconnect from WhatsApp (requires API key)",
        "GET /api/whatsapp/qr": "Get QR code for connection (Server-Sent Events)",
        "POST /api/whatsapp/send-message": "Send a message (requires API key)",
        "POST /api/whatsapp/send-order": "Send order details (requires API key)",
        "GET /api/erp/products": "Get products (ERP)",
        "POST /api/erp/orders": "Create order (ERP)",
        "GET /api/erp/analytics": "Get business analytics (ERP)"
      },
      authentication: {
        type: "API Key",
        header: "x-api-key or Authorization: Bearer <token>",
        note: "API key authentication is required for most endpoints"
      }
    },
    timestamp: Date.now()
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
  const PORT = process.env.PORT || 8000;
  server.listen(PORT, () => {
    console.log(`
🚀 WhatsApp ERP Server v2.0 is running!
==========================================
📡 Server: http://localhost:${PORT}
📖 API Documentation: http://localhost:${PORT}/
🔌 Socket.IO: http://localhost:${PORT}/socket.io
�� Health Check: http://localhost:${PORT}/health

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
