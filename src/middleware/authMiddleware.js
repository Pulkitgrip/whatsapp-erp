const jwt = require('jsonwebtoken');
const createError = require('http-errors');
const User = require('../models/user');

module.exports = async function (req, res, next) {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(createError(401, 'No token provided'));
    }
    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return next(createError(401, 'Invalid token'));
    }
    const user = await User.findByPk(decoded.userId);
    if (!user) {
      return next(createError(401, 'User not found'));
    }
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}; 