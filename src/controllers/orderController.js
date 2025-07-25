const Order = require('../models/order');
const OrderItem = require('../models/orderItem');
const Stock = require('../models/stock');
const Product = require('../models/product');
const User = require('../models/user');
const Customer = require('../models/customer');
const UserCustomer = require('../models/userCustomer');
const ProductDemand = require('../models/productDemand');
const createError = require('http-errors');
const sequelize = require('../sequelize');
const { Op } = require('sequelize');
const prepareQueryOptions = require('../utils/queryOptions');

exports.createOrder = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { items, userMobileNo } = req.body;
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return next(createError(400, 'Items array is required and cannot be empty'));
    }
    
    if (!userMobileNo) {
      return next(createError(400, 'User mobile number is required'));
    }

    // Step 1: Fetch user by mobile number
    const user = await User.findOne({
      where: { mobileNo: userMobileNo }
    });

    if (!user) {
      return next(createError(404, 'User not found with the provided mobile number'));
    }

    // Step 2: Fetch the first customer of the user
    const userCustomer = await UserCustomer.findOne({
      where: { userId: user.id },
      include: [Customer]
    });

    if (!userCustomer) {
      return next(createError(404, 'No customer found for this user'));
    }

    const customer = userCustomer.Customer;
    
    // Step 3: Process items and check stock availability
    const availableItems = [];
    const unavailableItems = [];
    let totalAmount = 0;

    for (const item of items) {
      const { ProductId, quantity } = item;

      if (!ProductId || !quantity || quantity <= 0) {
        continue; // Skip invalid items
      }

      // Get product details
      const product = await Product.findByPk(ProductId);
      if (!product) {
        continue; // Skip if product doesn't exist
      }

      // Find available stock for this product
      const stock = await Stock.findOne({
        where: { 
          ProductId: ProductId,
          availableQnt: { [Op.gte]: quantity }
        },
        order: [['createdAt', 'ASC']] // FIFO - First In, First Out
      });

      if (stock) {
        // Stock available
        availableItems.push({
          ProductId,
          StockId: stock.id,
          quantity,
          unitPrice: stock.buyPrice,
          totalPrice: quantity * stock.buyPrice,
          productName: product.name
        });
        totalAmount += quantity * stock.buyPrice;
      } else {
        // Stock not available - log demand
        unavailableItems.push({
          ProductId,
          productName: product.name,
          quantity,
          UserId: user.id,
          CustomerId: customer.id
        });

        // Create demand record
        await ProductDemand.create({
          ProductId,
          productName: product.name,
          quantity,
          UserId: user.id,
          CustomerId: customer.id
        }, { transaction });
      }
    }

    if (availableItems.length === 0) {
      // Log demand for all unavailable items
      await transaction.rollback(); // Rollback first

      for (const item of unavailableItems) {
        await ProductDemand.create({
          ProductId: item.ProductId,
          productName: item.productName,
          quantity: item.quantity,
          UserId: item.UserId,
          CustomerId: item.CustomerId
        }); // No transaction here
      }
      return res.status(200).json({
        status: 200,
        message: 'No items could be processed due to insufficient stock',
        data: {
          order: null,
          unavailableItems: unavailableItems
        }
      });
    }

    // Step 4: Create order with pending status
    const order = await Order.create({
      amount: totalAmount,
      status: 'pending',
      paymentStatus: 'pending',
      UserId: user.id,
      CustomerId: customer.id
    }, { transaction });

    // Step 5: Create order items and adjust stock
    const createdOrderItems = [];
    
    for (const item of availableItems) {
      // Create order item
      const orderItem = await OrderItem.create({
        OrderId: order.id,
        ProductId: item.ProductId,
        StockId: item.StockId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice
      }, { transaction });

      createdOrderItems.push(orderItem);

      // Adjust stock quantities
      const stock = await Stock.findByPk(item.StockId, { transaction });
      await stock.update({
        availableQnt: stock.availableQnt - item.quantity,
        reservedQnt: stock.reservedQnt + item.quantity
      }, { transaction });
    }

    await transaction.commit();

    // Prepare response
    const response = {
      status: 201,
      message: 'Order created successfully',
      data: {
        order: {
          id: order.id,
          amount: order.amount,
          status: order.status,
          paymentStatus: order.paymentStatus,
          userId: order.UserId,
          customerId: order.CustomerId,
          items: createdOrderItems
        },
        processedItems: availableItems.length,
        totalItems: items.length
      }
    };

    if (unavailableItems.length > 0) {
      response.data.unavailableItems = unavailableItems;
      response.message += ` (${unavailableItems.length} items were unavailable and logged for demand tracking)`;
    }

    res.status(201).json(response);

  } catch (err) {
    await transaction.rollback();
    next(err);
  }
};

exports.getOrders = async (req, res, next) => {
  try {
    // Prepare query options for pagination, search, and sorting
    const options = prepareQueryOptions(req.query, []);

    // Add filter for order status and paymentStatus
    options.where = options.where || {};
    if (req.query.status) {
      options.where.status = req.query.status;
    }
    if (req.query.paymentStatus) {
      options.where.paymentStatus = req.query.paymentStatus;
    }

    // Always include these associations
    options.include = [
      {
        model: User,
        attributes: ['id', 'name', 'email', 'mobileNo']
      },
      {
        model: Customer,
        attributes: ['id', 'name', 'gstNo', 'address']
      },
      {
        model: OrderItem,
        include: [
          {
            model: Product,
            attributes: ['id', 'name', 'unitPrice']
          },
          {
            model: Stock,
            attributes: ['id', 'buyPrice']
          }
        ]
      }
    ];

    // Default sort if not provided
    if (!options.order) {
      options.order = [['createdAt', 'DESC']];
    }

    // Get total count for all orders (without filters)
    const totalCount = await Order.count();
    // Get filtered count and results
    const { count, rows: orders } = await Order.findAndCountAll(options);
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;

    res.json({
      status: 200,
      message: 'Orders fetched successfully',
      data: {
        count,
        totalCount,
        page,
        limit,
        orders
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.getOrderById = async (req, res, next) => {
  try {
    const order = await Order.findByPk(req.params.id, {
      include: [
        {
          model: User,
          attributes: ['id', 'name', 'email', 'mobileNo']
        },
        {
          model: Customer,
          attributes: ['id', 'name', 'gstNo', 'address']
        },
        {
          model: OrderItem,
          include: [
            {
              model: Product,
              attributes: ['id', 'name', 'unitPrice']
            },
            {
              model: Stock,
              attributes: ['id', 'buyPrice']
            }
          ]
        }
      ]
    });

    if (!order) {
      return next(createError(404, 'Order not found'));
    }

    res.json({
      status: 200,
      message: 'Order fetched successfully',
      data: { order }
    });
  } catch (err) {
    next(err);
  }
};

exports.updateOrderStatus = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { status, paymentStatus } = req.body;
    const order = await Order.findByPk(req.params.id, { include: [OrderItem] });
    if (!order) {
      await transaction.rollback();
      return next(createError(404, 'Order not found'));
    }

    // Track if we need to update stock
    let updateStock = false;
    let stockAction = null;
    if (status && status !== order.status) {
      if (status === 'confirmed') {
        updateStock = true;
        stockAction = 'deduct_reserved';
      } else if (status === 'cancelled') {
        updateStock = true;
        stockAction = 'cancel_restore';
      }
      order.status = status;
    }
    if (paymentStatus) {
      order.paymentStatus = paymentStatus;
    }
    await order.save({ transaction });

    // Update stock if needed
    if (updateStock) {
      for (const item of order.OrderItems) {
        const stock = await Stock.findByPk(item.StockId, { transaction });
        if (!stock) continue;
        if (stockAction === 'deduct_reserved') {
          // Deduct from reservedQnt only
          stock.reservedQnt = Math.max(0, stock.reservedQnt - item.quantity);
          await stock.save({ transaction });
        } else if (stockAction === 'cancel_restore') {
          // Move reservedQnt back to availableQnt
          stock.reservedQnt = Math.max(0, stock.reservedQnt - item.quantity);
          stock.availableQnt += item.quantity;
          await stock.save({ transaction });
        }
      }
    }

    await transaction.commit();
    res.json({
      status: 200,
      message: 'Order updated successfully',
      data: { order }
    });
  } catch (err) {
    await transaction.rollback();
    next(err);
  }
};

exports.getProductDemands = async (req, res, next) => {
  try {
    const demands = await ProductDemand.findAll({
      include: [
        {
          model: Product,
          attributes: ['id', 'name', 'unitPrice']
        },
        {
          model: User,
          attributes: ['id', 'name', 'email', 'mobileNo']
        },
        {
          model: Customer,
          attributes: ['id', 'name', 'gstNo']
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json({
      status: 200,
      message: 'Product demands fetched successfully',
      data: { demands }
    });
  } catch (err) {
    next(err);
  }
}; 