// Bypass self-signed cert issues (e.g. Zscaler / corporate proxies) when making external API calls
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config(); 
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Import the database pool to test the connection on startup
const pool = require('./config/db'); 

// Import file router
const fileRoutes = require('./routes/fileRoutes');
const kafkaRoutes = require('./routes/kafkaRoutes');


const app = express();

// Middleware
app.use(cors());
app.use(express.json()); 

// Mount the routes
app.use('/', fileRoutes); 
app.use('/', kafkaRoutes);

app.use(express.static(path.join(__dirname, '../frontend')));

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Frontend is live at: http://localhost:${PORT}`);
    console.log(`Ctrl + Click the link above to open it in your browser!`);
});