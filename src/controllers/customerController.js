const createError = require('http-errors');
const prepareQueryOptions = require('../utils/queryOptions');
const { Op } = require('sequelize');
const Customer = require('../models/customer');
const User = require('../models/user');
require('../models/userCustomer'); // Import to ensure associations are loaded

exports.createCustomer = async (req, res, next) => {
  try {
    const { name, gstNo, address } = req.body;
    
    // Check if customer already exists with same name or gstNo
    const existingCustomer = await Customer.findOne({
      where: {
        [Op.or]: [
          { name },
          ...(gstNo ? [{ gstNo }] : []) // Only check gstNo if it's provided
        ]
      }
    });
    
    if (existingCustomer) {
      const duplicateField = existingCustomer.name === name ? 'name' : 'GST number';
      return next(createError(400, `Customer with this ${duplicateField} already exists`));
    }
    
    const customer = await Customer.create({ name, gstNo, address });
    res.status(201).json({
      status: 200,
      message: 'Customer created successfully',
      data: { customer }
    });
  } catch (err) {
    next(err);
  }
};

exports.getCustomers = async (req, res, next) => {
  try {
    const options = prepareQueryOptions(req.query, ['name', 'gstNo', 'address']);
    
    // Remove limit/offset for total count
    const totalCount = await Customer.count();
    // Use findAndCountAll for filtered count and results
    const { count, rows: customers } = await Customer.findAndCountAll(options);
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    res.json({
      status: 200,
      message: 'Customers fetched successfully',
      data: {
        count,
        totalCount,
        page,
        limit,
        customers
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.getCustomerById = async (req, res, next) => {
  try {
    const customer = await Customer.findByPk(req.params.id);
    if (!customer) {
      return next(createError(404, 'Customer not found'));
    }
    res.json({
      status: 200,
      message: 'Customer fetched successfully',
      data: { customer }
    });
  } catch (err) {
    next(err);
  }
};

exports.updateCustomer = async (req, res, next) => {
  try {
    const customer = await Customer.findByPk(req.params.id);
    if (!customer) {
      return next(createError(404, 'Customer not found'));
    }
    const { name, gstNo, address } = req.body;
    
    // Check if another customer already exists with same name or gstNo
    if (name || gstNo) {
      const whereConditions = [];
      if (name && name !== customer.name) {
        whereConditions.push({ name });
      }
      if (gstNo && gstNo !== customer.gstNo) {
        whereConditions.push({ gstNo });
      }
      
      if (whereConditions.length > 0) {
        const existingCustomer = await Customer.findOne({
          where: {
            [Op.and]: [
              { id: { [Op.ne]: customer.id } }, // Exclude current customer
              { [Op.or]: whereConditions }
            ]
          }
        });
        
        if (existingCustomer) {
          const duplicateField = existingCustomer.name === name ? 'name' : 'GST number';
          return next(createError(400, `Customer with this ${duplicateField} already exists`));
        }
      }
    }
    
    if (name !== undefined) customer.name = name;
    if (gstNo !== undefined) customer.gstNo = gstNo;
    if (address !== undefined) customer.address = address;
    await customer.save();
    res.json({
      status: 200,
      message: 'Customer updated successfully',
      data: { customer }
    });
  } catch (err) {
    next(err);
  }
};

exports.deleteCustomer = async (req, res, next) => {
  try {
    const customer = await Customer.findByPk(req.params.id);
    if (!customer) {
      return next(createError(404, 'Customer not found'));
    }
    await customer.destroy();
    res.json({
      status: 200,
      message: 'Customer deleted successfully',
      data: null
    });
  } catch (err) {
    next(err);
  }
}; 

exports.getUserCustomers = async (req, res, next) => {
  try {
    const userId = req.params.userId;
    const user = await User.findByPk(userId, {
      include: [{
        model: Customer,
        through: { attributes: [] } // Exclude junction table attributes
      }]
    });
    
    if (!user) {
      return next(createError(404, 'User not found'));
    }
    
    res.json({
      status: 200,
      message: 'User customers fetched successfully',
      data: { 
        user: user.user,
        customers: user.Customers 
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.getCustomerUsers = async (req, res, next) => {
  try {
    const customerId = req.params.customerId;
    const customer = await Customer.findByPk(customerId, {
      include: [{
        model: User,
        through: { attributes: [] }, // Exclude junction table attributes
        attributes: ['id', 'name', 'email', 'mobileNo', 'role'] // Only include safe user fields
      }]
    });
    
    if (!customer) {
      return next(createError(404, 'Customer not found'));
    }
    
    res.json({
      status: 200,
      message: 'Customer users fetched successfully',
      data: { 
        customer: {
          id: customer.id,
          name: customer.name,
          gstNo: customer.gstNo,
          address: customer.address
        },
        users: customer.Users 
      }
    });
  } catch (err) {
    next(err);
  }
}; 