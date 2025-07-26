const express = require('express');
const router = express.Router();
const multiUserWhatsAppService = require('../services/whatsappMultiUserService');
const { BotResponse, WhatsAppSession } = require('../models/whatsappModels');
const authMiddleware = require('../middleware/authMiddleware');
const User = require('../models/user');
const { Op } = require('sequelize');
const Message = require('../models/whatsappModels').Message;
const Conversation = require('../models/whatsappModels').Conversation;

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
    else{
      return res.status(200).json({
        status: 200,
        message: 'WhatsApp is not connected',
        data: {
          connected: false,
          connectionState: status.connectionState
        }
      });
    }
    
    // // If force new requested or no QR available, generate fresh QR
    // if (forceNew || !status.qrCode) {
    //   console.log(`Generating fresh QR code for user ${userId}`);
    //   await multiUserWhatsAppService.forceNewQRCode(userId);
      
    //   // Wait for QR code generation with multiple attempts
    //   const maxAttempts = 15;
    //   const delayBetweenAttempts = 1000; // 1 second
      
    //   for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    //     await new Promise(resolve => setTimeout(resolve, delayBetweenAttempts));
        
    //     const updatedStatus = await multiUserWhatsAppService.getUserConnectionStatus(userId);
        
    //     if (updatedStatus.qrCode) {
    //       // Convert QR code to base64 data URL
    //       const QRCode = require('qrcode');
    //       const qrDataURL = await QRCode.toDataURL(updatedStatus.qrCode, {
    //         width: 256,
    //         margin: 2
    //       });
          
    //       return res.status(200).json({
    //         status: 200,
    //         message: 'QR code generated successfully',
    //         data: qrDataURL
    //       });
    //     }
        
    //     if (updatedStatus.connected) {
    //       return res.status(200).json({
    //         status: 200,
    //         message: 'WhatsApp is already connected',
    //         data: {
    //           connected: true,
    //           connectionState: updatedStatus.connectionState
    //         }
    //       });
    //     }
        
    //     console.log(`QR code generation attempt ${attempt}/${maxAttempts} for user ${userId}`);
    //   }
      
    //   // If we reach here, QR code generation failed
    //   return res.status(202).json({
    //     status: 202,
    //     message: 'QR code generation is taking longer than expected. Please try again with ?force=true',
    //     data: { timeout: true }
    //   });
    // }
    
    // // Convert existing QR code to base64 data URL
    // const QRCode = require('qrcode');
    // const qrDataURL = await QRCode.toDataURL(status.qrCode, {
    //   width: 256,
    //   margin: 2
    // });
    
    // // Return only the base64 data
    // return res.status(200).json({
    //   status: 200,
    //   message: 'QR code retrieved successfully',
    //   data: qrDataURL
    // });
    
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
 * GET /whatsapp/qr/base64
 * Get QR code as base64 data URL
 */
router.get('/qr/base64', authMiddleware, async (req, res) => {
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
    
    // Force new QR if requested or if QR is not available
    if (forceNew || !status.qrCode) {
      await multiUserWhatsAppService.forceNewQRCode(userId);
      
      // Wait for QR code generation with multiple attempts
      const maxAttempts = 15;
      const delayBetweenAttempts = 1000; // 1 second
      
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenAttempts));
        
        const updatedStatus = await multiUserWhatsAppService.getUserConnectionStatus(userId);
        
        if (updatedStatus.qrCode) {
          // Convert QR code to base64 data URL
          const QRCode = require('qrcode');
          const qrDataURL = await QRCode.toDataURL(updatedStatus.qrCode, {
            width: 256,
            margin: 2
          });
          
          // Return only the base64 data
          return res.status(200).json({
            status: 200,
            message: 'QR code generated successfully',
            data: qrDataURL
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
      }
      
      return res.status(202).json({
        status: 202,
        message: 'QR code generation is taking longer than expected. Please try again with ?force=true',
        data: { timeout: true }
      });
    }
    
    // Convert existing QR code to base64 data URL
    const QRCode = require('qrcode');
    const qrDataURL = await QRCode.toDataURL(status.qrCode, {
      width: 256,
      margin: 2
    });
    
    // Return only the base64 data
    return res.status(200).json({
      status: 200,
      message: 'QR code retrieved successfully',
      data: qrDataURL
    });
    
  } catch (error) {
    console.error(`Error generating QR base64 for user ${req.user?.id}:`, error);
    res.status(500).json({
      status: 500,
      message: 'Failed to generate QR code base64',
      error: error.message
    });
  }
});

/**
 * POST /whatsapp/send-message
 * Send a message to a specific user and save to database
 */
router.post('/send-message', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { to, message, conversationId } = req.body;

    console.log('Send message request:', { userId, to, message, conversationId });

    if (!to || !message) {
      return res.status(400).json({
        success: false,
        error: 'Phone number and message are required'
      });
    }

    // Check if user's WhatsApp is connected
    const connectionStatus = await multiUserWhatsAppService.getUserConnectionStatus(userId);
    if (!connectionStatus.connected) {
      return res.status(400).json({
        success: false,
        error: 'WhatsApp is not connected. Please connect first.'
      });
    }

    // Clean the phone number
    const cleanTo = to.replace(/^\+/, '').replace(/\s/g, '');
    const formattedTo = `${cleanTo}@s.whatsapp.net`;

    // Send message via WhatsApp
    const result = await multiUserWhatsAppService.sendTextMessage(userId, formattedTo, message);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Message sent successfully',
        data: {
          messageId: result.messageId,
          timestamp: result.timestamp
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error || 'Failed to send message'
      });
    }
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /whatsapp/send-test-message
 * Send a test message to verify WhatsApp functionality
 */
router.post('/send-test-message', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { to } = req.body;
    
    // Validate required fields
    if (!to) {
      return res.status(400).json({
        status: 400,
        message: 'Recipient phone number (to) is required',
        data: null
      });
    }
    
    // Format phone number
    let formattedNumber = to;
    if (!to.includes('@')) {
      // Remove any non-digit characters except +
      formattedNumber = to.replace(/[^\d+]/g, '');
      
      // Ensure it has country code
      if (!formattedNumber.startsWith('+')) {
        formattedNumber = '+' + formattedNumber;
      }
    }
    
    const testMessage = `🧪 This is a test message from WhatsApp ERP system.\n\nTime: ${new Date().toISOString()}\nSent by user ID: ${userId}`;
    console.log(`Sending test message to ${formattedNumber} from user ${userId}`);
    
    // Send message
    const result = await multiUserWhatsAppService.sendTextMessage(userId, formattedNumber, testMessage);
    
    if (result.success) {
      return res.status(200).json({
        status: 200,
        message: 'Test message sent successfully',
        data: {
          messageId: result.messageId,
          timestamp: result.timestamp,
          testMessage
        }
      });
    } else {
      return res.status(500).json({
        status: 500,
        message: `Failed to send test message: ${result.error}`,
        data: null
      });
    }
  } catch (error) {
    console.error('Error sending WhatsApp test message:', error);
    return res.status(500).json({
      status: 500,
      message: `Error sending WhatsApp test message: ${error.message}`,
      data: null
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
          attributes: ['id', 'name', 'mobileNo']
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
        attributes: ['id', 'name', 'mobileNo']
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
 * GET /whatsapp/messages/between
 * Get all messages between two phone numbers
 * Query params: fromNumber, toNumber
 * Optional: limit, offset for pagination
 */
router.get('/messages/between', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { fromNumber, toNumber, limit = 50000, offset = 0 } = req.query;
    const { Conversation, Message } = require('../models/whatsappModels');
    const { Op } = require('sequelize');

    // Validate required parameters
    if (!fromNumber || !toNumber) {
      return res.status(400).json({
        status: 400,
        message: 'Both fromNumber and toNumber are required',
        data: null
      });
    }

    // Helper function to normalize phone numbers
    const normalizePhoneNumber = (phoneNumber) => {
      return phoneNumber.replace(/^\+/, '').replace(/\s/g, '');
    };

    // Normalize the phone numbers
    const normalizedFromNumber = normalizePhoneNumber(fromNumber);
    const normalizedToNumber = normalizePhoneNumber(toNumber);

    // Create WhatsApp JIDs
    const fromJid = normalizedFromNumber + '@s.whatsapp.net';
    const toJid = normalizedToNumber + '@s.whatsapp.net';

    // Find users by mobile numbers
    const fromUser = await User.findOne({
      where: {
        mobileNo: {
          [Op.or]: [
            '+' + normalizedFromNumber,
            normalizedFromNumber
          ]
        }
      }
    });

    const toUser = await User.findOne({
      where: {
        mobileNo: {
          [Op.or]: [
            '+' + normalizedToNumber,
            normalizedToNumber
          ]
        }
      }
    });

    // Find conversations between these numbers for this user
    const conversations = await Conversation.findAll({
      where: {
        ownerId: userId,
        whatsappChatId: {
          [Op.in]: [fromJid, toJid]
        }
      },
      include: [{
        model: Message,
        include: [{
          model: User,
          attributes: ['id', 'name', 'mobileNo', 'email']
        }],
        order: [['createdAt', 'ASC']]
      }]
    });

    // Collect all messages from both directions
    let allMessages = [];
    
    for (const conversation of conversations) {
      if (conversation.Messages) {
        allMessages = allMessages.concat(conversation.Messages);
      }
    }

    // Sort messages by creation time
    allMessages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    // Apply pagination
    const paginatedMessages = allMessages.slice(parseInt(offset), parseInt(offset) + parseInt(limit));

    // Format response with additional context
    const response = {
      fromNumber: fromNumber,
      toNumber: toNumber,
      fromUser: fromUser ? {
        id: fromUser.id,
        name: fromUser.name,
        email: fromUser.email,
        mobileNo: fromUser.mobileNo
      } : null,
      toUser: toUser ? {
        id: toUser.id,
        name: toUser.name,
        email: toUser.email,
        mobileNo: toUser.mobileNo
      } : null,
      totalMessages: allMessages.length,
      currentPage: Math.floor(parseInt(offset) / parseInt(limit)) + 1,
      totalPages: Math.ceil(allMessages.length / parseInt(limit)),
      messagesPerPage: parseInt(limit),
      messages: paginatedMessages.map(msg => ({
        id: msg.id,
        messageId: msg.messageId,
        content: msg.content,
        messageType: msg.messageType,
        isOutgoing: msg.isOutgoing,
        status: msg.status,
        createdAt: msg.createdAt,
        updatedAt: msg.updatedAt,
        sender: msg.User ? {
          id: msg.User.id,
          name: msg.User.name,
          mobileNo: msg.User.mobileNo,
          email: msg.User.email
        } : null,
        conversationId: msg.conversationId
      }))
    };

    res.json({
      status: 200,
      message: `Retrieved ${paginatedMessages.length} messages between ${fromNumber} and ${toNumber}`,
      data: response
    });

  } catch (error) {
    console.error(`Error getting messages between numbers for user ${req.user?.id}:`, error);
    res.status(500).json({
      status: 500,
      message: 'Failed to retrieve messages between numbers',
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
          attributes: ['id', 'name', 'mobileNo', 'email']
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
        attributes: ['id', 'name', 'email', 'mobileNo']
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
 * GET /whatsapp/debug/status
 * Get debug information about WhatsApp connections and bot status
 */
router.get('/debug/status', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const whatsappService = req.app.get('whatsappService');
    
    // Get connection status
    const connectionStatus = await whatsappService.getUserConnectionStatus(userId);
    
    // Get active connections
    const activeConnections = whatsappService.getActiveConnections();
    
    // Get recent messages
    const { Message } = require('../models/whatsappModels');
    const recentMessages = await Message.findAll({
      limit: 10,
      order: [['createdAt', 'DESC']],
      attributes: ['id', 'content', 'isOutgoing', 'createdAt']
    });
    
    return res.status(200).json({
      status: 200,
      message: 'Debug information retrieved',
      data: {
        connectionStatus,
        activeConnectionsCount: activeConnections.length,
        isCurrentUserConnected: activeConnections.includes(userId),
        recentMessages
      }
    });
  } catch (error) {
    console.error('Error getting debug status:', error);
    return res.status(500).json({
      status: 500,
      message: `Error getting debug status: ${error.message}`,
      data: null
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
    const { mobileNo, name, email } = req.body;

    if (!mobileNo) {
      return res.status(400).json({
        status: 400,
        message: 'Phone number is required',
        data: null
      });
    }

    // Format phone number (remove + and spaces)
    const formattedPhone = mobileNo.replace(/[\s+\-()]/g, '');

    let contact;

    // If email is provided, try to update existing user
    if (email) {
      contact = await User.findOne({ where: { email } });
      if (contact) {
        // Update existing user with phone number
        await contact.update({ 
          mobileNo: formattedPhone,
          name: name || contact.name 
        });
        
        return res.json({
          status: 200,
          message: 'Existing user updated with phone number successfully',
          data: {
            id: contact.id,
            email: contact.email,
            name: contact.name,
            mobileNo: contact.mobileNo,
            role: contact.role,
            action: 'updated'
          }
        });
      }
    }

    // Check if phone number already exists
    contact = await User.findOne({ where: { mobileNo: formattedPhone } });
    
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
          mobileNo: contact.mobileNo,
          role: contact.role,
          action: 'existing'
        }
      });
    }

    // Create new contact user
    contact = await User.create({
      email: email || `${formattedPhone}@whatsapp.local`,
      mobileNo: formattedPhone,
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
        mobileNo: contact.mobileNo,
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
        mobileNo: { [require('sequelize').Op.ne]: null }
      },
      attributes: ['id', 'name', 'email', 'mobileNo', 'role', 'createdAt'],
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

/**
 * GET /whatsapp/messages/between?fromNumber=...&toNumber=...
 * Get all messages between two numbers from the database
 */
router.get('/messages/between', authMiddleware, async (req, res) => {
  try {
    const { fromNumber, toNumber } = req.query;
    console.log('Fetching messages between:', { fromNumber, toNumber, userId: req.user?.id });
    
    if (!fromNumber || !toNumber) {
      return res.status(400).json({ success: false, error: 'fromNumber and toNumber are required' });
    }

    // Find all conversations where the whatsappChatId matches either number
    const chatIds = [
      `${fromNumber}@s.whatsapp.net`,
      `${toNumber}@s.whatsapp.net`
    ];

    console.log('Looking for conversations with chatIds:', chatIds);

    // Find all conversations between these two numbers
    const conversations = await Conversation.findAll({
      where: {
        whatsappChatId: { [Op.in]: chatIds },
        conversationType: 'individual'
      }
    });

    console.log('Found conversations:', conversations.length, conversations.map(c => ({ id: c.id, chatId: c.whatsappChatId })));

    if (!conversations.length) {
      console.log('No conversations found, returning empty array');
      return res.json({ success: true, data: [] });
    }

    // Get all conversation IDs
    const conversationIds = conversations.map(c => c.id);
    console.log('Conversation IDs:', conversationIds);

    // Find all messages for these conversations
    const messages = await Message.findAll({
      where: {
        conversationId: { [Op.in]: conversationIds }
      },
      order: [['createdAt', 'ASC']], // Use createdAt field for ordering
      attributes: ['id', 'conversationId', 'senderId', 'messageId', 'messageType', 'content', 'isOutgoing', 'status', 'createdAt'] // Remove timestamp field
    });

    console.log('Found messages:', messages.length, messages.map(m => ({ id: m.id, content: m.content?.substring(0, 50) })));

    res.json({ success: true, data: messages });
  } catch (error) {
    console.error('Error fetching messages between:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /whatsapp/messages/conversation/:conversationId
 * Get all messages for a specific conversation
 */
router.get('/messages/conversation/:conversationId', authMiddleware, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    console.log('Getting messages for conversation:', conversationId, 'user:', userId);

    // Verify the conversation belongs to the user
    const conversation = await Conversation.findOne({
      where: {
        id: conversationId,
        ownerId: userId
      }
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found'
      });
    }

    // Get all messages for this conversation
    const messages = await Message.findAll({
      where: {
        conversationId: conversationId
      },
      order: [['createdAt', 'ASC']], // Use createdAt field for ordering
      include: [
        {
          model: User,
          as: 'sender',
          attributes: ['id', 'name', 'email', 'mobileNo']
        }
      ]
    });

    res.json({
      success: true,
      data: {
        conversation: {
          id: conversation.id,
          whatsappChatId: conversation.whatsappChatId,
          conversationType: conversation.conversationType,
          isGroup: conversation.isGroup
        },
        messages: messages.map(msg => ({
          id: msg.id,
          content: msg.content,
          senderId: msg.senderId,
          isOutgoing: msg.isOutgoing,
          messageType: msg.messageType,
          createdAt: msg.createdAt,
          sender: msg.sender ? {
            id: msg.sender.id,
            name: msg.sender.name,
            email: msg.sender.email,
            mobileNo: msg.sender.mobileNo
          } : null
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching conversation messages:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /whatsapp/test-incoming-message
 * Test endpoint to simulate incoming messages (for development only)
 */
router.post('/test-incoming-message', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { fromNumber, message } = req.body;

    if (!fromNumber || !message) {
      return res.status(400).json({
        success: false,
        error: 'fromNumber and message are required'
      });
    }

    console.log('Testing incoming message:', { userId, fromNumber, message });

    // Create a mock WhatsApp message
    const mockMsg = {
      key: {
        remoteJid: `${fromNumber}@s.whatsapp.net`,
        id: `test_${Date.now()}_${Math.random()}`
      },
      message: {
        conversation: message
      }
    };

    // Process the mock message
    const whatsappService = require('../services/whatsappMultiUserService');
    await whatsappService.handleIncomingMessage(userId, mockMsg);

    res.json({
      success: true,
      message: 'Test message processed successfully'
    });
  } catch (error) {
    console.error('Error processing test message:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
