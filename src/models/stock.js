const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');
const Product = require('./product');

const Stock = sequelize.define('Stock', {
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
  reservedQnt: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  availableQnt: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  buyPrice: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
}, { timestamps: true });

// Define associations
Stock.belongsTo(Product, { foreignKey: 'ProductId', onDelete: 'CASCADE' });
Product.hasMany(Stock, { foreignKey: 'ProductId' });

module.exports = Stock; 