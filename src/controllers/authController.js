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
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
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

const sendPasswordResetEmail = async (email, resetUrl) => {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.NODEMAILER_USER,
        pass: process.env.NODEMAILER_PASSWORD, // Consider using App Password for Gmail
      },
      // Optional: Add additional security settings
      secure: true, // Use TLS
      tls: {
        rejectUnauthorized: false // Only if needed for testing
      }
    });
    const mailOptions = {
      from: {
        name: 'WhatsERP', // Add sender name
        address: process.env.NODEMAILER_USER
      },
      to: email,
      subject: 'Password Reset Request',
      html:  `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset</title>
      </head>
      <body style="margin: 0; padding: 20px; background-color: #f4f4f4; font-family: Arial, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          
          <h2 style="color: #333; text-align: center; margin-bottom: 30px;">Password Reset Request</h2>
          
          <p style="font-size: 16px; line-height: 1.6; color: #555; margin-bottom: 20px;">
            Hello,
          </p>
          
          <p style="font-size: 16px; line-height: 1.6; color: #555; margin-bottom: 20px;">
            You recently requested to reset your password for your account. To complete this process securely, please click the button below.
          </p>
          
          <!-- Button with table structure for better email client support -->
          <div style="text-align: center; margin: 40px 0;">
            <table border="0" cellspacing="0" cellpadding="0" style="margin: 0 auto;">
              <tr>
                <td style="border-radius: 6px; background-color: #007bff;">
                  <a href="${resetUrl}" 
                     target="_blank"
                     style="display: inline-block; padding: 16px 32px; font-size: 16px; font-weight: bold; color: #ffffff; text-decoration: none; border-radius: 6px; background-color: #007bff; border: 2px solid #007bff; font-family: Arial, sans-serif;">
                    Reset Password
                  </a>
                </td>
              </tr>
            </table>
          </div>
          
          <p style="font-size: 14px; line-height: 1.6; color: #777; margin-bottom: 20px; text-align: center;">
            This link will expire in 1 hour for security reasons.
          </p>
          
          <div style="border-top: 1px solid #eee; padding-top: 25px; margin-top: 35px;">
            
            <div style="background-color: #fff3cd; padding: 15px; border-radius: 6px; border: 1px solid #ffeaa7; margin-bottom: 20px;">
              <p style="font-size: 14px; color: #856404; margin: 0; font-weight: bold;">
                ⚠️ Important Security Tips:
              </p>
              <ul style="font-size: 14px; color: #856404; margin: 8px 0 0 20px; padding: 0;">
                <li style="margin-bottom: 5px;">Never share this reset link with anyone</li>
                <li style="margin-bottom: 5px;">We will never ask for your password via email</li>
                <li style="margin-bottom: 0;">Choose a strong, unique password</li>
              </ul>
            </div>
            
            <p style="font-size: 14px; color: #999; margin-bottom: 10px;">
              <strong>Having trouble with the button?</strong>
            </p>
            <p style="font-size: 14px; color: #999; word-wrap: break-word; margin-bottom: 20px;">
              Copy and paste this link into your browser: <br>
              <a href="${resetUrl}" style="color: #007bff; text-decoration: underline;">${resetUrl}</a>
            </p>
            
            <div style="border-top: 1px solid #f0f0f0; padding-top: 20px; margin-top: 25px;">
              <p style="font-size: 12px; color: #999; margin-bottom: 8px;">
                <strong>Didn't request this reset?</strong> If you didn't request this password reset, please ignore this email or contact our support team if you have security concerns.
              </p>
              <p style="font-size: 12px; color: #999; margin-bottom: 8px;">
                <strong>Need help?</strong> Visit our help center or contact support at support@yourapp.com
              </p>
              <p style="font-size: 11px; color: #ccc; margin: 15px 0 0 0; text-align: center;">
                This is an automated message from WhatsERP. Please do not reply to this email.
              </p>
            </div>
            
          </div>
          
        </div>
      </body>
      </html>
    `,
      text: `Password Reset Request\n\nClick the link below to reset your password:\n${resetUrl}\n\nIf you didn't request this, please ignore this email.` // Add plain text version
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Password reset email sent:', info.messageId);
    return info;
    
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw error;
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
    const resetUrl = `${process.env.PASSWORD_RESET_PAGE_URL}?token=${resetToken}`;
    console.log('resetUrl', resetUrl);
    // send email with resetUrl
    sendPasswordResetEmail(email, resetUrl);

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