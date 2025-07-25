const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const authMiddleware = require('../middleware/authMiddleware');
const requireRole = require('../middleware/roleMiddleware');

router.get('/', productController.getProducts);

router.use(authMiddleware);
router.post('/', productController.createProduct);
router.get('/:id', productController.getProductById);

router.use(requireRole(['admin']));
router.patch('/:id', productController.updateProduct);
router.delete('/:id', productController.deleteProduct);

module.exports = router; 