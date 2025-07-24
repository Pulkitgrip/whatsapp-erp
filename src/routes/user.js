const express = require('express');
const router = express.Router();
const { addUser } = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');

// Apply auth middleware to all user routes
router.use(authMiddleware);

router.post('/', addUser);

module.exports = router; 