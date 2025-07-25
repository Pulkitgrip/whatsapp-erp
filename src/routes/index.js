const express = require('express');
const router = express.Router();

// Import route modules
const authRoutes = require('./auth');
const productRoutes = require('./product');
const categoryRoutes = require('./category');
const whatsappRoutes = require('./whatsapp');
const userRoutes = require('./user');
const customerRoutes = require('./customer');

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
      whatsapp: '/api/whatsapp/*'
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
            'GET /api/whatsapp/conversations/messages/:conversationId': 'Get conversation messages (requires auth)'
          },
          contacts: {
            'GET /api/whatsapp/contacts': 'Get contact list (requires auth)',
            'POST /api/whatsapp/contact/add': 'Add contact for message storage (requires auth)'
          },
          admin: {
            'GET /api/whatsapp/sessions/active': 'Get all active sessions (admin only)'
          }
        }
      },
      notes: [
        'All WhatsApp endpoints require JWT authentication',
        'Messages are only stored from contacts in the database',
        'Each user maintains their own WhatsApp connection',
        'Auth data is stored in database for Vercel compatibility'
      ]
    },
    timestamp: Date.now()
  });
});

module.exports = router;
