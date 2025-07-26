const express = require('express');
const router = express.Router();
const { addUser, getUsers, updateUser, deleteUser, getMe ,getUserById} = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const User = require('../models/user'); // Added missing import for User model

// Apply auth middleware to all user routes
router.use(authMiddleware);

router.get('/me', getMe);
router.get('/', getUsers);
router.post('/', roleMiddleware(['admin']), addUser);
router.get('/:id', roleMiddleware(['admin']), getUserById);
router.patch('/:id', roleMiddleware(['admin']), updateUser);
router.delete('/:id', roleMiddleware(['admin']), deleteUser);

/**
 * GET /users/check-status
 * Check user status and optionally activate user for testing
 */
router.get('/check-status', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    console.log('Checking user status for ID:', userId);

    const user = await User.findByPk(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const userStatus = {
      id: user.id,
      email: user.email,
      name: user.name,
      isActive: user.isActive,
      role: user.role,
      createdAt: user.createdAt
    };

    console.log('User status:', userStatus);

    res.json({
      success: true,
      data: userStatus
    });
  } catch (error) {
    console.error('Error checking user status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /users/activate
 * Activate user for testing
 */
router.post('/activate', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    console.log('Activating user for ID:', userId);

    const user = await User.findByPk(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Update user to active
    await user.update({ isActive: true });

    console.log('User activated:', user.email);

    res.json({
      success: true,
      message: 'User activated successfully',
      data: {
        id: user.id,
        email: user.email,
        isActive: user.isActive
      }
    });
  } catch (error) {
    console.error('Error activating user:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router; 