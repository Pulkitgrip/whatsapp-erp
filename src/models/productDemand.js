const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');
const Product = require('./product');
const User = require('./user');
const Customer = require('./customer');

const ProductDemand = sequelize.define('ProductDemand', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  ProductId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Product,
      key: 'id'
    }
  },
  productName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
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
ProductDemand.belongsTo(Product, { foreignKey: 'ProductId', onDelete: 'CASCADE' });
ProductDemand.belongsTo(User, { foreignKey: 'UserId', onDelete: 'CASCADE' });
ProductDemand.belongsTo(Customer, { foreignKey: 'CustomerId', onDelete: 'CASCADE' });
Product.hasMany(ProductDemand, { foreignKey: 'ProductId' });
User.hasMany(ProductDemand, { foreignKey: 'UserId' });
Customer.hasMany(ProductDemand, { foreignKey: 'CustomerId' });

module.exports = ProductDemand; 