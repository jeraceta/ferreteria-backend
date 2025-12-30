// db.js

const mysql = require('mysql2/promise'); 

const pool = mysql.createPool({
	host: process.env.DB_HOST || 'localhost',
	user: process.env.DB_USER || 'root',
	password: process.env.DB_PASSWORD || '', // set via env in production
	database: process.env.DB_NAME || 'ferreteria',
	port: Number(process.env.DB_PORT) || 3306,
	connectionLimit: Number(process.env.DB_CONNECTION_LIMIT) || 10
});

module.exports = pool;