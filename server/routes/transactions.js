const express = require('express');
const router = express.Router();
const db = require('../db');

function normalizeUserKey(value) {
  return String(value || '').trim().toLowerCase();
}

// GET: All transactions
router.get('/', (req, res) => {
  const userKey = normalizeUserKey(req.query.userKey);
  if (!userKey) {
    return res.status(400).json({ error: 'userKey is required' });
  }

  const data = db.readData();
  const rows = data.transactions.filter(t => normalizeUserKey(t.userKey) === userKey);
  res.json(rows);
});

// POST: Log a new transaction
router.post('/', (req, res) => {
  const txn = req.body;
  const userKey = normalizeUserKey(txn.userKey);
  if (!userKey) {
    return res.status(400).json({ error: 'userKey is required' });
  }

  const data = db.readData();
  
  txn.id = 'txn_' + Date.now();
  txn.userKey = userKey;
  
  // Implicit Inventory Creation for Misc Expenses
  if (txn.type === 'expense' && txn.category === 'Misc' && !txn.inventoryItemId) {
    const invItem = {
      id: 'inv_' + Date.now(),
      userKey,
      name: txn.description,
      category: 'Misc',
      qty: txn.inventoryQtyChange || 1,
      unit: 'pcs',
      costPrice: txn.inventoryQtyChange ? (txn.amount / txn.inventoryQtyChange) : txn.amount,
      salePrice: txn.inventoryQtyChange ? (txn.amount / txn.inventoryQtyChange) * 1.2 : txn.amount * 1.2, // Default 20% markup
      maxQty: parseInt(txn.inventoryQtyChange || 1) * 2 || 10,
      lowThreshold: 2
    };
    data.inventory.push(invItem);
    txn.inventoryItemId = invItem.id;
    txn.inventoryQtyChange = null; 
  }

  data.transactions.unshift(txn);

  // If it's an inventory restock, update inventory qty
  if (txn.inventoryItemId && txn.inventoryQtyChange && txn.type === 'expense') {
    const item = data.inventory.find(i => i.id === txn.inventoryItemId && normalizeUserKey(i.userKey) === userKey);
    if (item) {
      item.qty = Math.max(0, item.qty + txn.inventoryQtyChange);
      
      // Auto-expand maxQty so progress bars and logic adapt organically
      if (item.maxQty && item.qty > item.maxQty) {
        item.maxQty = item.qty;
      }
    }
  }

  // If it's a sale of an inventory item, decrease qty
  if (txn.inventoryItemId && txn.type === 'sale') {
    const item = data.inventory.find(i => i.id === txn.inventoryItemId && normalizeUserKey(i.userKey) === userKey);
    if (item && item.qty > 0) {
      item.qty = Math.max(0, item.qty - (txn.inventoryQtyChange || 1));
    }
  }

  db.writeData(data);
  res.status(201).json(txn);
});

// DELETE: Remove transaction
router.delete('/:id', (req, res) => {
  const userKey = normalizeUserKey(req.query.userKey);
  if (!userKey) {
    return res.status(400).json({ error: 'userKey is required' });
  }

  const data = db.readData();
  const before = data.transactions.length;
  data.transactions = data.transactions.filter(t => !(t.id === req.params.id && normalizeUserKey(t.userKey) === userKey));
  if (before === data.transactions.length) {
    return res.status(404).json({ error: 'Transaction not found' });
  }
  db.writeData(data);
  res.status(204).end();
});

module.exports = router;
