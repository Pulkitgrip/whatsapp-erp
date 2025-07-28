const { Sequelize } = require('sequelize');
require('dotenv').config();

let sequelize;

try {
  // PostgreSQL configuration using individual credentials (no DATABASE_URL)
  sequelize = new Sequelize(
    process.env.PG_DATABASE,
    process.env.PG_USER , 
    process.env.PG_PASSWORD,
    {
      host: process.env.PG_HOST ,
      port: process.env.PG_PORT,
      dialect: 'postgres',
      logging: false,
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false,
          ca: process.env.PG_SSL_CA
        }
      }
    }
  );
} catch (error) {
  console.error('Error initializing Sequelize:', error);
  throw new Error('Database configuration failed');
}

module.exports = sequelize;
