const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const createError = require('http-errors');
const { v4: uuidv4 } = require('uuid');
const nodemailer = require('nodemailer');
const User = require('../models/user');
const { encrypt, decrypt } = require('../utils/crypto');

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

exports.requestPasswordReset = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return next(createError(404, 'User not found'));
    }
    const uuid = uuidv4();
    const exp = Date.now() + 60 * 60 * 1000; // 1 hour from now
    const payload = { email, uuid, exp };
    const resetToken = encrypt(payload);
    user.resetToken = uuid;
    await user.save();
    const resetUrl = `${process.env.PASSWORD_RESET_PAGE_URL}/reset-password?token=${resetToken}`;
    console.log('resetUrl', resetUrl);
    // TODO: send email with resetUrl
    // // Configure nodemailer (example with Gmail, adjust as needed)
    // const transporter = nodemailer.createTransporter({
    //   service: 'gmail',
    //   auth: {
    //     user: process.env.EMAIL_USER,
    //     pass: process.env.EMAIL_PASS,
    //   },
    // });

    // const mailOptions = {
    //   from: process.env.EMAIL_USER,
    //   to: user.email,
    //   subject: 'Password Reset Request',
    //   html: `<h2>Password Reset</h2><p>Click the link below to reset your password:</p><a href="${resetUrl}">${resetUrl}</a>`
    // };

    // await transporter.sendMail(mailOptions);
    res.json({ status: 200, message: 'Password reset email sent', data: null });
  } catch (err) {
    console.log(err)
    next(err);
  }
};

exports.resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;
    let payload;
    try {
      payload = decrypt(token);
    } catch (e) {
      return next(createError(400, 'Invalid or expired token'));
    }
    const { email, uuid, exp } = payload;
    if (!email || !uuid || !exp || Date.now() > exp) {
      return next(createError(400, 'Invalid or expired token'));
    }
    const user = await User.findOne({ where: { email } });
    if (!user || user.resetToken !== uuid) {
      return next(createError(400, 'Invalid or expired token'));
    }
    user.password = await bcrypt.hash(newPassword, 10);
    user.resetToken = null;
    await user.save();
    res.json({ status: 200, message: 'Password reset successful', data: null });
  } catch (err) {
    next(err);
  }
}; 