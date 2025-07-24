const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');
const User = require('./user');

// WhatsApp Session Model - stores auth data per user
const WhatsAppSession = sequelize.define('WhatsAppSession', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true,
  },
  isConnected: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  connectionState: {
    type: DataTypes.STRING,
    defaultValue: 'close',
  },
  lastConnectedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  qrCode: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  authData: {
    type: DataTypes.TEXT, // JSON string containing creds and keys
    allowNull: true,
  },
}, { timestamps: true });

// WhatsApp Conversations Model
const Conversation = sequelize.define('Conversation', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  whatsappChatId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  conversationType: {
    type: DataTypes.STRING,
    defaultValue: 'individual',
  },
  title: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  isGroup: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  ownerId: {
    type: DataTypes.INTEGER,
    allowNull: true, // The user who owns this WhatsApp account
  },
}, { timestamps: true });

// WhatsApp Messages Model
const Message = sequelize.define('Message', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  conversationId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  senderId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  messageId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  messageType: {
    type: DataTypes.STRING,
    defaultValue: 'text',
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  mediaUrl: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  mediaType: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  isOutgoing: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: 'sent',
  },
  metadata: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, { timestamps: true });

// Bot Responses Model
const BotResponse = sequelize.define('BotResponse', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  triggerKeyword: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  responseText: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  responseType: {
    type: DataTypes.STRING,
    defaultValue: 'text',
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  priority: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
  },
}, { timestamps: true });

// Orders Model for WhatsApp integration
const Order = sequelize.define('Order', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  orderNumber: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  customerId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: 'pending',
  },
  totalAmount: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  orderDate: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, { timestamps: true });

// Order Items Model
const OrderItem = sequelize.define('OrderItem', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  orderId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  productId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  unitPrice: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  total: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
}, { timestamps: true });

// Define relationships
User.hasOne(WhatsAppSession, { foreignKey: 'userId' });
WhatsAppSession.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(Conversation, { foreignKey: 'ownerId', as: 'ownedConversations' });
Conversation.belongsTo(User, { foreignKey: 'ownerId', as: 'owner' });

Conversation.hasMany(Message, { foreignKey: 'conversationId' });
Message.belongsTo(Conversation, { foreignKey: 'conversationId' });

User.hasMany(Message, { foreignKey: 'senderId' });
Message.belongsTo(User, { foreignKey: 'senderId' });

User.hasMany(Order, { foreignKey: 'customerId' });
Order.belongsTo(User, { foreignKey: 'customerId' });

Order.hasMany(OrderItem, { foreignKey: 'orderId' });
OrderItem.belongsTo(Order, { foreignKey: 'orderId' });

const Product = require('./product');
Product.hasMany(OrderItem, { foreignKey: 'productId' });
OrderItem.belongsTo(Product, { foreignKey: 'productId' });

module.exports = {
  WhatsAppSession,
  Conversation,
  Message,
  BotResponse,
  Order,
  OrderItem
};
