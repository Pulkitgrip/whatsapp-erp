const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');
const User = require('./user');
const Customer = require('./customer');
const { Op } = require('sequelize');

const UserCustomer = sequelize.define('UserCustomer', {
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: User,
      key: 'id'
    }
  },
  customerId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Customer,
      key: 'id'
    }
  }
}, { timestamps: true });

// Define many-to-many associations
User.belongsToMany(Customer, { through: UserCustomer, foreignKey: 'userId' });
Customer.belongsToMany(User, { through: UserCustomer, foreignKey: 'customerId' });

// Add direct associations for eager loading
UserCustomer.belongsTo(User, { foreignKey: 'userId' });
UserCustomer.belongsTo(Customer, { foreignKey: 'customerId' });

module.exports = UserCustomer;