const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const createError = require('http-errors');
const User = require('../models/user');

exports.signup = async (req, res, next) => {
  const { email, password, role } = req.body;
  try {
    const userExists = await User.findOne({ where: { email } });
    if (userExists) {
      throw createError(400, 'User already exists');
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ email, password: hashedPassword, role });
    res.status(201).json({ status: 200, message: 'User created successfully', data: { user } });
  } catch (err) {
    next(err);
  }
};

exports.login = async (req, res, next) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ where: { email } });
    if (!user) {
      throw createError(400, 'Invalid credentials');
    }
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      throw createError(400, 'Invalid credentials');
    }
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ status: 200, message: 'Login successful', data: { token } });
  } catch (err) {
    next(err);
  }
};

exports.getProfile = async (req, res, next) => {
  try {
    // req.user is set by the auth middleware
    if (!req.user) {
      return next(createError(401, 'Not authenticated'));
    }
    res.json({ status: 200, message: 'User profile fetched successfully', data: { user: req.user } });
  } catch (err) {
    next(err);
  }
}; 