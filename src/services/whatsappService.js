const { Boom } = require("@hapi/boom");
const makeWASocket = require("@whiskeysockets/baileys").default;
const {
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  useMultiFileAuthState,
} = require("@whiskeysockets/baileys");
const qrcode = require("qrcode-terminal");
const fs = require("fs");
const path = require("path");
const winston = require('winston');
const pino = require('pino');

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
    }),
    new winston.transports.File({ filename: 'logs/whatsapp.log' })
  ]
});

// Import models
const { Conversation, Message, BotResponse, Order, OrderItem } = require('../models/whatsappModels');
const Product = require('../models/product');
const User = require('../models/user');

class WhatsAppService {
  constructor() {
    this.sock = null;
    this.connectionStatus = {
      connected: false,
      connectionState: 'close'
    };
    this.reconnectAttempts = 0;
    this.qrCodeCallback = null;
    this.authDir = process.env.AUTH_DIR || './auth_info_baileys';
    this.maxReconnectAttempts = parseInt(process.env.MAX_RECONNECT_ATTEMPTS) || 5;
    this.reconnectInterval = parseInt(process.env.RECONNECT_INTERVAL) || 5000;
    this.isConnecting = false;
    
    this.ensureAuthDirectoryExists();
  }

  ensureAuthDirectoryExists() {
    if (!fs.existsSync(this.authDir)) {
      fs.mkdirSync(this.authDir, { recursive: true });
      logger.info(`Created auth directory: ${this.authDir}`);
    }
  }

  async connect() {
    if (this.isConnecting) {
      logger.info('Connection attempt already in progress');
      return this.connectionStatus;
    }

    this.isConnecting = true;

    try {
      logger.info('Initializing WhatsApp connection...');
      
      const { state, saveCreds } = await useMultiFileAuthState(this.authDir);
      const { version } = await fetchLatestBaileysVersion();

      // Configure socket with more lenient timeout
      this.sock = makeWASocket({
        version,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
        },
        browser: ['WhatsApp ERP Bot', 'Chrome', '10.0'],
        syncFullHistory: true,
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

      await this.setupEventHandlers(saveCreds);
      
      return this.connectionStatus;
    } catch (error) {
      logger.error('Failed to initialize WhatsApp connection:', error);
      throw new Error(`Connection initialization failed: ${error}`);
    } finally {
      this.isConnecting = false;
    }
  }

  async setupEventHandlers(saveCreds) {
    if (!this.sock) return;

    // Handle connection updates
    this.sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        this.connectionStatus.qrCode = qr;
        logger.info("QR Code generated for WhatsApp connection");
        
        if (this.qrCodeCallback) {
          this.qrCodeCallback(qr);
        }
        
        // Display QR in terminal for convenience
        qrcode.generate(qr, { small: true });
        console.log("\nPlease scan the QR code with WhatsApp to connect");
        console.log("Or visit: http://localhost:3000/api/whatsapp/qr\n");
      }

      if (connection === "close") {
        const statusCode = (lastDisconnect?.error)?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut && 
                              statusCode !== DisconnectReason.badSession;

        this.connectionStatus.connected = false;
        this.connectionStatus.connectionState = 'close';
        this.connectionStatus.lastDisconnect = lastDisconnect?.error?.message;

        logger.warn(
          `Connection closed: ${lastDisconnect?.error?.message}, reconnecting: ${shouldReconnect}`
        );

        if (shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          logger.info(`Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
          
          setTimeout(() => {
            this.connect().catch(error => {
              logger.error('Reconnection failed:', error);
            });
          }, this.reconnectInterval);
        } else if (!shouldReconnect) {
          // Clear auth state if logged out
          await this.clearAuthState();
        }
      } else if (connection === "open") {
        this.connectionStatus.connected = true;
        this.connectionStatus.connectionState = 'open';
        this.connectionStatus.qrCode = undefined;
        this.reconnectAttempts = 0;
        
        logger.info("WhatsApp connection established successfully");
        console.log("\n✅ WhatsApp connected successfully!\n");
      }
    });

    // Handle credential updates
    this.sock.ev.on("creds.update", async () => {
      await saveCreds();
    });

    // Handle messages
    this.sock.ev.on("messages.upsert", async ({ messages }) => {
      for (const msg of messages) {
        if (!msg.key.fromMe && msg.message) {
          await this.handleIncomingMessage(msg);
        }
      }
    });
  }

  async handleIncomingMessage(msg) {
    try {
      const mobileNo = msg.key.remoteJid.replace('@s.whatsapp.net', '');
      const messageContent = msg.message?.conversation || 
                           msg.message?.extendedTextMessage?.text || 
                           'Media message';
      
      logger.info(`Received message from ${mobileNo}: ${messageContent}`);

      // Save incoming message
      await this.saveIncomingMessage(msg, mobileNo, messageContent);

      // Process bot response
      if (messageContent !== 'Media message') {
        await this.processBotResponse(mobileNo, messageContent, msg.key.remoteJid);
      }

    } catch (error) {
      logger.error('Error handling incoming message:', error);
    }
  }

  async saveIncomingMessage(msg, mobileNo, content) {
    try {
      // Get or create user
      let user = await User.findOne({ where: { email: mobileNo + '@whatsapp.local' } });
      if (!user) {
        user = await User.create({
          email: mobileNo + '@whatsapp.local',
          role: 'customer'
        });
      }

      // Get or create conversation
      let conversation = await Conversation.findOne({ 
        where: { whatsappChatId: msg.key.remoteJid } 
      });
      if (!conversation) {
        conversation = await Conversation.create({
          whatsappChatId: msg.key.remoteJid,
          isGroup: msg.key.remoteJid.includes('@g.us')
        });
      }

      // Save message
      await Message.create({
        conversationId: conversation.id,
        senderId: user.id,
        messageId: msg.key.id,
        content: content,
        messageType: 'text',
        isOutgoing: false
      });

    } catch (error) {
      logger.error('Error saving incoming message:', error);
    }
  }

  async processBotResponse(mobileNo, messageContent, chatId) {
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
        response = await this.handleOrderRequest(mobileNo, messageContent);
      } else if (lowerContent.includes('status') || lowerContent.includes('my order')) {
        response = await this.getOrderStatus(mobileNo);
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
        await this.sendTextMessage(mobileNo + '@s.whatsapp.net', response);
      }

    } catch (error) {
      logger.error('Error processing bot response:', error);
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
        catalog += `   �� Category: ${product.Category?.name || 'Uncategorized'}\n`;
        catalog += `   🆔 ID: ${product.id}\n\n`;
      });

      catalog += '🛒 To order, reply: "ORDER [Product Name or ID]:[Quantity]"\nExample: "ORDER Gaming Laptop:1"';

      return catalog;
    } catch (error) {
      logger.error('Error generating product catalog:', error);
      return 'Sorry, I encountered an error fetching the product catalog.';
    }
  }

  async handleOrderRequest(mobileNo, messageContent) {
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
      
      // Get or create customer user
      let user = await User.findOne({ where: { email: mobileNo + '@whatsapp.local' } });
      if (!user) {
        user = await User.create({
          email: mobileNo + '@whatsapp.local',
          role: 'customer'
        });
      }

      const order = await Order.create({
        orderNumber: orderNumber,
        customerId: user.id,
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

  async getOrderStatus(mobileNo) {
    try {
      const user = await User.findOne({ where: { email: mobileNo + '@whatsapp.local' } });
      if (!user) {
        return '📦 No orders found for this number.';
      }

      const orders = await Order.findAll({
        where: { customerId: user.id },
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

  async sendTextMessage(to, message) {
    if (!this.sock || !this.connectionStatus.connected) {
      // Try to reconnect if not connected
      if (!this.isConnecting) {
        await this.connect();
      }
      
      // If still not connected after reconnection attempt
      if (!this.connectionStatus.connected) {
        throw new Error('WhatsApp is not connected');
      }
    }

    try {
      // Format the phone number
      const formattedTo = to.startsWith('+') ? to.slice(1) : to;
      const jid = formattedTo.includes('@') ? formattedTo : `${formattedTo}@s.whatsapp.net`;

      const result = await this.sock.sendMessage(jid, { text: message });
      logger.info(`Message sent to ${jid}`);
      
      return {
        success: true,
        messageId: result?.key?.id || undefined,
        timestamp: Date.now()
      };
    } catch (error) {
      logger.error(`Failed to send message to ${to}:`, error);
      return {
        success: false,
        error: error.message,
        timestamp: Date.now()
      };
    }
  }

  getConnectionStatus() {
    return { ...this.connectionStatus };
  }

  setQRCodeCallback(callback) {
    this.qrCodeCallback = callback;
  }

  async clearAuthState() {
    try {
      // Remove auth files
      if (fs.existsSync(this.authDir)) {
        const files = fs.readdirSync(this.authDir);
        for (const file of files) {
          fs.unlinkSync(path.join(this.authDir, file));
        }
        fs.rmdirSync(this.authDir);
      }
      
      // Reset connection status
      this.connectionStatus = {
        connected: false,
        connectionState: 'close'
      };
      
      logger.info('Auth state cleared successfully');
    } catch (error) {
      logger.error('Error clearing auth state:', error);
    }
  }

  async disconnect() {
    if (this.sock) {
      await this.sock.logout();
      await this.clearAuthState();
      this.sock = null;
      logger.info('WhatsApp connection closed and auth state cleared');
    }
  }
}

module.exports = WhatsAppService;
