const { Pool } = require('pg');
require('dotenv').config(); 


const pool = new Pool({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
});


pool.connect((err, client, release) => {
    if (err) {
        console.error('Error acquiring client from database pool:', err.stack);
    } else {
        console.log('Successfully connected to the PostgreSQL database.');
    }
    if (client) release(); 
});

module.exports = pool;