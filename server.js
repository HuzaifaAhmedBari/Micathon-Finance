const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
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

app.get('/supabase-config.js', (req, res) => {
  const config = {
    url: process.env.SUPABASE_URL || '',
    anonKey: process.env.SUPABASE_ANON_KEY || '',
  };

  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.type('application/javascript').send(`window.__SUPABASE_CONFIG__ = ${JSON.stringify(config)};`);
});



app.listen(PORT, () => {
  console.log(`HisaabPro Server running on http://localhost:${PORT}`);
});
