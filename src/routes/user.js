const express = require('express');
const router = express.Router();
const { addUser } = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

// Apply auth middleware to all user routes
router.use(authMiddleware, roleMiddleware(['admin']));

router.post('/', addUser);

module.exports = router; 