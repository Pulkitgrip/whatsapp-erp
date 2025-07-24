const { Sequelize } = require('sequelize');
require('dotenv').config();

let sequelize;

try {
  // Check if using SQLite (for local development/testing)
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('sqlite:')) {
    sequelize = new Sequelize(process.env.DATABASE_URL, {
      dialect: 'sqlite',
      logging: false,
      storage: './database.sqlite'
    });
  } else {
    // PostgreSQL configuration
    sequelize = new Sequelize(
      process.env.PG_DATABASE,
      process.env.PG_USER,
      process.env.PG_PASSWORD,
      {
        host: process.env.PG_HOST,
        port: process.env.PG_PORT,
        dialect: 'postgres',
        logging: false,
        dialectOptions: {
          ssl: {
            require: true,
            rejectUnauthorized: false
          }
        }
      }
    );
  }
} catch (error) {
  console.error('Error initializing Sequelize:', error);
  throw new Error('Database configuration failed');
}

module.exports = sequelize;
