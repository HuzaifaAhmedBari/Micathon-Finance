const express = require('express');
const router = express.Router();

const presetsRouter = require('./presets');
const transactionsRouter = require('./transactions');
const inventoryRouter = require('./inventory');

// Mount routes
router.use('/presets', presetsRouter);
router.use('/transactions', transactionsRouter);
router.use('/inventory', inventoryRouter);

module.exports = router;
