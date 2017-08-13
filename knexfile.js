const dotenv = require('dotenv');
dotenv.load();
module.exports = {
  development: {
    client: 'mysql',
    connection: {
      host: process.env.MYSQL_DEV_URI,
      database: process.env.MYSQL_DEV_DB,
      user: process.env.MYSQL_DEV_USER,
      password: process.env.MYSQL_DEV_PASS
    }
  },
  production: {
    client: 'mysql',
    connection: {
      host: process.env.MYSQL_PROD_URI,
      database: process.env.MYSQL_PROD_DB,
      user: process.env.MYSQL_PROD_USER,
      password: process.env.MYSQL_PROD_PASS,
      port: process.env.MYSQL_PROD_PORT
    }
  }
}