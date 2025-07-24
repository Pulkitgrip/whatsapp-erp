const express = require('express');
const router = express.Router();
const { addUser, getUsers, updateUser, deleteUser } = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

// Apply auth middleware to all user routes
router.use(authMiddleware);

router.get('/', getUsers);
router.post('/', roleMiddleware(['admin']), addUser);
router.patch('/:id', roleMiddleware(['admin']), updateUser);
router.delete('/:id', roleMiddleware(['admin']), deleteUser);

module.exports = router; 