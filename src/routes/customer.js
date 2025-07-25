const express = require('express');
const router = express.Router();
const { createCustomer, getCustomers, getCustomerById, updateCustomer, deleteCustomer, getUserCustomers, getCustomerUsers } = require('../controllers/customerController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

router.get('/user/:userId', getUserCustomers);
router.get('/:customerId/users', getCustomerUsers);

// Apply auth middleware to all customer routes
router.use(authMiddleware);

router.get('/', getCustomers);
router.get('/:id', getCustomerById);
router.post('/', roleMiddleware(['admin']), createCustomer);
router.patch('/:id', roleMiddleware(['admin']), updateCustomer);
router.delete('/:id', roleMiddleware(['admin']), deleteCustomer);

module.exports = router; 