const bcrypt = require('bcryptjs');
const createError = require('http-errors');
const prepareQueryOptions = require('../utils/queryOptions');
const { Op } = require('sequelize');
const User = require('../models/user');

exports.addUser = async (req, res, next) => {
  try {
    const { name, email, password, mobileNo, role } = req.body;
    
    // Check if user already exists
    const userExists = await User.findOne({ where: { email } });
    if (userExists) {
      return next(createError(400, 'User already exists'));
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create user
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      mobileNo,
      role: role || 'user'
    });
    
    res.status(201).json({
      status: 200,
      message: 'User added successfully',
      data: { user }
    });
  } catch (err) {
    next(err);
  }
}; 

exports.getUsers = async (req, res, next) => {
  try {
    const options = prepareQueryOptions(req.query, ['name', 'email', 'mobileNo', 'role']);
    
    // Add role filter if provided
    if (req.query.role) {
      const roles = req.query.role.includes(',') ? req.query.role.split(',') : [req.query.role];
      options.where = {
        ...options.where,
        role: { [Op.in]: roles }
      };
    }
    
    // Remove limit/offset for total count
    const totalCount = await User.count();
    // Use findAndCountAll for filtered count and results
    const { count, rows: users } = await User.findAndCountAll(options);
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    res.json({
      status: 200,
      message: 'Users fetched successfully',
      data: {
        count,
        totalCount,
        page,
        limit,
        users
      }
    });
  } catch (err) {
    next(err);
  }
}; 

exports.updateUser = async (req, res, next) => {
  try {
    const userId = req.params.id;
    const { name, email, mobileNo, role, password } = req.body;
    
    const user = await User.findByPk(userId);
    if (!user) {
      return next(createError(404, 'User not found'));
    }
    
    // Check if email is being changed and if it already exists
    if (email && email !== user.email) {
      const emailExists = await User.findOne({ where: { email } });
      if (emailExists) {
        return next(createError(400, 'Email already exists'));
      }
    }
    
    // Update fields
    if (name !== undefined) user.name = name;
    if (email !== undefined) user.email = email;
    if (mobileNo !== undefined) user.mobileNo = mobileNo;
    if (role !== undefined) user.role = role;
    
    // Hash password if provided
    if (password) {
      user.password = await bcrypt.hash(password, 10);
    }
    
    await user.save();
    
    res.json({
      status: 200,
      message: 'User updated successfully',
      data: { user }
    });
  } catch (err) {
    next(err);
  }
};

exports.deleteUser = async (req, res, next) => {
  try {
    const userId = req.params.id;
    
    const user = await User.findByPk(userId);
    if (!user) {
      return next(createError(404, 'User not found'));
    }
    
    await user.destroy();
    
    res.json({
      status: 200,
      message: 'User deleted successfully',
      data: null
    });
  } catch (err) {
    next(err);
  }
};

exports.getMe = async (req, res, next) => {
  try {
    // The user is already authenticated and available in req.user from authMiddleware
    const user = req.user;
    
    if (!user) {
      return next(createError(404, 'User not found'));
    }
    
    // Return user data without password
    const userData = {
      id: user.id,
      name: user.name,
      email: user.email,
      mobileNo: user.mobileNo,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };
    
    res.json({
      status: 200,
      message: 'User profile fetched successfully',
      data: {
        user: userData
      }
    });
  } catch (err) {
    next(err);
  }
}; 