// config/db.js
const mysql = require('mysql2');

// Create a connection pool for better performance and resource reuse
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: {
    ca: fs.readFileSync('../isrgrootx1.pem'),
    minVersion: 'TLSv1.2',
    rejectUnauthorized: true
  }
});

// Export the promise-based wrapper to support async/await syntax
module.exports = pool.promise();