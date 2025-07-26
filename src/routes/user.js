const express = require('express');
const router = express.Router();
<<<<<<< HEAD
const { addUser, getUsers, updateUser, deleteUser, getMe } = require('../controllers/userController');
=======
const { addUser, getUsers, updateUser, deleteUser, getUserById } = require('../controllers/userController');
>>>>>>> 16eea7a29689975b0569d4b78a32c15c42427419
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

// Apply auth middleware to all user routes
router.use(authMiddleware);

router.get('/me', getMe);
router.get('/', getUsers);
router.post('/', roleMiddleware(['admin']), addUser);
router.get('/:id', roleMiddleware(['admin']), getUserById);
router.patch('/:id', roleMiddleware(['admin']), updateUser);
router.delete('/:id', roleMiddleware(['admin']), deleteUser);

module.exports = router; 