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

  // Database-based auth state for Vercel compatibility
  async makeDatabaseAuthState(userId) {
    const session = await WhatsAppSession.findOne({ where: { userId } });
    
    let authData = {
      creds: null,
      keys: {}
    };

    if (session && session.authData) {
      try {
        authData = JSON.parse(session.authData);
      } catch (error) {
        logger.error(`Failed to parse auth data for user ${userId}:`, error);
      }
    }

    const saveCreds = async () => {
      try {
        const updatedSession = await WhatsAppSession.findOne({ where: { userId } });
        if (updatedSession) {
          await updatedSession.update({
            authData: JSON.stringify(authData)
          });
        } else {
          await WhatsAppSession.create({
            userId,
            authData: JSON.stringify(authData)
          });
        }
        logger.info(`Auth state saved for user ${userId}`);
      } catch (error) {
        logger.error(`Failed to save auth state for user ${userId}:`, error);
      }
    };

    const state = {
      creds: authData.creds,
      keys: makeCacheableSignalKeyStore(authData.keys || {}, pino({ level: 'silent' }))
    };

    // Override the key store methods to save to database
    const originalSet = state.keys.set;
    state.keys.set = async (key, value) => {
      authData.keys[key] = value;
      await originalSet.call(state.keys, key, value);
    };

    const originalGet = state.keys.get;
    state.keys.get = async (key) => {
      return await originalGet.call(state.keys, key);
    };

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
      isConnecting: true
    };

    this.connections.set(userId, connectionData);

    try {
      logger.info(`Initializing WhatsApp connection for user ${userId}...`);
      
      const { state, saveCreds } = await this.makeDatabaseAuthState(userId);
      const { version } = await fetchLatestBaileysVersion();

      connectionData.sock = makeWASocket({
        version,
        auth: state,
        browser: [`WhatsApp ERP Bot - User ${userId}`, 'Chrome', '10.0'],
        syncFullHistory: false,
        markOnlineOnConnect: true,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        retryRequestDelayMs: 5000,
        logger: pino({ level: 'silent' }),
        shouldIgnoreJid: jid => !jid.includes('@s.whatsapp.net'),
        getMessage: async () => {
          return { conversation: 'hello' };
        }
      });

      await this.setupEventHandlers(userId, saveCreds);
      
      return connectionData.connectionStatus;
    } catch (error) {
      logger.error(`Failed to initialize WhatsApp connection for user ${userId}:`, error);
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
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        connectionData.connectionStatus.qrCode = qr;
        logger.info(`QR Code generated for user ${userId}`);
        
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

      if (connection === "close") {
        const statusCode = (lastDisconnect?.error)?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut && 
                              statusCode !== DisconnectReason.badSession;

        connectionData.connectionStatus.connected = false;
        connectionData.connectionStatus.connectionState = 'close';
        connectionData.connectionStatus.lastDisconnect = lastDisconnect?.error?.message;

        await this.updateSessionStatus(userId, {
          isConnected: false,
          connectionState: 'close',
          qrCode: null
        });

        logger.warn(`Connection closed for user ${userId}: ${lastDisconnect?.error?.message}, reconnecting: ${shouldReconnect}`);

        if (shouldReconnect && connectionData.reconnectAttempts < this.maxReconnectAttempts) {
          connectionData.reconnectAttempts++;
          logger.info(`Reconnection attempt ${connectionData.reconnectAttempts}/${this.maxReconnectAttempts} for user ${userId}`);
          
          setTimeout(() => {
            this.connectUser(userId).catch(error => {
              logger.error(`Reconnection failed for user ${userId}:`, error);
            });
          }, this.reconnectInterval);
        } else if (!shouldReconnect) {
          await this.clearUserAuthState(userId);
        }
      } else if (connection === "open") {
        connectionData.connectionStatus.connected = true;
        connectionData.connectionStatus.connectionState = 'open';
        connectionData.connectionStatus.qrCode = undefined;
        connectionData.reconnectAttempts = 0;
        
        await this.updateSessionStatus(userId, {
          isConnected: true,
          connectionState: 'open',
          lastConnectedAt: new Date(),
          qrCode: null
        });
        
        logger.info(`WhatsApp connection established successfully for user ${userId}`);
      }
    });

    // Handle credential updates
    sock.ev.on("creds.update", async () => {
      await saveCreds();
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

      // Check if sender exists in our database
      const sender = await User.findOne({ 
        where: { phoneNumber: phoneNumber } 
      });

      if (!sender) {
        logger.info(`Message from ${phoneNumber} ignored - sender not in database`);
        return;
      }

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