const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');
const Order = require('./order');
const Product = require('./product');
const Stock = require('./stock');

const OrderItem = sequelize.define('OrderItem', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  OrderId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Order,
      key: 'id'
    }
  },
  ProductId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Product,
      key: 'id'
    }
  },
  StockId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Stock,
      key: 'id'
    }
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  unitPrice: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  totalPrice: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
}, { timestamps: true });

// Define associations
OrderItem.belongsTo(Order, { foreignKey: 'OrderId', onDelete: 'CASCADE' });
OrderItem.belongsTo(Product, { foreignKey: 'ProductId', onDelete: 'CASCADE' });
OrderItem.belongsTo(Stock, { foreignKey: 'StockId', onDelete: 'CASCADE' });
Order.hasMany(OrderItem, { foreignKey: 'OrderId' });
Product.hasMany(OrderItem, { foreignKey: 'ProductId' });
Stock.hasMany(OrderItem, { foreignKey: 'StockId' });

module.exports = OrderItem; 