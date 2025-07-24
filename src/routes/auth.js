const express = require('express');
const router = express.Router();
const { signup, login, getProfile } = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');

router.use('/signup', signup);
router.use('/login', login);

router.use(authMiddleware);
router.use('/profile', getProfile);

module.exports = router; 