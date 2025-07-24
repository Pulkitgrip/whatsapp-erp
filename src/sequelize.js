const { Sequelize } = require('sequelize');
require('dotenv').config();

const ca = process.env.PG_SSL_CA && Buffer.from(process.env.PG_SSL_CA.replace(/\\n/g, '\n'));

const sequelize = new Sequelize(
  process.env.PG_DATABASE,
  process.env.PG_USER,
  process.env.PG_PASSWORD,
  {
    host: process.env.PG_HOST,
    port: process.env.PG_PORT,
    dialect: 'postgres',
    dialectOptions: {
      ssl: {
        rejectUnauthorized: false,
        ca: ca,
      },
    },
    logging: false,
  }
);

module.exports = sequelize; 