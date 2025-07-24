const express = require('express');
const router = express.Router();
const { addUser, getUsers } = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

// Apply auth middleware to all user routes
router.use(authMiddleware,);

router.post('/', roleMiddleware(['admin']), addUser);
router.get('/', getUsers);

module.exports = router; 