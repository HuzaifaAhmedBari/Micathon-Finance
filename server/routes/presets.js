const express = require('express');
const router = express.Router();
const db = require('../db');

// GET: Utility Presets
router.get('/', (req, res) => {
  res.json(db.UTILITY_PRESETS);
});

module.exports = router;
