const { Op } = require('sequelize');

/**
 * Prepares Sequelize findAll options for pagination, search, and sorting.
 * @param {Object} params - The query params (e.g., req.query)
 * @param {string[]} searchableFields - Fields to search on
 * @returns {Object} Sequelize findAll options
 */
function prepareQueryOptions(params, searchableFields = []) {
  const options = {};

  // Pagination
  const page = parseInt(params.page, 10) || 1;
  const limit = parseInt(params.limit, 10) || 10;
  options.limit = limit;
  options.offset = (page - 1) * limit;

  // Search
  if (params.search && searchableFields.length > 0) {
    options.where = {
      [Op.or]: searchableFields.map(field => ({
        [field]: { [Op.iLike]: `%${params.search}%` }
      }))
    };
  }

  // Sorting
  if (params.sortBy) {
    const order = params.sortOrder && params.sortOrder.toLowerCase() === 'desc' ? 'DESC' : 'ASC';
    options.order = [[params.sortBy, order]];
  }

  return options;
}

module.exports = prepareQueryOptions; 