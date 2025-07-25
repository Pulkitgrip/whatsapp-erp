const createError = require('http-errors');
const prepareQueryOptions = require('../utils/queryOptions');
const { Op } = require('sequelize');
const sequelize = require('../sequelize');
const Customer = require('../models/customer');
const User = require('../models/user');
const UserCustomer = require('../models/userCustomer'); // Import to ensure associations are loaded

exports.createCustomer = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { name, gstNo, address, users = [] } = req.body;
    
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
      await transaction.rollback();
      return next(createError(400, `Customer with this ${duplicateField} already exists`));
    }

    // Process users if provided
    let createdUsers = [];
    let skippedUsers = [];
    
    if (users && users.length > 0) {
      const bcrypt = require('bcryptjs');
      
      // Extract mobile numbers and emails from input users
      const mobileNumbers = users
        .filter(user => user.mobileNo)
        .map(user => user.mobileNo);
      
      const emails = users
        .filter(user => user.email)
        .map(user => user.email);
      
      // Check for existing users with same mobile numbers or emails
      const whereConditions = [];
      if (mobileNumbers.length > 0) {
        whereConditions.push({ mobileNo: { [Op.in]: mobileNumbers } });
      }
      if (emails.length > 0) {
        whereConditions.push({ email: { [Op.in]: emails } });
      }
      
      let existingUsers = [];
      if (whereConditions.length > 0) {
        existingUsers = await User.findAll({
          where: {
            [Op.or]: whereConditions
          },
          attributes: ['mobileNo', 'email']
        });
      }
      
      const existingMobileNumbers = existingUsers.map(user => user.mobileNo).filter(Boolean);
      const existingEmails = existingUsers.map(user => user.email).filter(Boolean);
      
      // Filter out users with existing mobile numbers or emails
      const validUsers = [];
      
      for (const user of users) {
        let skipReason = null;
        
        // Check if email is provided (required field)
        if (!user.email) {
          skipReason = 'Email is required';
        }
        // Check for duplicate mobile number
        else if (user.mobileNo && existingMobileNumbers.includes(user.mobileNo)) {
          skipReason = 'User with this mobile number already exists';
        }
        // Check for duplicate email
        else if (user.email && existingEmails.includes(user.email)) {
          skipReason = 'User with this email already exists';
        }
        
        if (skipReason) {
          skippedUsers.push({
            ...user,
            reason: skipReason
          });
        } else {
          validUsers.push({
            name: user.name,
            email: user.email,
            mobileNo: user.mobileNo,
            location: user.location,
            role: 'user' // Default role
          });
        }
      }
      
      // Bulk create valid users
      if (validUsers.length > 0) {
        createdUsers = await User.bulkCreate(validUsers, { 
          transaction,
          returning: true 
        });
      }
    }
    
    // Create customer
    const customer = await Customer.create({ name, gstNo, address }, { transaction });
    
    // Create user-customer associations
    if (createdUsers.length > 0) {
      const userCustomerData = createdUsers.map(user => ({
        userId: user.id,
        customerId: customer.id
      }));
      
      await UserCustomer.bulkCreate(userCustomerData, { transaction });
    }
    
    await transaction.commit();
    
    res.status(201).json({
      status: 200,
      message: 'Customer created successfully',
      data: { 
        customer,
        createdUsers: createdUsers.map(user => ({
          id: user.id,
          name: user.name,
          email: user.email,
          mobileNo: user.mobileNo,
          role: user.role
        })),
        skippedUsers,
        summary: {
          totalUsersProvided: users.length,
          usersCreated: createdUsers.length,
          usersSkipped: skippedUsers.length
        }
      }
    });
  } catch (err) {
    await transaction.rollback();
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