const express = require('express');
const router = express.Router();
const { signup, login, getProfile, requestPasswordReset, resetPassword } = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');

router.post('/signup', signup);
router.post('/login', login);
router.post('/request-password-reset', requestPasswordReset);
router.post('/reset-password', resetPassword);

router.use(authMiddleware);
router.get('/profile', getProfile);

module.exports = router; 