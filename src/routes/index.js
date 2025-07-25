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
        'POST /auth/signup': 'Register new user',
        'POST /auth/login': 'User login',
        'GET /auth/profile': 'Get user profile (requires auth)'
      },
      products: {
        'GET /products': 'List all products',
        'POST /products': 'Create new product (requires auth)',
        'GET /products/:id': 'Get specific product',
        'PUT /products/:id': 'Update product (requires auth)',
        'DELETE /products/:id': 'Delete product (requires auth)'
      },
      categories: {
        'GET /categories': 'List all categories',
        'POST /categories': 'Create new category (requires auth)'
      },
      whatsapp: {
        connection: {
          'POST /whatsapp/connect': 'Connect user WhatsApp (requires auth)',
          'POST /whatsapp/disconnect': 'Disconnect user WhatsApp (requires auth)',
          'GET /whatsapp/status': 'Get connection status (requires auth)',
          'GET /whatsapp/qr': 'Get QR code via SSE (requires auth)'
        },
        messaging: {
          'POST /whatsapp/send-message': 'Send message (requires auth)',
          'POST /whatsapp/send-catalog': 'Send product catalog (requires auth)'
        },
        conversations: {
          'GET /whatsapp/conversations': 'Get user conversations (requires auth)',
          'GET /whatsapp/conversations/messages/:conversationId': 'Get conversation messages (requires auth)'
        },
        contacts: {
          'GET /whatsapp/contacts': 'Get contact list (requires auth)',
          'POST /whatsapp/contact/add': 'Add contact for message storage (requires auth)'
        },
        admin: {
          'GET /whatsapp/sessions/active': 'Get all active sessions (admin only)'
        }
      }
    },
    notes: [
      'All WhatsApp endpoints require JWT authentication',
      'Messages are only stored from contacts in the database',
      'Each user maintains their own WhatsApp connection',
      'Auth data is stored in database for Vercel compatibility'
    ]
  });
});

module.exports = router;
