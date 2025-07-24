const express = require('express');
const router = express.Router();
const multiUserWhatsAppService = require('../services/whatsappMultiUserService');
const { BotResponse, WhatsAppSession } = require('../models/whatsappModels');
const authMiddleware = require('../middleware/authMiddleware');
const User = require('../models/user');

/**
 * POST /whatsapp/connect
 * Connect user's WhatsApp account
 */
router.post('/connect', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const status = await multiUserWhatsAppService.connectUser(userId);
    
    res.json({
      status: 200,
      message: 'WhatsApp connection initiated successfully',
      data: status
    });
  } catch (error) {
    console.error(`Error connecting WhatsApp for user ${req.user?.id}:`, error);
    res.status(500).json({
      status: 500,
      message: 'Failed to connect to WhatsApp',
      error: error.message
    });
  }
});

/**
 * POST /whatsapp/disconnect
 * Disconnect user's WhatsApp account
 */
router.post('/disconnect', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    await multiUserWhatsAppService.disconnectUser(userId);
    
    res.json({
      status: 200,
      message: 'Disconnected from WhatsApp successfully',
      data: null
    });
  } catch (error) {
    console.error(`Error disconnecting WhatsApp for user ${req.user?.id}:`, error);
    res.status(500).json({
      status: 500,
      message: 'Failed to disconnect from WhatsApp',
      error: error.message
    });
  }
});

/**
 * GET /whatsapp/status
 * Get user's WhatsApp connection status
 */
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const status = await multiUserWhatsAppService.getUserConnectionStatus(userId);
    
    res.json({
      status: 200,
      message: 'Connection status retrieved successfully',
      data: status
    });
  } catch (error) {
    console.error(`Error getting WhatsApp status for user ${req.user?.id}:`, error);
    res.status(500).json({
      status: 500,
      message: 'Failed to get connection status',
      error: error.message
    });
  }
});

/**
 * GET /whatsapp/qr
 * Get QR code for user's connection (Server-Sent Events)
 */
router.get('/qr', authMiddleware, (req, res) => {
  const userId = req.user.id;
  
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  // Get current status and send QR if available
  multiUserWhatsAppService.getUserConnectionStatus(userId).then(status => {
    if (status.qrCode) {
      res.write(`data: ${JSON.stringify({ qrCode: status.qrCode })}\n\n`);
    }
  });

  // Set callback for new QR codes
  multiUserWhatsAppService.setQRCodeCallback(userId, (qr) => {
    res.write(`data: ${JSON.stringify({ qrCode: qr })}\n\n`);
  });

  // Clean up on client disconnect
  req.on('close', () => {
    multiUserWhatsAppService.setQRCodeCallback(userId, () => {});
  });
});

/**
 * POST /whatsapp/send-message
 * Send a message from user's WhatsApp
 */
router.post('/send-message', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { to, message } = req.body;

    if (!to || !message) {
      return res.status(400).json({
        status: 400,
        message: 'Phone number and message are required',
        data: null
      });
    }

    // Check if user's WhatsApp is connected
    const connectionStatus = await multiUserWhatsAppService.getUserConnectionStatus(userId);
    if (!connectionStatus.connected) {
      return res.status(400).json({
        status: 400,
        message: 'WhatsApp is not connected. Please connect first.',
        data: null
      });
    }

    const result = await multiUserWhatsAppService.sendTextMessage(userId, to, message);
    
    res.status(result.success ? 200 : 400).json({
      status: result.success ? 200 : 400,
      message: result.success ? 'Message sent successfully' : 'Failed to send message',
      data: result.success ? result : null,
      error: result.success ? null : result.error
    });
  } catch (error) {
    console.error(`Error sending message for user ${req.user?.id}:`, error);
    res.status(500).json({
      status: 500,
      message: 'Failed to send message',
      error: error.message
    });
  }
});

/**
 * POST /whatsapp/send-catalog
 * Send product catalog from user's WhatsApp
 */
router.post('/send-catalog', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { to } = req.body;

    if (!to) {
      return res.status(400).json({
        status: 400,
        message: 'Phone number is required',
        data: null
      });
    }

    // Check if user's WhatsApp is connected
    const connectionStatus = await multiUserWhatsAppService.getUserConnectionStatus(userId);
    if (!connectionStatus.connected) {
      return res.status(400).json({
        status: 400,
        message: 'WhatsApp is not connected. Please connect first.',
        data: null
      });
    }

    const catalog = await multiUserWhatsAppService.generateProductCatalog();
    const result = await multiUserWhatsAppService.sendTextMessage(userId, to, catalog);
    
    res.status(result.success ? 200 : 400).json({
      status: result.success ? 200 : 400,
      message: result.success ? 'Catalog sent successfully' : 'Failed to send catalog',
      data: result.success ? result : null,
      error: result.success ? null : result.error
    });
  } catch (error) {
    console.error(`Error sending catalog for user ${req.user?.id}:`, error);
    res.status(500).json({
      status: 500,
      message: 'Failed to send catalog',
      error: error.message
    });
  }
});

/**
 * GET /whatsapp/conversations
 * Get user's WhatsApp conversations
 */
router.get('/conversations', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { Conversation, Message } = require('../models/whatsappModels');
    
    const conversations = await Conversation.findAll({
      where: { ownerId: userId },
      include: [{
        model: Message,
        limit: 1,
        order: [['createdAt', 'DESC']],
        include: [{
          model: User,
          attributes: ['id', 'name', 'phoneNumber']
        }]
      }],
      order: [['updatedAt', 'DESC']]
    });

    res.json({
      status: 200,
      message: 'Conversations retrieved successfully',
      data: conversations
    });
  } catch (error) {
    console.error(`Error getting conversations for user ${req.user?.id}:`, error);
    res.status(500).json({
      status: 500,
      message: 'Failed to get conversations',
      error: error.message
    });
  }
});

/**
 * GET /whatsapp/conversations/:conversationId/messages
 * Get messages from a specific conversation
 */
router.get('/conversations/messages/:conversationId', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const conversationId = req.params.conversationId;
    const { Conversation, Message } = require('../models/whatsappModels');
    
    // Verify conversation belongs to user
    const conversation = await Conversation.findOne({
      where: { 
        id: conversationId,
        ownerId: userId 
      }
    });

    if (!conversation) {
      return res.status(404).json({
        status: 404,
        message: 'Conversation not found',
        data: null
      });
    }

    const messages = await Message.findAll({
      where: { conversationId: conversationId },
      include: [{
        model: User,
        attributes: ['id', 'name', 'phoneNumber']
      }],
      order: [['createdAt', 'ASC']]
    });

    res.json({
      status: 200,
      message: 'Messages retrieved successfully',
      data: {
        conversation,
        messages
      }
    });
  } catch (error) {
    console.error(`Error getting messages for user ${req.user?.id}:`, error);
    res.status(500).json({
      status: 500,
      message: 'Failed to get messages',
      error: error.message
    });
  }
});

/**
 * GET /whatsapp/sessions/active
 * Get all active WhatsApp sessions (admin only)
 */
router.get('/sessions/active', authMiddleware, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        status: 403,
        message: 'Access denied. Admin role required.',
        data: null
      });
    }

    const activeConnections = multiUserWhatsAppService.getActiveConnections();
    const sessions = await WhatsAppSession.findAll({
      where: { isConnected: true },
      include: [{
        model: User,
        attributes: ['id', 'name', 'email', 'phoneNumber']
      }]
    });

    res.json({
      status: 200,
      message: 'Active sessions retrieved successfully',
      data: {
        activeConnections,
        sessions
      }
    });
  } catch (error) {
    console.error('Error getting active sessions:', error);
    res.status(500).json({
      status: 500,
      message: 'Failed to get active sessions',
      error: error.message
    });
  }
});

/**
 * POST /whatsapp/contact/add
 * Add a contact to user's contact list (for storing messages)
 */
router.post('/contact/add', authMiddleware, async (req, res) => {
  try {
    const { phoneNumber, name } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({
        status: 400,
        message: 'Phone number is required',
        data: null
      });
    }

    // Check if user already exists
    let contact = await User.findOne({ where: { phoneNumber } });
    
    if (!contact) {
      // Create new contact user
      contact = await User.create({
        phoneNumber,
        name: name || null,
        role: 'customer'
      });
    } else if (name && !contact.name) {
      // Update name if provided and not set
      await contact.update({ name });
    }

    res.json({
      status: 200,
      message: 'Contact added successfully',
      data: contact
    });
  } catch (error) {
    console.error(`Error adding contact for user ${req.user?.id}:`, error);
    res.status(500).json({
      status: 500,
      message: 'Failed to add contact',
      error: error.message
    });
  }
});

/**
 * GET /whatsapp/contacts
 * Get user's contact list
 */
router.get('/contacts', authMiddleware, async (req, res) => {
  try {
    const contacts = await User.findAll({
      where: { 
        role: 'customer',
        phoneNumber: { [require('sequelize').Op.ne]: null }
      },
      attributes: ['id', 'name', 'phoneNumber', 'createdAt'],
      order: [['name', 'ASC']]
    });

    res.json({
      status: 200,
      message: 'Contacts retrieved successfully',
      data: contacts
    });
  } catch (error) {
    console.error(`Error getting contacts for user ${req.user?.id}:`, error);
    res.status(500).json({
      status: 500,
      message: 'Failed to get contacts',
      error: error.message
    });
  }
});

module.exports = router;
