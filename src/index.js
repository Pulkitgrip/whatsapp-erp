require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sequelize = require('./sequelize');
const User = require('./models/user');
const errorHandler = require('./middleware/errorHandler');
const createError = require('http-errors');

const app = express();
app.use(cors());
app.use(express.json());

// Sync Sequelize models
sequelize.sync({alter: true})
  .then(() => console.log('Database synced'))
  .catch((err) => console.error('Sequelize sync error:', err));

// Import routes
app.use('/api', require('./routes/index'));

// 404 handler
app.use((req, res, next) => {
  next(createError(404, 'Not Found'));
});

// Centralized error handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 