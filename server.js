const express = require('express');
const cors = require('cors');
const path = require('path');
const apiRoutes = require('./server/routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api', apiRoutes);



app.listen(PORT, () => {
  console.log(`HisaabPro Server running on http://localhost:${PORT}`);
});
