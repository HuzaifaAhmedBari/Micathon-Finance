const express = require('express');
const router = express.Router();
const db = require('../db');

// GET: All transactions
router.get('/', (req, res) => {
  const data = db.readData();
  res.json(data.transactions);
});

// POST: Log a new transaction
router.post('/', (req, res) => {
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
    const item = data.inventory.find(i => i.id === txn.inventoryItemId);
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
    const item = data.inventory.find(i => i.id === txn.inventoryItemId);
    if (item && item.qty > 0) {
      item.qty = Math.max(0, item.qty - (txn.inventoryQtyChange || 1));
    }
  }

  db.writeData(data);
  res.status(201).json(txn);
});

// DELETE: Remove transaction
router.delete('/:id', (req, res) => {
  const data = db.readData();
  data.transactions = data.transactions.filter(t => t.id !== req.params.id);
  db.writeData(data);
  res.status(204).end();
});

module.exports = router;
