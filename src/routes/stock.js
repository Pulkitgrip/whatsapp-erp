const express = require('express');
const router = express.Router();
const stockController = require('../controllers/stockController');
const auth = require('../middleware/authMiddleware');
const roleCheck = require('../middleware/roleMiddleware');

// Create new stock entry (admin only)
router.post('/', stockController.createStock);

// Get all stocks with pagination and filtering (admin only)
router.get('/', auth, roleCheck(['admin']), stockController.getStocks);

// Get low stock alerts (admin only)
router.get('/alerts/low-stock', auth, roleCheck(['admin']), stockController.getLowStockAlert);

// Get stock by ID (admin only)
router.get('/:id', auth, roleCheck(['admin']), stockController.getStockById);

// Update stock (admin only)
router.patch('/:id', auth, roleCheck(['admin']), stockController.updateStock);

// Delete stock (admin only)
router.delete('/:id', auth, roleCheck(['admin']), stockController.deleteStock);

// Get stocks by product ID (admin only)
router.get('/product/:productId', auth, roleCheck(['admin']), stockController.getStocksByProduct);

module.exports = router; 