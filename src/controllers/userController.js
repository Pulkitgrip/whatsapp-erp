const bcrypt = require('bcryptjs');
const createError = require('http-errors');
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