const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data.json');

// Initialize empty DB if not present
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify({ transactions: [], inventory: [] }));
}

function readData() {
  const data = fs.readFileSync(DATA_FILE, 'utf-8');
  return JSON.parse(data);
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
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
