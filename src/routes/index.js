const express = require('express');
const router = express.Router();

// Import route modules
const authRoutes = require('./auth');
const productRoutes = require('./product');
const categoryRoutes = require('./category');
const whatsappRoutes = require('./whatsapp');
const userRoutes = require('./user');
const customerRoutes = require('./customer');
const sentimentRoutes = require('./sentiment');
const stockRoutes = require('./stock');
const orderRoutes = require('./order');

// Health check for individual route groups
router.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'All API routes are operational',
    timestamp: new Date().toISOString(),
    routes: {
      auth: '/api/auth/*',
      products: '/api/products',
      categories: '/api/categories',
      whatsapp: '/api/whatsapp/*',
      sentiment: '/api/sentiment/*',
      stocks: '/api/stocks/*',
      orders: '/api/orders/*'
    }
  });
});

// Use route modules
router.use('/auth', authRoutes);
router.use('/products', productRoutes);
router.use('/categories', categoryRoutes);
router.use('/whatsapp', whatsappRoutes);
router.use('/users', userRoutes);
router.use('/customers', customerRoutes);
router.use('/sentiment', sentimentRoutes);
router.use('/stocks', stockRoutes);
router.use('/orders', orderRoutes);

// API documentation
router.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      message: 'WhatsApp ERP API v2.0 - Multi-User',
      version: '2.0.0',
      features: [
        'Multi-user WhatsApp connections',
        'Database-based auth storage (Vercel compatible)',
        'Per-user conversation management',
        'Contact-based message filtering',
        'Persistent session management'
      ],
      endpoints: {
        authentication: {
          'POST /api/auth/signup': 'Register new user',
          'POST /api/auth/login': 'User login',
          'GET /api/auth/profile': 'Get user profile (requires auth)'
        },
        products: {
          'GET /api/products': 'List all products',
          'POST /api/products': 'Create new product (requires auth)',
          'GET /api/products/:id': 'Get specific product',
          'PUT /api/products/:id': 'Update product (requires auth)',
          'DELETE /api/products/:id': 'Delete product (requires auth)'
        },
        categories: {
          'GET /api/categories': 'List all categories',
          'POST /api/categories': 'Create new category (requires auth)'
        },
        whatsapp: {
          connection: {
            'POST /api/whatsapp/connect': 'Connect user WhatsApp (requires auth)',
            'POST /api/whatsapp/disconnect': 'Disconnect user WhatsApp (requires auth)',
            'GET /api/whatsapp/status': 'Get connection status (requires auth)',
            'GET /api/whatsapp/qr': 'Get QR code via SSE (requires auth)'
          },
          messaging: {
            'POST /api/whatsapp/send-message': 'Send message (requires auth)',
            'POST /api/whatsapp/send-catalog': 'Send product catalog (requires auth)'
          },
          conversations: {
            'GET /api/whatsapp/conversations': 'Get user conversations (requires auth)',
            'GET /api/whatsapp/conversations/messages/:conversationId': 'Get conversation messages (requires auth)',
            'GET /api/whatsapp/messages/between': 'Get messages between two phone numbers (requires auth)'
          },
          contacts: {
            'GET /api/whatsapp/contacts': 'Get contact list (requires auth)',
            'POST /api/whatsapp/contact/add': 'Add contact for message storage (requires auth)'
          },
          admin: {
            'GET /api/whatsapp/sessions/active': 'Get all active sessions (admin only)'
          }
        },
        sentiment: {
          'GET /api/sentiment/info': 'Get n8n workflow information',
          'GET /api/sentiment/health': 'Check n8n service health',
          'POST /api/sentiment/analyze': 'Analyze sentiment for conversation/content (requires auth)',
          'POST /api/sentiment/trigger': 'Trigger n8n workflow with custom data (requires auth)',
          'POST /api/sentiment/analyze-between': 'Analyze sentiment between two phone numbers (requires auth)'
        }
      },
      notes: [
        'All WhatsApp endpoints require JWT authentication',
        'Messages are only stored from contacts in the database',
        'Each user maintains their own WhatsApp connection',
        'Auth data is stored in database for Vercel compatibility',
        'Sentiment analysis endpoints integrate with n8n workflow',
        'Configure N8N_BASE_URL environment variable for n8n instance'
      ]
    },
    timestamp: Date.now()
  });
});

module.exports = router;
