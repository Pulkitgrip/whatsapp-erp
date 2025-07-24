const express = require('express');
const router = express.Router();
const { signup, login } = require('../controllers/authController');

router.use('/signup', signup);
router.use('/login', login);

module.exports = router; 