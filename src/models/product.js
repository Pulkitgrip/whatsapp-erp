const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');
const Category = require('./category');

const Product = sequelize.define('Product', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  unitPrice: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  costPrice: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  lowStockThreshold: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 10,
  },
  CategoryId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
}, { timestamps: true });

Product.belongsTo(Category, { foreignKey: { allowNull: false }, onDelete: 'SET NULL' });
Category.hasMany(Product);

module.exports = Product; 