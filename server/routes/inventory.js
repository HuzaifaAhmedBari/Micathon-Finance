const express = require('express');
const router = express.Router();
const db = require('../db');

function normalizeUserKey(value) {
  return String(value || '').trim().toLowerCase();
}

// GET: List inventory
router.get('/', (req, res) => {
  const userKey = normalizeUserKey(req.query.userKey);
  if (!userKey) {
    return res.status(400).json({ error: 'userKey is required' });
  }

  const data = db.readData();
  const rows = data.inventory.filter(i => normalizeUserKey(i.userKey) === userKey);
  res.json(rows);
});

// POST: Create new item
router.post('/', (req, res) => {
  const item = req.body;
  const userKey = normalizeUserKey(item.userKey);
  if (!userKey) {
    return res.status(400).json({ error: 'userKey is required' });
  }

  const data = db.readData();
  
  // Dozen multiplier logic
  if (item.unit === 'dozen') {
    item.qty = (item.qty || 0) * 12;
    
    // Scale prices and thresholds dynamically to reflect partials (pieces)
    if (item.costPrice) item.costPrice = item.costPrice / 12;
    if (item.salePrice) item.salePrice = item.salePrice / 12;
    if (item.maxQty) item.maxQty = item.maxQty * 12;
    if (item.lowThreshold) item.lowThreshold = item.lowThreshold * 12;

    item.unit = 'pcs';
  }

  item.id = 'inv_' + Date.now();
  item.userKey = userKey;
  data.inventory.push(item);
  
  db.writeData(data);
  res.status(201).json(item);
});

// PUT: Update item
router.put('/:id', (req, res) => {
  const userKey = normalizeUserKey(req.query.userKey || req.body.userKey);
  if (!userKey) {
    return res.status(400).json({ error: 'userKey is required' });
  }

  const data = db.readData();
  const idx = data.inventory.findIndex(i => i.id === req.params.id && normalizeUserKey(i.userKey) === userKey);
  
  if (idx !== -1) {
    data.inventory[idx] = { ...data.inventory[idx], ...req.body, userKey };
    db.writeData(data);
    res.json(data.inventory[idx]);
  } else {
    res.status(404).json({ error: 'Item not found' });
  }
});

module.exports = router;
