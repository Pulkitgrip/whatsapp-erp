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
 * GET /whatsapp/qr/image
 * Get QR code as image for user's connection
 */
router.get('/qr/image', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const forceNew = req.query.force === 'true';
    
    let status = await multiUserWhatsAppService.getUserConnectionStatus(userId);
    
    // If already connected
    if (status.connected) {
      return res.status(200).json({
        status: 200,
        message: 'WhatsApp is already connected',
        data: {
          connected: true,
          connectionState: status.connectionState
        }
      });
    }
    
    // Force new QR if requested or if QR is older than 2 minutes
    if (forceNew || !status.qrCode) {
      await multiUserWhatsAppService.forceNewQRCode(userId);
      // Wait a bit for QR generation
      await new Promise(resolve => setTimeout(resolve, 3000));
      status = await multiUserWhatsAppService.getUserConnectionStatus(userId);
      
      if (!status.qrCode) {
        return res.status(202).json({
          status: 202,
          message: 'QR code not ready yet. Please try again in a few seconds.',
          data: null
        });
      }
    }
    
    // Generate QR code image
    const QRCode = require('qrcode');
    const qrImageBuffer = await QRCode.toBuffer(status.qrCode, {
      type: 'png',
      width: 256,
      margin: 2
    });
    
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Length', qrImageBuffer.length);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.send(qrImageBuffer);
    
  } catch (error) {
    console.error(`Error generating QR image for user ${req.user?.id}:`, error);
    res.status(500).json({
      status: 500,
      message: 'Failed to generate QR code image',
      error: error.message
    });
  }
});

/**
 * GET /whatsapp/qr
 * Get QR code for user's connection
 */
router.get('/qr', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const forceNew = req.query.force === 'true';
  
  console.log('>>>>>>>>>>>>>>>>>>>>>>>>>>> qr code');

  try {
    // Get current connection status
    let status = await multiUserWhatsAppService.getUserConnectionStatus(userId);
    
    // If user is already connected
    if (status.connected) {
      return res.status(200).json({
        status: 200,
        message: 'WhatsApp is already connected',
        data: {
          connected: true,
          connectionState: status.connectionState
        }
      });
    }
    
    // If force new requested or no QR available, generate fresh QR
    if (forceNew || !status.qrCode) {
      console.log(`Generating fresh QR code for user ${userId}`);
      await multiUserWhatsAppService.forceNewQRCode(userId);
      
      // Wait for QR code generation with multiple attempts
      const maxAttempts = 15;
      const delayBetweenAttempts = 1000; // 1 second
      
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenAttempts));
        
        const updatedStatus = await multiUserWhatsAppService.getUserConnectionStatus(userId);
        
        if (updatedStatus.qrCode) {
          return res.status(200).json({
            status: 200,
            message: 'QR code generated successfully',
            data: { qrCode: updatedStatus.qrCode }
          });
        }
        
        if (updatedStatus.connected) {
          return res.status(200).json({
            status: 200,
            message: 'WhatsApp is already connected',
            data: {
              connected: true,
              connectionState: updatedStatus.connectionState
            }
          });
        }
        
        console.log(`QR code generation attempt ${attempt}/${maxAttempts} for user ${userId}`);
      }
      
      // If we reach here, QR code generation failed
      return res.status(202).json({
        status: 202,
        message: 'QR code generation is taking longer than expected. Please try again with ?force=true',
        data: { timeout: true }
      });
    }
    
    // Return existing QR code
    return res.status(200).json({
      status: 200,
      message: 'QR code retrieved successfully',
      data: { qrCode: status.qrCode }
    });
    
  } catch (error) {
    console.error(`Error getting QR code for user ${userId}:`, error);
    res.status(500).json({
      status: 500,
      message: 'Failed to get QR code',
      error: error.message
    });
  }
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
 * GET /whatsapp/debug/recent-messages
 * Get recent messages for debugging (admin only)
 */
router.get('/debug/recent-messages', authMiddleware, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        status: 403,
        message: 'Access denied. Admin role required.',
        data: null
      });
    }

    const { Conversation, Message } = require('../models/whatsappModels');
    
    // Get recent messages with sender info
    const recentMessages = await Message.findAll({
      include: [
        {
          model: User,
          attributes: ['id', 'name', 'phoneNumber', 'email']
        },
        {
          model: Conversation,
          attributes: ['id', 'whatsappChatId', 'ownerId']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: 20
    });

    // Get recent conversations
    const recentConversations = await Conversation.findAll({
      include: [
        {
          model: User,
          attributes: ['id', 'name', 'email'],
          foreignKey: 'ownerId'
        }
      ],
      order: [['updatedAt', 'DESC']],
      limit: 10
    });

    res.json({
      status: 200,
      message: 'Debug data retrieved successfully',
      data: {
        recentMessages,
        recentConversations,
        messageCount: await Message.count(),
        conversationCount: await Conversation.count()
      }
    });
  } catch (error) {
    console.error(`Error getting debug data:`, error);
    res.status(500).json({
      status: 500,
      message: 'Failed to get debug data',
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
 * Can create new user or update existing user with phone number
 */
router.post('/contact/add', authMiddleware, async (req, res) => {
  try {
    const { phoneNumber, name, email } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({
        status: 400,
        message: 'Phone number is required',
        data: null
      });
    }

    // Format phone number (remove + and spaces)
    const formattedPhone = phoneNumber.replace(/[\s+\-()]/g, '');

    let contact;

    // If email is provided, try to update existing user
    if (email) {
      contact = await User.findOne({ where: { email } });
      if (contact) {
        // Update existing user with phone number
        await contact.update({ 
          phoneNumber: formattedPhone,
          name: name || contact.name 
        });
        
        return res.json({
          status: 200,
          message: 'Existing user updated with phone number successfully',
          data: {
            id: contact.id,
            email: contact.email,
            name: contact.name,
            phoneNumber: contact.phoneNumber,
            role: contact.role,
            action: 'updated'
          }
        });
      }
    }

    // Check if phone number already exists
    contact = await User.findOne({ where: { phoneNumber: formattedPhone } });
    
    if (contact) {
      // Update name if provided and not set
      if (name && !contact.name) {
        await contact.update({ name });
      }
      
      return res.json({
        status: 200,
        message: 'Contact already exists',
        data: {
          id: contact.id,
          email: contact.email,
          name: contact.name,
          phoneNumber: contact.phoneNumber,
          role: contact.role,
          action: 'existing'
        }
      });
    }

    // Create new contact user
    contact = await User.create({
      email: email || `${formattedPhone}@whatsapp.local`,
      phoneNumber: formattedPhone,
      name: name || null,
      role: 'customer',
      password: 'whatsapp_contact' // Placeholder password for WhatsApp contacts
    });

    res.json({
      status: 200,
      message: 'Contact added successfully',
      data: {
        id: contact.id,
        email: contact.email,
        name: contact.name,
        phoneNumber: contact.phoneNumber,
        role: contact.role,
        action: 'created'
      }
    });
  } catch (error) {
    console.error(`Error adding contact for user ${req.user?.id}:`, error);
    
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({
        status: 400,
        message: 'Phone number or email already exists',
        error: 'Duplicate entry'
      });
    }
    
    res.status(500).json({
      status: 500,
      message: 'Failed to add contact',
      error: error.message
    });
  }
});

/**
 * GET /whatsapp/contacts
 * Get user's contact list (users with phone numbers)
 */
router.get('/contacts', authMiddleware, async (req, res) => {
  try {
    const contacts = await User.findAll({
      where: { 
        phoneNumber: { [require('sequelize').Op.ne]: null }
      },
      attributes: ['id', 'name', 'email', 'phoneNumber', 'role', 'createdAt'],
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
