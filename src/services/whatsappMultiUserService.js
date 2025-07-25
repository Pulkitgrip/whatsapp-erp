const { Boom } = require("@hapi/boom");
const makeWASocket = require("@whiskeysockets/baileys").default;
const {
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  AuthenticationState,
} = require("@whiskeysockets/baileys");
const qrcode = require("qrcode-terminal");
const winston = require('winston');
const pino = require('pino');

// Import models
const { WhatsAppSession, Conversation, Message, BotResponse, Order, OrderItem } = require('../models/whatsappModels');
const Product = require('../models/product');
const User = require('../models/user');

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

class MultiUserWhatsAppService {
  constructor() {
    this.connections = new Map(); // userId -> connection object
    this.qrCodeCallbacks = new Map(); // userId -> callback function
    this.maxReconnectAttempts = parseInt(process.env.MAX_RECONNECT_ATTEMPTS) || 5;
    this.reconnectInterval = parseInt(process.env.RECONNECT_INTERVAL) || 5000;
  }

  // Temporary file-based auth state (will switch to database later)
  async makeDatabaseAuthState(userId) {
    const { useMultiFileAuthState } = require('@whiskeysockets/baileys');
    const fs = require('fs');
    const path = require('path');
    
    // Create auth directory if it doesn't exist
    const authDir = path.join(process.cwd(), 'auth_sessions', `user_${userId}`);
    if (!fs.existsSync(authDir)) {
      fs.mkdirSync(authDir, { recursive: true });
    }
    
    logger.info(`Using file-based auth state for user ${userId} at ${authDir}`);
    
    // Use built-in file-based auth state
    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    
    return { state, saveCreds };
  }

  async connectUser(userId) {
    if (this.connections.has(userId)) {
      const connection = this.connections.get(userId);
      if (connection.isConnecting) {
        logger.info(`Connection attempt already in progress for user ${userId}`);
        return connection.connectionStatus;
      }
    }

    const connectionData = {
      sock: null,
      connectionStatus: {
        connected: false,
        connectionState: 'close',
        userId
      },
      reconnectAttempts: 0,
      isConnecting: true,
      restartAttempts: 0
    };

    this.connections.set(userId, connectionData);

    try {
      logger.info(`Initializing WhatsApp connection for user ${userId}...`);
      
      // Clear any existing session data that might be corrupted
      await this.updateSessionStatus(userId, {
        isConnected: false,
        connectionState: 'connecting',
        qrCode: null
      });
      
      const { state, saveCreds } = await this.makeDatabaseAuthState(userId);
      const { version } = await fetchLatestBaileysVersion();

      logger.info(`Creating WhatsApp socket for user ${userId} with version ${version}`);

      connectionData.sock = makeWASocket({
        version,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys) // Remove pino logger like in working example
        },
        // Use exact browser config from working example
        browser: ['WhatsApp Bot API', 'Chrome', '10.0'],
        syncFullHistory: false,
        markOnlineOnConnect: true, // Set to true like working example
        logger: pino({ level: 'silent' }),
        shouldIgnoreJid: jid => !jid.includes('@s.whatsapp.net'),
        getMessage: async () => {
          return {
            conversation: 'hello' // Match working example
          };
        },
        printQRInTerminal: false,
        generateHighQualityLinkPreview: true,
        // Use working example timeouts
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        // Better auth handling like working example
        fireInitQueries: true,
        emitOwnEvents: false,
        // Add patchMessageBeforeSending from working example
        patchMessageBeforeSending: (message) => {
          return message;
        },
        // Add error handling options
        retryRequestDelayMs: 1000,
        maxMsgRetryCount: 5
      });

      logger.info(`WhatsApp socket created successfully for user ${userId}`);
      await this.setupEventHandlers(userId, saveCreds);
      
      return connectionData.connectionStatus;
    } catch (error) {
      logger.error(`Failed to initialize WhatsApp connection for user ${userId}:`, error);
      
      // Update session status to reflect error
      await this.updateSessionStatus(userId, {
        isConnected: false,
        connectionState: 'error',
        qrCode: null
      });
      
      this.connections.delete(userId);
      throw new Error(`Connection initialization failed: ${error.message}`);
    } finally {
      if (connectionData) {
        connectionData.isConnecting = false;
      }
    }
  }

  async setupEventHandlers(userId, saveCreds) {
    const connectionData = this.connections.get(userId);
    if (!connectionData || !connectionData.sock) return;

    const sock = connectionData.sock;

    // Handle connection updates  
    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr, isNewLogin, receivedPendingNotifications } = update;
      
      logger.info(`Connection update for user ${userId}:`, { 
        connection, 
        qr: !!qr,
        isNewLogin,
        receivedPendingNotifications,
        lastDisconnect: lastDisconnect?.error?.message,
        statusCode: (lastDisconnect?.error)?.output?.statusCode
      });

      // Handle QR code - ensure it's fresh and not reused
      if (qr) {
        // Clear any existing QR code first
        connectionData.connectionStatus.qrCode = null;
        await this.updateSessionStatus(userId, {
          qrCode: null,
          connectionState: 'generating_qr'
        });
        
        // Set new QR code
        connectionData.connectionStatus.qrCode = qr;
        logger.info(`New QR Code generated for user ${userId}`);
        
        // Save QR code to database
        await this.updateSessionStatus(userId, {
          qrCode: qr,
          connectionState: 'waiting_for_qr'
        });

        // Notify callback if exists
        const callback = this.qrCodeCallbacks.get(userId);
        if (callback) {
          callback(qr);
        }
      }

      // Handle new login - this happens after QR scan but before connection opens
      if (isNewLogin && connection === undefined) {
        logger.info(`New login detected for user ${userId}, waiting for connection to open...`);
        connectionData.connectionStatus.connectionState = 'authenticating';
        
        await this.updateSessionStatus(userId, {
          connectionState: 'authenticating',
          qrCode: null
        });
        return; // Wait for the next update with connection: "open"
      }

      if (connection === "close") {
        const statusCode = (lastDisconnect?.error)?.output?.statusCode;
        const errorMessage = lastDisconnect?.error?.message || 'Unknown error';
        
        logger.info(`Connection closed for user ${userId}: statusCode=${statusCode}, error=${errorMessage}`);
        
        // Simplified disconnect handling like working example
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        
        // Handle restart required after QR scan (this is normal behavior)
        if (statusCode === DisconnectReason.restartRequired) {
          logger.info(`Restart required for user ${userId} after QR scan - this is normal`);
          
          // Clear the old socket properly
          connectionData.sock = null;
          
          // Don't increment restart attempts too much as this is expected
          if (connectionData.restartAttempts < 3) {
            connectionData.restartAttempts++;
            connectionData.connectionStatus.connected = false;
            connectionData.connectionStatus.connectionState = 'restarting';
            
            await this.updateSessionStatus(userId, {
              isConnected: false,
              connectionState: 'restarting',
              qrCode: null
            });
            
            logger.info(`Creating new socket for user ${userId} after restart (attempt ${connectionData.restartAttempts})`);
            
            // Wait a moment for WhatsApp to process
            setTimeout(async () => {
              try {
                // Create new socket with updated auth state
                await this.createNewSocketAfterRestart(userId, saveCreds);
              } catch (error) {
                logger.error(`Failed to create new socket after restart for user ${userId}:`, error);
                // Try normal reconnect as fallback
                this.connectUser(userId).catch(err => {
                  logger.error(`Fallback reconnect failed for user ${userId}:`, err);
                });
              }
            }, 3000);
            return;
          } else {
            logger.warn(`Too many restart attempts for user ${userId}, falling back to normal reconnect`);
          }
        }

        connectionData.connectionStatus.connected = false;
        connectionData.connectionStatus.connectionState = 'close';
        connectionData.connectionStatus.lastDisconnect = errorMessage;

        await this.updateSessionStatus(userId, {
          isConnected: false,
          connectionState: 'close',
          qrCode: null
        });

        logger.warn(`Connection closed for user ${userId}: ${errorMessage}, reconnecting: ${shouldReconnect}`);

        if (shouldReconnect && connectionData.reconnectAttempts < this.maxReconnectAttempts) {
          connectionData.reconnectAttempts++;
          logger.info(`Reconnection attempt ${connectionData.reconnectAttempts}/${this.maxReconnectAttempts} for user ${userId}`);
          
          setTimeout(() => {
            this.connectUser(userId).catch(error => {
              logger.error(`Reconnection failed for user ${userId}:`, error);
            });
          }, this.reconnectInterval);
        } else if (shouldReconnect && connectionData.reconnectAttempts >= this.maxReconnectAttempts) {
          logger.error(`Max reconnection attempts reached for user ${userId}`);
        } else if (!shouldReconnect) {
          await this.clearUserAuthState(userId);
        }
      } else if (connection === "open") {
        connectionData.connectionStatus.connected = true;
        connectionData.connectionStatus.connectionState = 'open';
        connectionData.connectionStatus.qrCode = undefined;
        connectionData.reconnectAttempts = 0;
        connectionData.restartAttempts = 0;
        
        await this.updateSessionStatus(userId, {
          isConnected: true,
          connectionState: 'open',
          lastConnectedAt: new Date(),
          qrCode: null
        });
        
        logger.info(`WhatsApp connection established successfully for user ${userId}`);
        
        // If this was a new login, log it
        if (isNewLogin) {
          logger.info(`New login completed for user ${userId}`);
        }
      } else if (connection === "connecting") {
        logger.info(`WhatsApp connecting for user ${userId}`);
        connectionData.connectionStatus.connectionState = 'connecting';
        
        await this.updateSessionStatus(userId, {
          connectionState: 'connecting'
        });
      } else if (connection === undefined && !isNewLogin) {
        // Handle undefined connection state without isNewLogin
        logger.info(`Connection state undefined for user ${userId}, waiting for proper state...`);
      } else {
        // Log any other connection states we might be missing
        logger.warn(`Unhandled connection state for user ${userId}: connection=${connection}, isNewLogin=${isNewLogin}`);
      }
    });

    // Handle credential updates with better error handling
    sock.ev.on("creds.update", async () => {
      try {
        await saveCreds();
        logger.debug(`Credentials updated and saved for user ${userId}`);
      } catch (error) {
        logger.error(`Failed to save credentials for user ${userId}:`, error);
      }
    });

    // Add socket error handling
    sock.ev.on('connection.update', (update) => {
      if (update.lastDisconnect?.error) {
        logger.error(`Socket error for user ${userId}:`, update.lastDisconnect.error);
      }
    });

    // Handle messages
    sock.ev.on("messages.upsert", async ({ messages }) => {
      for (const msg of messages) {
        if (!msg.key.fromMe && msg.message) {
          await this.handleIncomingMessage(userId, msg);
        }
      }
    });
  }

  async handleIncomingMessage(ownerId, msg) {
    try {
      const phoneNumber = msg.key.remoteJid.replace('@s.whatsapp.net', '');
      const messageContent = msg.message?.conversation || 
                           msg.message?.extendedTextMessage?.text || 
                           'Media message';
      
      logger.info(`Received message from ${phoneNumber} to user ${ownerId}: ${messageContent}`);

      // Check if sender exists in our database by phone number
      let sender = await User.findOne({ 
        where: { phoneNumber: phoneNumber } 
      });

      if (!sender) {
        logger.info(`Message from ${phoneNumber} ignored - sender not in database (not a registered user)`);
        return; // Only process messages from users in our database
      }

      logger.info(`Processing message from registered user ${sender.name || sender.email} (${phoneNumber})`);

      // Save incoming message
      await this.saveIncomingMessage(ownerId, sender.id, msg, phoneNumber, messageContent);

      // Process bot response only if sender is in database
      if (messageContent !== 'Media message') {
        await this.processBotResponse(ownerId, sender.id, phoneNumber, messageContent, msg.key.remoteJid);
      }

    } catch (error) {
      logger.error(`Error handling incoming message for user ${ownerId}:`, error);
    }
  }

  async saveIncomingMessage(ownerId, senderId, msg, phoneNumber, content) {
    try {
      // Get or create conversation for this owner
      let conversation = await Conversation.findOne({ 
        where: { 
          whatsappChatId: msg.key.remoteJid,
          ownerId: ownerId 
        } 
      });
      
      if (!conversation) {
        conversation = await Conversation.create({
          whatsappChatId: msg.key.remoteJid,
          ownerId: ownerId,
          isGroup: msg.key.remoteJid.includes('@g.us')
        });
      }

      // Save message
      await Message.create({
        conversationId: conversation.id,
        senderId: senderId,
        messageId: msg.key.id,
        content: content,
        messageType: 'text',
        isOutgoing: false
      });

      logger.info(`Message saved for conversation ${conversation.id}`);

    } catch (error) {
      logger.error(`Error saving incoming message for owner ${ownerId}:`, error);
    }
  }

  async processBotResponse(ownerId, senderId, phoneNumber, messageContent, chatId) {
    try {
      const lowerContent = messageContent.toLowerCase();
      let response = null;

      // Check for specific bot responses
      const botResponse = await BotResponse.findOne({
        where: { 
          triggerKeyword: lowerContent,
          isActive: true 
        },
        order: [['priority', 'DESC']]
      });

      if (botResponse) {
        response = botResponse.responseText;
      } else if (lowerContent.includes('catalog') || lowerContent.includes('products')) {
        response = await this.generateProductCatalog();
      } else if (lowerContent.includes('order')) {
        response = await this.handleOrderRequest(senderId, messageContent);
      } else if (lowerContent.includes('status') || lowerContent.includes('my order')) {
        response = await this.getOrderStatus(senderId);
      } else if (lowerContent.includes('hello') || lowerContent.includes('hi')) {
        response = '👋 Hello! Welcome to our store. Type "catalog" to see our products or "help" for assistance.';
      } else if (lowerContent.includes('help')) {
        response = `🤖 *How can I help you?*

📋 Type "catalog" - View our products
🛒 Type "ORDER [Product]:[Qty]" - Place an order
📦 Type "status" - Check order status
💬 Type "contact" - Get contact info

Example: ORDER Gaming Laptop:1`;
      } else {
        response = 'Thank you for your message! Type "help" to see what I can do for you.';
      }

      if (response) {
        await this.sendTextMessage(ownerId, phoneNumber + '@s.whatsapp.net', response);
      }

    } catch (error) {
      logger.error(`Error processing bot response for owner ${ownerId}:`, error);
    }
  }

  async generateProductCatalog() {
    try {
      const products = await Product.findAll({
        include: [{
          model: require('../models/category'),
          attributes: ['name']
        }],
        limit: 10
      });

      if (products.length === 0) {
        return '🛍️ *Product Catalog*\n\nNo products available at the moment.';
      }

      let catalog = '🛍️ *Product Catalog*\n\n';
      
      products.forEach((product, index) => {
        catalog += `${index + 1}. *${product.name}*\n`;
        catalog += `   💰 Price: $${product.unitPrice.toFixed(2)}\n`;
        catalog += `   📁 Category: ${product.Category?.name || 'Uncategorized'}\n`;
        catalog += `   🆔 ID: ${product.id}\n\n`;
      });

      catalog += '🛒 To order, reply: "ORDER [Product Name or ID]:[Quantity]"\nExample: "ORDER Gaming Laptop:1"';

      return catalog;
    } catch (error) {
      logger.error('Error generating product catalog:', error);
      return 'Sorry, I encountered an error fetching the product catalog.';
    }
  }

  async handleOrderRequest(senderId, messageContent) {
    try {
      const orderMatch = messageContent.match(/order\s+(.+)/i);
      if (!orderMatch) {
        return '❌ Invalid order format. Use: "ORDER [Product Name or ID]:[Quantity]"';
      }

      const orderText = orderMatch[1];
      const items = orderText.split(',');
      const orderItems = [];
      let totalAmount = 0;

      for (const item of items) {
        const parts = item.trim().split(':');
        if (parts.length !== 2) continue;

        const productIdentifier = parts[0].trim();
        const quantity = parseInt(parts[1].trim());

        if (isNaN(quantity) || quantity <= 0) continue;

        // Find product by name or ID
        let product = null;
        if (!isNaN(productIdentifier)) {
          product = await Product.findByPk(productIdentifier);
        } else {
          product = await Product.findOne({
            where: { name: { [require('sequelize').Op.iLike]: `%${productIdentifier}%` } }
          });
        }

        if (product) {
          const itemTotal = product.unitPrice * quantity;
          totalAmount += itemTotal;
          orderItems.push({
            productId: product.id,
            quantity: quantity,
            unitPrice: product.unitPrice,
            total: itemTotal,
            productName: product.name
          });
        }
      }

      if (orderItems.length === 0) {
        return '❌ No valid products found. Please check product names/IDs and try again.';
      }

      // Create order
      const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
      
      const order = await Order.create({
        orderNumber: orderNumber,
        customerId: senderId,
        totalAmount: totalAmount,
        status: 'pending',
        notes: `Order placed via WhatsApp: ${messageContent}`
      });

      // Create order items
      for (const item of orderItems) {
        await OrderItem.create({
          orderId: order.id,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.total
        });
      }

      let confirmation = `✅ *Order Placed Successfully!*\n\n`;
      confirmation += `📋 Order #: ${orderNumber}\n`;
      confirmation += `📅 Date: ${new Date().toDateString()}\n\n`;
      confirmation += `📦 Items:\n`;
      
      orderItems.forEach(item => {
        confirmation += `• ${item.productName} x${item.quantity} - $${item.total.toFixed(2)}\n`;
      });
      
      confirmation += `\n💰 *Total: $${totalAmount.toFixed(2)}*\n`;
      confirmation += `📊 Status: PENDING\n\n`;
      confirmation += `Thank you for your order! We'll process it shortly.`;

      return confirmation;

    } catch (error) {
      logger.error('Error handling order request:', error);
      return 'Sorry, I encountered an error processing your order. Please try again.';
    }
  }

  async getOrderStatus(senderId) {
    try {
      const orders = await Order.findAll({
        where: { customerId: senderId },
        include: [{
          model: OrderItem,
          include: [Product]
        }],
        order: [['createdAt', 'DESC']],
        limit: 5
      });

      if (orders.length === 0) {
        return '📦 No orders found. Type "catalog" to browse our products!';
      }

      let statusMessage = '📦 *Your Recent Orders*\n\n';
      
      orders.forEach((order, index) => {
        statusMessage += `${index + 1}. Order #${order.orderNumber}\n`;
        statusMessage += `   📅 ${order.orderDate.toDateString()}\n`;
        statusMessage += `   💰 $${order.totalAmount.toFixed(2)}\n`;
        statusMessage += `   📊 ${order.status.toUpperCase()}\n\n`;
      });

      return statusMessage;

    } catch (error) {
      logger.error('Error getting order status:', error);
      return 'Sorry, I encountered an error checking your orders.';
    }
  }

  async sendTextMessage(userId, to, message) {
    const connectionData = this.connections.get(userId);
    
    if (!connectionData || !connectionData.sock || !connectionData.connectionStatus.connected) {
      // Try to reconnect if not connected
      if (!connectionData?.isConnecting) {
        await this.connectUser(userId);
      }
      
      // If still not connected after reconnection attempt
      const updatedConnection = this.connections.get(userId);
      if (!updatedConnection?.connectionStatus.connected) {
        throw new Error(`WhatsApp is not connected for user ${userId}`);
      }
    }

    try {
      const sock = this.connections.get(userId).sock;
      
      // Format the phone number
      const formattedTo = to.startsWith('+') ? to.slice(1) : to;
      const jid = formattedTo.includes('@') ? formattedTo : `${formattedTo}@s.whatsapp.net`;

      const result = await sock.sendMessage(jid, { text: message });
      logger.info(`Message sent from user ${userId} to ${jid}`);
      
      // Save outgoing message
      await this.saveOutgoingMessage(userId, jid, message, result?.key?.id);
      
      return {
        success: true,
        messageId: result?.key?.id || undefined,
        timestamp: Date.now()
      };
    } catch (error) {
      logger.error(`Failed to send message from user ${userId} to ${to}:`, error);
      return {
        success: false,
        error: error.message,
        timestamp: Date.now()
      };
    }
  }

  async saveOutgoingMessage(ownerId, to, content, messageId) {
    try {
      // Get or create conversation
      let conversation = await Conversation.findOne({ 
        where: { 
          whatsappChatId: to,
          ownerId: ownerId 
        } 
      });
      
      if (!conversation) {
        conversation = await Conversation.create({
          whatsappChatId: to,
          ownerId: ownerId,
          isGroup: to.includes('@g.us')
        });
      }

      // Save outgoing message
      await Message.create({
        conversationId: conversation.id,
        senderId: ownerId,
        messageId: messageId || `out_${Date.now()}_${Math.random()}`,
        content: content,
        messageType: 'text',
        isOutgoing: true
      });

    } catch (error) {
      logger.error(`Error saving outgoing message for owner ${ownerId}:`, error);
    }
  }

  async updateSessionStatus(userId, updates) {
    try {
      const session = await WhatsAppSession.findOne({ where: { userId } });
      if (session) {
        await session.update(updates);
      } else {
        await WhatsAppSession.create({
          userId,
          ...updates
        });
      }
    } catch (error) {
      logger.error(`Failed to update session status for user ${userId}:`, error);
    }
  }

  async getUserConnectionStatus(userId) {
    const connectionData = this.connections.get(userId);
    if (connectionData) {
      return connectionData.connectionStatus;
    }

    // Check database for last known status
    const session = await WhatsAppSession.findOne({ where: { userId } });
    if (session) {
      return {
        connected: session.isConnected,
        connectionState: session.connectionState,
        lastConnectedAt: session.lastConnectedAt,
        qrCode: session.qrCode,
        userId
      };
    }

    return {
      connected: false,
      connectionState: 'close',
      userId
    };
  }

  setQRCodeCallback(userId, callback) {
    this.qrCodeCallbacks.set(userId, callback);
  }

  async clearUserAuthState(userId) {
    try {
      // Clear from memory
      this.connections.delete(userId);
      this.qrCodeCallbacks.delete(userId);
      
      // Clear auth files from filesystem
      const fs = require('fs');
      const path = require('path');
      const authDir = path.join(process.cwd(), 'auth_sessions', `user_${userId}`);
      
      if (fs.existsSync(authDir)) {
        try {
          const files = fs.readdirSync(authDir);
          for (const file of files) {
            fs.unlinkSync(path.join(authDir, file));
          }
          fs.rmdirSync(authDir);
          logger.info(`Cleared auth files for user ${userId}`);
        } catch (error) {
          logger.warn(`Error clearing auth files for user ${userId}:`, error);
        }
      }
      
      // Clear from database
      const session = await WhatsAppSession.findOne({ where: { userId } });
      if (session) {
        await session.update({
          isConnected: false,
          connectionState: 'close',
          qrCode: null,
          authData: null
        });
      }
      
      logger.info(`Auth state cleared for user ${userId}`);
    } catch (error) {
      logger.error(`Error clearing auth state for user ${userId}:`, error);
    }
  }

  async forceNewQRCode(userId) {
    logger.info(`Forcing new QR code generation for user ${userId}`);
    
    // Clear any existing connection
    if (this.connections.has(userId)) {
      const connection = this.connections.get(userId);
      if (connection.sock) {
        try {
          await connection.sock.logout();
        } catch (error) {
          logger.warn(`Error during logout for user ${userId}:`, error);
        }
      }
    }
    
    // Clear auth state to force fresh QR
    await this.clearUserAuthState(userId);
    
    // Wait a moment before reconnecting
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Initiate fresh connection
    return await this.connectUser(userId);
  }

  async createNewSocketAfterRestart(userId, oldSaveCreds) {
    logger.info(`Creating new socket after restart for user ${userId}`);
    
    const connectionData = this.connections.get(userId);
    if (!connectionData) {
      throw new Error(`No connection data found for user ${userId}`);
    }
    
    try {
      // Get updated auth state
      const { state, saveCreds } = await this.makeDatabaseAuthState(userId);
      const { version } = await fetchLatestBaileysVersion();
      
      // Close old socket if it exists
      if (connectionData.sock) {
        try {
          connectionData.sock.end();
        } catch (error) {
          logger.warn(`Error closing old socket for user ${userId}:`, error);
        }
      }
      
      // Create new socket with updated auth
      connectionData.sock = makeWASocket({
        version,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys)
        },
        browser: ['WhatsApp Bot API', 'Chrome', '10.0'],
        syncFullHistory: false,
        markOnlineOnConnect: true,
        logger: pino({ level: 'silent' }),
        shouldIgnoreJid: jid => !jid.includes('@s.whatsapp.net'),
        getMessage: async () => {
          return {
            conversation: 'hello'
          };
        },
        printQRInTerminal: false,
        generateHighQualityLinkPreview: true,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        fireInitQueries: true,
        emitOwnEvents: false,
        patchMessageBeforeSending: (message) => {
          return message;
        },
        // Add error handling options
        retryRequestDelayMs: 1000,
        maxMsgRetryCount: 5
      });
      
      logger.info(`New socket created for user ${userId} after restart`);
      
      // Setup event handlers for new socket
      await this.setupEventHandlers(userId, saveCreds);
      
      return true;
    } catch (error) {
      logger.error(`Failed to create new socket after restart for user ${userId}:`, error);
      throw error;
    }
  }

  async disconnectUser(userId) {
    const connectionData = this.connections.get(userId);
    if (connectionData && connectionData.sock) {
      try {
        await connectionData.sock.logout();
      } catch (error) {
        logger.error(`Error during logout for user ${userId}:`, error);
      }
    }
    
    await this.clearUserAuthState(userId);
    logger.info(`WhatsApp connection closed for user ${userId}`);
  }

  // Get all active connections
  getActiveConnections() {
    const activeConnections = [];
    for (const [userId, connection] of this.connections.entries()) {
      if (connection.connectionStatus.connected) {
        activeConnections.push({
          userId,
          connectionState: connection.connectionStatus.connectionState,
          connected: connection.connectionStatus.connected
        });
      }
    }
    return activeConnections;
  }
}

// Export singleton instance
const multiUserWhatsAppService = new MultiUserWhatsAppService();
module.exports = multiUserWhatsAppService;