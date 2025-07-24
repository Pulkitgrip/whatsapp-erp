const Product = require('../models/product');
const Category = require('../models/category');
const createError = require('http-errors');

exports.createProduct = async (req, res, next) => {
  try {
    const { name, categoryId, unitPrice, costPrice, lowStockThreshold } = req.body;
    const category = await Category.findByPk(categoryId);
    if (!category) return next(createError(400, 'Invalid category'));
    const product = await Product.create({ name, CategoryId: categoryId, unitPrice, costPrice, lowStockThreshold });
    res.status(201).json({ status: 200, message: 'Product created successfully', data: { product } });
  } catch (err) {
    next(err);
  }
};

exports.getProducts = async (req, res, next) => {
  try {
    const products = await Product.findAll({ include: Category });
    res.json({ status: 200, message: 'Products fetched successfully', data: { products } });
  } catch (err) {
    next(err);
  }
};

exports.getProductById = async (req, res, next) => {
  try {
    const product = await Product.findByPk(req.params.id, { include: Category });
    if (!product) return next(createError(404, 'Product not found'));
    res.json({ status: 200, message: 'Product fetched successfully', data: { product } });
  } catch (err) {
    next(err);
  }
};

exports.updateProduct = async (req, res, next) => {
  try {
    const product = await Product.findByPk(req.params.id);
    if (!product) return next(createError(404, 'Product not found'));
    const { name, categoryId, unitPrice, costPrice, lowStockThreshold } = req.body;
    if (categoryId) {
      const category = await Category.findByPk(categoryId);
      if (!category) return next(createError(400, 'Invalid category'));
      product.CategoryId = categoryId;
    }
    product.name = name || product.name;
    product.unitPrice = unitPrice !== undefined ? unitPrice : product.unitPrice;
    product.costPrice = costPrice !== undefined ? costPrice : product.costPrice;
    product.lowStockThreshold = lowStockThreshold !== undefined ? lowStockThreshold : product.lowStockThreshold;
    await product.save();
    res.json({ status: 200, message: 'Product updated successfully', data: { product } });
  } catch (err) {
    next(err);
  }
};

exports.deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findByPk(req.params.id);
    if (!product) return next(createError(404, 'Product not found'));
    await product.destroy();
    res.status(200).json({ status: 200, message: 'Product deleted successfully', data: null });
  } catch (err) {
    next(err);
  }
}; 