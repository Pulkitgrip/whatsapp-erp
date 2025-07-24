const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const createError = require('http-errors');
const User = require('../models/user');

exports.signup = async (req, res, next) => {
  const { email, password } = req.body;
  try {
    const userExists = await User.findOne({ where: { email } });
    if (userExists) {
      throw createError(400, 'User already exists');
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    await User.create({ email, password: hashedPassword });
    res.status(201).json({ status: 'success', message: 'User created successfully' });
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
    res.json({ status: 'success', message: 'Login successful', token });
  } catch (err) {
    next(err);
  }
}; 