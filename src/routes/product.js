const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);
router.post('/', productController.createProduct);
router.get('/', productController.getProducts);
router.get('/:id', productController.getProductById);
router.patch('/:id', productController.updateProduct);
router.delete('/:id', productController.deleteProduct);

module.exports = router; 