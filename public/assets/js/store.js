// =========================================
// HisaabPro — API Client (Async)
// =========================================

const HP = (() => {
  // ── Helper: API Request ───────────────────────────────────────────
  async function apiRequest(endpoint, method = 'GET', body = null) {
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (body) {
      options.body = JSON.stringify(body);
    }
    const response = await fetch(`/api${endpoint}`, options);
    if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
    // Handle 204 No Content
    if (response.status === 204) return null;
    return response.json();
  }

  // ── Storage Variables (Cached Context) ────────────────────────────
  let UTILITY_PRESETS = [];

  // Load static presets from API
  async function init() {
    UTILITY_PRESETS = await apiRequest('/presets');
    return UTILITY_PRESETS;
  }

  // ── CRUD: Transactions ────────────────────────────────────────────
  async function getTransactions() {
    return await apiRequest('/transactions');
  }

  async function addTransaction(txn) {
    return await apiRequest('/transactions', 'POST', txn);
  }

  async function deleteTransaction(id) {
    return await apiRequest(`/transactions/${id}`, 'DELETE');
  }

  // ── CRUD: Inventory ───────────────────────────────────────────────
  async function getInventory() {
    return await apiRequest('/inventory');
  }

  async function addInventoryItem(item) {
    return await apiRequest('/inventory', 'POST', item);
  }

  async function updateInventoryItem(id, updates) {
    return await apiRequest(`/inventory/${id}`, 'PUT', updates);
  }

  // ── Analytics helpers ─────────────────────────────────────────────
  async function getSummary(days = 30) {
    const txns = await getTransactions();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    
    const recentTxns = txns.filter(t => new Date(t.date) >= cutoff);
    const totalIncome   = recentTxns.filter(t => t.type === 'sale').reduce((s, t) => s + t.amount, 0);
    const totalExpenses = recentTxns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    return { totalIncome, totalExpenses, netBalance: totalIncome - totalExpenses, count: recentTxns.length };
  }

  async function getTodaySummary() {
    const txns = await getTransactions();
    const today = new Date().toISOString().split('T')[0];
    
    const todayTxns = txns.filter(t => t.date === today);
    const sales    = todayTxns.filter(t => t.type === 'sale').reduce((s, t) => s + t.amount, 0);
    const expenses = todayTxns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    return { sales, expenses, profit: sales - expenses };
  }

  async function getCategoryBreakdown(days = 30) {
    const txns = await getTransactions();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    
    const recentTxns = txns.filter(t => t.type === 'expense' && new Date(t.date) >= cutoff);
    const totals = {};
    recentTxns.forEach(t => {
      totals[t.category] = (totals[t.category] || 0) + t.amount;
    });
    return totals;
  }

  async function getLowStockItems() {
    const inv = await getInventory();
    return inv.filter(i => (i.qty || 0) <= (i.lowThreshold || 5));
  }

  function getStockStatus(item) {
    if (!item) return 'good';
    const qty = item.qty || 0;
    const max = item.maxQty || 20;
    const threshold = item.lowThreshold || 5;
    
    const pct = qty / max;
    if (pct <= 0.15 || qty <= threshold) return 'low';
    if (pct <= 0.45) return 'medium';
    return 'good';
  }

  // ── Expose public API ─────────────────────────────────────────────
  return {
    init,
    get UTILITY_PRESETS() { return UTILITY_PRESETS; },
    getTransactions,
    addTransaction,
    deleteTransaction,
    getInventory,
    addInventoryItem,
    updateInventoryItem,
    getSummary,
    getTodaySummary,
    getCategoryBreakdown,
    getLowStockItems,
    getStockStatus,
  };
})();
