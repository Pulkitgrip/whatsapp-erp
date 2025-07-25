const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const auth = require('../middleware/authMiddleware');
const roleCheck = require('../middleware/roleMiddleware');

// Get product demands (admin only)
router.get('/demands/list', auth, roleCheck(['admin']), orderController.getProductDemands);


// Create new order
router.post('/', auth, orderController.createOrder);

// Get all orders (admin only)
router.get('/', auth, roleCheck(['admin', 'sales']), orderController.getOrders);

// Get order by ID
router.get('/:id', auth, orderController.getOrderById);

// Update order status (admin only)
router.patch('/:id', auth, roleCheck(['admin', 'sales']), orderController.updateOrderStatus);


module.exports = router; 