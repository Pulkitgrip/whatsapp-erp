const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const winston = require('winston');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

class SocketService {
  constructor() {
    this.io = null;
    this.connectedUsers = new Map(); // userId -> socketId
    this.userRooms = new Map(); // userId -> Set of room names
  }

  initialize(server) {
    this.io = new Server(server, {
      cors: {
        origin: process.env.ALLOWED_ORIGINS?.split(',') || [
          "http://localhost:3000",
          "http://localhost:3001",
          "http://localhost:5173",
          "https://whatsapp-erp-frontend.vercel.app",
          "http://localhost:8000"
        ],
        methods: ["GET", "POST"],
        credentials: true
      },
      path: '/socket.io',
      transports: ['websocket', 'polling']
    });

    this.setupSocketHandlers();
    logger.info('Socket.IO server initialized');
  }

  setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      logger.info(`Socket connected: ${socket.id}`);

      // Authenticate user
      socket.on('authenticate', async (data) => {
        try {
          const { token, userId } = data;
          
          if (!token || !userId) {
            socket.emit('auth_error', { message: 'Token and userId required' });
            return;
          }

          // Verify JWT token
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          if (decoded.userId !== parseInt(userId)) {
            socket.emit('auth_error', { message: 'Invalid token' });
            return;
          }

          // Verify user exists
          const user = await User.findByPk(userId);
          if (!user) {
            socket.emit('auth_error', { message: 'User not found' });
            return;
          }

          // Store user connection
          socket.userId = userId;
          this.connectedUsers.set(userId, socket.id);
          
          // Join user's personal room
          const userRoom = `user_${userId}`;
          socket.join(userRoom);
          
          // Initialize user rooms if not exists
          if (!this.userRooms.has(userId)) {
            this.userRooms.set(userId, new Set());
          }
          this.userRooms.get(userId).add(userRoom);

          socket.emit('authenticated', { 
            userId, 
            message: 'Successfully authenticated',
            room: userRoom 
          });
          
          logger.info(`User ${userId} authenticated and joined room ${userRoom}`);
        } catch (error) {
          logger.error('Authentication error:', error);
          socket.emit('auth_error', { message: 'Authentication failed' });
        }
      });

      // Handle joining conversation rooms
      socket.on('join_conversation', (data) => {
        try {
          const { conversationId } = data;
          const userId = socket.userId;

          if (!userId) {
            socket.emit('error', { message: 'Not authenticated' });
            return;
          }

          const conversationRoom = `conversation_${conversationId}`;
          socket.join(conversationRoom);
          
          // Add to user rooms
          if (this.userRooms.has(userId)) {
            this.userRooms.get(userId).add(conversationRoom);
          }

          socket.emit('joined_conversation', { 
            conversationId, 
            room: conversationRoom 
          });
          
          logger.info(`User ${userId} joined conversation ${conversationId}`);
        } catch (error) {
          logger.error('Error joining conversation:', error);
          socket.emit('error', { message: 'Failed to join conversation' });
        }
      });

      // Handle leaving conversation rooms
      socket.on('leave_conversation', (data) => {
        try {
          const { conversationId } = data;
          const userId = socket.userId;

          if (!userId) {
            socket.emit('error', { message: 'Not authenticated' });
            return;
          }

          const conversationRoom = `conversation_${conversationId}`;
          socket.leave(conversationRoom);
          
          // Remove from user rooms
          if (this.userRooms.has(userId)) {
            this.userRooms.get(userId).delete(conversationRoom);
          }

          socket.emit('left_conversation', { 
            conversationId, 
            room: conversationRoom 
          });
          
          logger.info(`User ${userId} left conversation ${conversationId}`);
        } catch (error) {
          logger.error('Error leaving conversation:', error);
          socket.emit('error', { message: 'Failed to leave conversation' });
        }
      });

      // Handle sending messages through socket
      socket.on('send_message', async (data) => {
        try {
          const { to, message, conversationId } = data;
          const userId = socket.userId;

          if (!userId) {
            socket.emit('error', { message: 'Not authenticated' });
            return;
          }

          // Import WhatsApp service here to avoid circular dependency
          const multiUserWhatsAppService = require('./whatsappMultiUserService');
          
          // Send message through WhatsApp
          const result = await multiUserWhatsAppService.sendTextMessage(userId, to, message);
          
          if (result.success) {
            // Emit to conversation room
            if (conversationId) {
              this.io.to(`conversation_${conversationId}`).emit('message_sent', {
                messageId: result.messageId,
                to,
                message,
                timestamp: result.timestamp,
                senderId: userId,
                isOutgoing: true
              });
            }

            socket.emit('message_sent_success', result);
            logger.info(`Message sent successfully by user ${userId} to ${to}`);
          } else {
            socket.emit('message_send_error', { error: result.error });
            logger.error(`Failed to send message by user ${userId}: ${result.error}`);
          }
        } catch (error) {
          logger.error('Error sending message through socket:', error);
          socket.emit('message_send_error', { error: error.message });
        }
      });

      // Handle connection status updates
      socket.on('get_connection_status', async () => {
        try {
          const userId = socket.userId;
          if (!userId) {
            socket.emit('error', { message: 'Not authenticated' });
            return;
          }

          const multiUserWhatsAppService = require('./whatsappMultiUserService');
          const status = await multiUserWhatsAppService.getUserConnectionStatus(userId);
          
          socket.emit('connection_status', status);
        } catch (error) {
          logger.error('Error getting connection status:', error);
          socket.emit('error', { message: 'Failed to get connection status' });
        }
      });

      // Handle get contacts request
      socket.on('get_contacts', async () => {
        try {
          const userId = socket.userId;
          if (!userId) {
            socket.emit('error', { message: 'Not authenticated' });
            return;
          }

          const User = require('../models/user');
          const { Op } = require('sequelize');
          
          const contacts = await User.findAll({
            where: { 
              mobileNo: { [Op.ne]: null }
            },
            attributes: ['id', 'name', 'email', 'mobileNo', 'role', 'createdAt'],
            order: [['name', 'ASC']]
          });

          socket.emit('contacts_response', {
            success: true,
            data: contacts
          });
          
          logger.info(`Contacts sent to user ${userId}: ${contacts.length} contacts`);
        } catch (error) {
          logger.error('Error getting contacts:', error);
          socket.emit('contacts_response', {
            success: false,
            error: error.message
          });
        }
      });

      // Handle get messages between numbers
      socket.on('get_messages_between', async (data) => {
        try {
          const { fromNumber, toNumber, limit = 50, offset = 0 } = data;
          const userId = socket.userId;

          if (!userId) {
            socket.emit('error', { message: 'Not authenticated' });
            return;
          }

          if (!fromNumber || !toNumber) {
            socket.emit('messages_between_response', {
              success: false,
              error: 'Both fromNumber and toNumber are required'
            });
            return;
          }

          const { Conversation, Message } = require('../models/whatsappModels');
          const User = require('../models/user');
          const { Op } = require('sequelize');

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
          let conversationId = null;
          
          for (const conversation of conversations) {
            conversationId = conversation.id; // Get conversation ID for socket room joining
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
            conversationId: conversationId, // Include conversation ID for socket room joining
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

          socket.emit('messages_between_response', {
            success: true,
            data: response
          });

          logger.info(`Messages sent to user ${userId}: ${paginatedMessages.length}/${allMessages.length} messages between ${fromNumber} and ${toNumber}`);
        } catch (error) {
          logger.error('Error getting messages between numbers:', error);
          socket.emit('messages_between_response', {
            success: false,
            error: error.message
          });
        }
      });

      // Handle get QR code request
      socket.on('get_qr_code', async (data = {}) => {
        try {
          const userId = socket.userId;
          const forceNew = data.forceNew || false;

          if (!userId) {
            socket.emit('error', { message: 'Not authenticated' });
            return;
          }

          const multiUserWhatsAppService = require('./whatsappMultiUserService');
          let status = await multiUserWhatsAppService.getUserConnectionStatus(userId);

          console.log('status>>>>>>>>>>>>>>>>>>>', status);
          
          // If already connected
          if (status.connected) {
            socket.emit('qr_code_response', {
              success: true,
              data: {
                connected: true,
                connectionState: status.connectionState,
                message: 'WhatsApp is already connected'
              }
            });
            return;
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
                
                socket.emit('qr_code_response', {
                  success: true,
                  data: qrDataURL,
                  message: 'QR code generated successfully'
                });
                
                logger.info(`QR code sent to user ${userId} via socket`);
                return;
              }
              
              if (updatedStatus.connected) {
                socket.emit('qr_code_response', {
                  success: true,
                  data: {
                    connected: true,
                    connectionState: updatedStatus.connectionState,
                    message: 'WhatsApp is already connected'
                  }
                });
                return;
              }
            }
            
            // If we reach here, QR code generation failed
            socket.emit('qr_code_response', {
              success: false,
              error: 'QR code generation timed out. Please try again.',
              timeout: true
            });
            return;
          }
          
          // Convert existing QR code to base64 data URL
          const QRCode = require('qrcode');
          const qrDataURL = await QRCode.toDataURL(status.qrCode, {
            width: 256,
            margin: 2
          });
          
          socket.emit('qr_code_response', {
            success: true,
            data: qrDataURL,
            message: 'QR code retrieved successfully'
          });
          
          logger.info(`Existing QR code sent to user ${userId} via socket`);
        } catch (error) {
          logger.error('Error getting QR code via socket:', error);
          socket.emit('qr_code_response', {
            success: false,
            error: error.message
          });
        }
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        const userId = socket.userId;
        if (userId) {
          this.connectedUsers.delete(userId);
          this.userRooms.delete(userId);
          logger.info(`User ${userId} disconnected`);
        }
        logger.info(`Socket disconnected: ${socket.id}`);
      });

      // Handle errors
      socket.on('error', (error) => {
        logger.error('Socket error:', error);
      });
    });
  }

  // Emit new message to user's room
  emitNewMessage(ownerId, message) {
    try {
      const userRoom = `user_${ownerId}`;
      this.io.to(userRoom).emit('new_message', message);
      logger.info(`Emitted new message to user ${ownerId}`);
    } catch (error) {
      logger.error('Error emitting new message:', error);
    }
  }

  // Emit to conversation room
  emitToConversation(conversationId, event, data) {
    try {
      const conversationRoom = `conversation_${conversationId}`;
      this.io.to(conversationRoom).emit(event, data);
      logger.info(`Emitted ${event} to conversation ${conversationId}`);
    } catch (error) {
      logger.error(`Error emitting ${event} to conversation:`, error);
    }
  }

  // Emit WhatsApp connection status update
  emitConnectionStatus(userId, status) {
    try {
      const userRoom = `user_${userId}`;
      this.io.to(userRoom).emit('whatsapp_status_update', status);
      logger.info(`Emitted connection status update to user ${userId}`);
    } catch (error) {
      logger.error('Error emitting connection status:', error);
    }
  }

  // Get connected users count
  getConnectedUsersCount() {
    return this.connectedUsers.size;
  }

  // Check if user is connected
  isUserConnected(userId) {
    return this.connectedUsers.has(userId);
  }

  // Emit to specific user
  emitToUser(userId, event, data) {
    try {
      const userRoom = `user_${userId}`;
      this.io.to(userRoom).emit(event, data);
      logger.info(`Emitted ${event} to user ${userId}`);
    } catch (error) {
      logger.error(`Error emitting ${event} to user:`, error);
    }
  }
}

// Export singleton instance
const socketService = new SocketService();
module.exports = socketService; 