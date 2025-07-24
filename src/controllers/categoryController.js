const Category = require('../models/category');
const createError = require('http-errors');
const prepareQueryOptions = require('../utils/queryOptions');

exports.createCategory = async (req, res, next) => {
  try {
    const { name } = req.body;
    const category = await Category.create({ name });
    res.status(201).json({ status: 200, message: 'Category created successfully', data: { category } });
  } catch (err) {
    next(err);
  }
};

exports.getCategories = async (req, res, next) => {
  try {
    const options = prepareQueryOptions(req.query, ['name']);
    // Remove limit/offset for total count
    const totalCount = await Category.count();
    // Use findAndCountAll for filtered count and results
    const { count, rows: categories } = await Category.findAndCountAll(options);
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    res.json({
      status: 200,
      message: 'Categories fetched successfully',
      data: {
      count,        
      totalCount,  
      page,
      limit,
      categories
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.getCategoryById = async (req, res, next) => {
  try {
    const category = await Category.findByPk(req.params.id);
    if (!category) return next(createError(404, 'Category not found'));
    res.json({ status: 200, message: 'Category fetched successfully', data: { category } });
  } catch (err) {
    next(err);
  }
};

exports.updateCategory = async (req, res, next) => {
  try {
    const category = await Category.findByPk(req.params.id);
    if (!category) return next(createError(404, 'Category not found'));
    category.name = req.body.name || category.name;
    await category.save();
    res.json({ status: 200, message: 'Category updated successfully', data: { category } });
  } catch (err) {
    next(err);
  }
};

exports.deleteCategory = async (req, res, next) => {
  try {
    const category = await Category.findByPk(req.params.id);
    if (!category) return next(createError(404, 'Category not found'));
    await category.destroy();
    res.status(200).json({ status: 200, message: 'Category deleted successfully', data: null });
  } catch (err) {
    next(err);
  }
}; 