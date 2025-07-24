const Category = require('../models/category');
const createError = require('http-errors');

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
    const categories = await Category.findAll();
    res.json({ status: 200, message: 'Categories fetched successfully', data: { categories } });
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