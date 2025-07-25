const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');
const User = require('./user');
const Customer = require('./customer');

const Order = sequelize.define('Order', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  amount: {
    type: DataTypes.FLOAT,
    allowNull: false,
    defaultValue: 0,
  },
  status: {
    type: DataTypes.ENUM('pending', 'confirmed', 'shipped', 'delivered', 'cancelled'),
    allowNull: false,
    defaultValue: 'pending',
  },
  paymentStatus: {
    type: DataTypes.ENUM('pending', 'paid', 'failed', 'refunded'),
    allowNull: false,
    defaultValue: 'pending',
  },
  UserId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: User,
      key: 'id'
    }
  },
  CustomerId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Customer,
      key: 'id'
    }
  },
}, { timestamps: true });

// Define associations
Order.belongsTo(User, { foreignKey: 'UserId', onDelete: 'CASCADE' });
Order.belongsTo(Customer, { foreignKey: 'CustomerId', onDelete: 'CASCADE' });
User.hasMany(Order, { foreignKey: 'UserId' });
Customer.hasMany(Order, { foreignKey: 'CustomerId' });

module.exports = Order; 