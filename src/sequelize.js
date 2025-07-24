const { Sequelize } = require('sequelize');
require('dotenv').config();

// Use only the exact environment variable names that are already configured
let sequelize;

try {
  // First, try to require pg explicitly
  require('pg');
  
  sequelize = new Sequelize(
    process.env.DATABASE_URL || 
    `postgresql://${process.env.PG_USER}:${process.env.PG_PASSWORD}@${process.env.PG_HOST}:${process.env.PG_PORT || 5432}/${process.env.PG_DATABASE}`,
    {
      dialect: 'postgres',
      logging: false,
      dialectOptions: {
        ssl: {
          rejectUnauthorized: false,
          ca: process.env.PG_SSL_CA
        }
      }
    }
  );
} catch (error) {
  console.error('Error initializing Sequelize:', error);
  
  // Fallback: try with minimal configuration
  try {
    sequelize = new Sequelize(
      process.env.DATABASE_URL || 
      `postgresql://${process.env.PG_USER}:${process.env.PG_PASSWORD}@${process.env.PG_HOST}:${process.env.PG_PORT || 5432}/${process.env.PG_DATABASE}`,
      {
        dialect: 'postgres',
        logging: false
      }
    );
  } catch (fallbackError) {
    console.error('Fallback configuration also failed:', fallbackError);
    throw new Error('Database configuration failed');
  }
}

module.exports = sequelize; 