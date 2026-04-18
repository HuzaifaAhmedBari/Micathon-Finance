// Local API runtime cache only (no data.json reads/writes).
const memoryData = {
  transactions: [],
  inventory: [],
};

// Backfill missing user keys for legacy/demo rows in memory only.
if (Array.isArray(memoryData.transactions)) {
  memoryData.transactions = memoryData.transactions.map(txn => {
    if (txn && !txn.userKey) {
      return { ...txn, userKey: 'demo-owner@hisaabpro.test' };
    }
    return txn;
  });
}

if (Array.isArray(memoryData.inventory)) {
  memoryData.inventory = memoryData.inventory.map(item => {
    if (item && !item.userKey) {
      return { ...item, userKey: 'demo-owner@hisaabpro.test' };
    }
    return item;
  });
}

function readData() {
  return {
    transactions: Array.isArray(memoryData.transactions) ? [...memoryData.transactions] : [],
    inventory: Array.isArray(memoryData.inventory) ? [...memoryData.inventory] : [],
  };
}

function writeData(data) {
  memoryData.transactions = Array.isArray(data.transactions) ? data.transactions : [];
  memoryData.inventory = Array.isArray(data.inventory) ? data.inventory : [];
}

// ── Utility Presets ──────────────────────────────────────────────
const UTILITY_PRESETS = [
  { id: 'util_elec',    name: 'Electricity Bill',   category: 'Utilities',  type: 'expense' },
  { id: 'util_gas',     name: 'Gas Bill',           category: 'Utilities',  type: 'expense' },
  { id: 'util_water',   name: 'Water Bill',         category: 'Utilities',  type: 'expense' },
  { id: 'util_rent',    name: 'Monthly Rent',       category: 'Rent',       type: 'expense' },
  { id: 'util_phone',   name: 'Phone / Internet',   category: 'Utilities',  type: 'expense' },
  { id: 'misc_bags',    name: 'Shopping Bags',      category: 'Misc',       type: 'expense' },
  { id: 'misc_clean',   name: 'Cleaning Supplies',  category: 'Misc',       type: 'expense' },
  { id: 'misc_wages',   name: 'Staff Wages',        category: 'Misc',       type: 'expense' },
  { id: 'misc_repair',  name: 'Repairs',            category: 'Misc',       type: 'expense' },
  { id: 'misc_trans',   name: 'Transport Fare',     category: 'Misc',       type: 'expense' },
  { id: 'misc_tea',     name: 'Tea/Snacks for Shop',category: 'Misc',       type: 'expense' }
];

module.exports = {
  readData,
  writeData,
  UTILITY_PRESETS
};
