const express = require('express');
const router = express.Router();
const db = require('../db');

// ── GET: Utility Presets ──
router.get('/presets', (req, res) => {
  res.json(db.UTILITY_PRESETS);
});

// ── TRANSACTIONS ──
router.get('/transactions', (req, res) => {
  const data = db.readData();
  res.json(data.transactions);
});

router.post('/transactions', (req, res) => {
  const txn = req.body;
  const data = db.readData();
  
  txn.id = 'txn_' + Date.now();
  
  // Implicit Inventory Creation for Misc Expenses
  if (txn.type === 'expense' && txn.category === 'Misc' && !txn.inventoryItemId) {
    const invItem = {
      id: 'inv_' + Date.now(),
      name: txn.description,
      category: 'Misc',
      qty: txn.inventoryQtyChange || 1,
      unit: 'pcs',
      costPrice: txn.inventoryQtyChange ? (txn.amount / txn.inventoryQtyChange) : txn.amount,
      maxQty: parseInt(txn.inventoryQtyChange || 1) * 2 || 10,
      lowThreshold: 2
    };
    data.inventory.push(invItem);
    txn.inventoryItemId = invItem.id;
    txn.inventoryQtyChange = null; 
  }

  data.transactions.unshift(txn);

  // If it's an inventory restock, update inventory qty
  if (txn.inventoryItemId && txn.inventoryQtyChange) {
    const item = data.inventory.find(i => i.id === txn.inventoryItemId);
    if (item) {
      item.qty = Math.max(0, item.qty + txn.inventoryQtyChange);
    }
  }

  // If it's a sale of an inventory item, decrease qty
  if (txn.inventoryItemId && txn.type === 'sale') {
    const item = data.inventory.find(i => i.id === txn.inventoryItemId);
    if (item && item.qty > 0) {
      item.qty = Math.max(0, item.qty - (txn.inventoryQtyChange || 1));
    }
  }

  db.writeData(data);
  res.status(201).json(txn);
});

router.delete('/transactions/:id', (req, res) => {
  const data = db.readData();
  data.transactions = data.transactions.filter(t => t.id !== req.params.id);
  db.writeData(data);
  res.status(204).end();
});

// ── INVENTORY ──
router.get('/inventory', (req, res) => {
  const data = db.readData();
  res.json(data.inventory);
});

router.post('/inventory', (req, res) => {
  const item = req.body;
  const data = db.readData();
  
  item.id = 'inv_' + Date.now();
  data.inventory.push(item);
  
  db.writeData(data);
  res.status(201).json(item);
});

router.put('/inventory/:id', (req, res) => {
  const data = db.readData();
  const idx = data.inventory.findIndex(i => i.id === req.params.id);
  
  if (idx !== -1) {
    data.inventory[idx] = { ...data.inventory[idx], ...req.body };
    db.writeData(data);
    res.json(data.inventory[idx]);
  } else {
    res.status(404).json({ error: 'Item not found' });
  }
});

module.exports = router;
