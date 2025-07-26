const Stock = require('../models/stock');
const Product = require('../models/product');
const createError = require('http-errors');
const prepareQueryOptions = require('../utils/queryOptions');

exports.createStock = async (req, res, next) => {
  try {
    const { ProductId, availableQnt, buyPrice } = req.body;
    
    // Validate product exists
    const product = await Product.findByPk(ProductId);
    if (!product) {
      return next(createError(400, 'Invalid product ID'));
    }
    
    const stock = await Stock.create({
      ProductId,
      availableQnt,
      buyPrice,
      reservedQnt: 0
    });
    
    res.status(201).json({
      status: 201,
      message: 'Stock created successfully',
      data: { stock }
    });
  } catch (err) {
    next(err);
  }
};

exports.getStocks = async (req, res, next) => {
  try {
    const options = prepareQueryOptions(req.query, []);
    options.include = [
      {
        model: Product,
        attributes: ['id', 'name', 'unitPrice']
      }
    ];
    
    const totalCount = await Stock.count();
    const { count, rows: stocks } = await Stock.findAndCountAll(options);
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    
    res.json({
      status: 200,
      message: 'Stocks fetched successfully',
      data: {
        count,
        totalCount,
        page,
        limit,
        stocks
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.getStockById = async (req, res, next) => {
  try {
    const stock = await Stock.findByPk(req.params.id, {
      include: [
        {
          model: Product,
          attributes: ['id', 'name', 'unitPrice', 'costPrice']
        }
      ]
    });
    
    if (!stock) {
      return next(createError(404, 'Stock not found'));
    }
    
    res.json({
      status: 200,
      message: 'Stock fetched successfully',
      data: { stock }
    });
  } catch (err) {
    next(err);
  }
};

exports.updateStock = async (req, res, next) => {
  try {
    const stock = await Stock.findByPk(req.params.id);
    if (!stock) {
      return next(createError(404, 'Stock not found'));
    }
    
    const { availableQnt, buyPrice, reservedQnt } = req.body;
    
    if (availableQnt !== undefined) {
      stock.availableQnt = availableQnt;
    }
    
    if (buyPrice !== undefined) {
      stock.buyPrice = buyPrice;
    }
    
    if (reservedQnt !== undefined) {
      stock.reservedQnt = reservedQnt;
    }
    
    await stock.save();
    
    res.json({
      status: 200,
      message: 'Stock updated successfully',
      data: { stock }
    });
  } catch (err) {
    next(err);
  }
};

exports.deleteStock = async (req, res, next) => {
  try {
    const stock = await Stock.findByPk(req.params.id);
    if (!stock) {
      return next(createError(404, 'Stock not found'));
    }
    
    await stock.destroy();
    
    res.status(200).json({
      status: 200,
      message: 'Stock deleted successfully',
      data: null
    });
  } catch (err) {
    next(err);
  }
};

exports.getStocksByProduct = async (req, res, next) => {
  try {
    const { productId } = req.params;
    
    const stocks = await Stock.findAll({
      where: { ProductId: productId },
      include: [
        {
          model: Product,
          attributes: ['id', 'name', 'unitPrice', 'costPrice']
        }
      ],
      order: [['createdAt', 'ASC']]
    });
    
    res.json({
      status: 200,
      message: 'Product stocks fetched successfully',
      data: { stocks }
    });
  } catch (err) {
    next(err);
  }
};

exports.getLowStockAlert = async (req, res, next) => {
  try {
    const stocks = await Stock.findAll({
      include: [
        {
          model: Product,
          attributes: ['id', 'name', 'unitPrice', 'costPrice', 'lowStockThreshold'],
          where: {
            lowStockThreshold: {
              [require('../sequelize').Op.gt]: require('../sequelize').literal('`Stock`.`availableQnt`')
            }
          }
        }
      ],
      order: [['availableQnt', 'ASC']]
    });
    
    res.json({
      status: 200,
      message: 'Low stock items fetched successfully',
      data: { stocks }
    });
  } catch (err) {
    next(err);
  }
}; 