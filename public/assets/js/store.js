// =========================================
// HisaabPro — API Client (Async)
// =========================================

const HP = (() => {
  function parseDateKey(value) {
    const key = String(value || '').slice(0, 10);
    const [y, m, d] = key.split('-').map(Number);
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
    return new Date(y, m - 1, d);
  }

  function currentLocalDateKey() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function getSupabaseClient() {
    if (!window.supabase) return null;
    const config = window.supabase._config || {};
    if (!config.url || !config.anonKey) return null;
    return window.supabase;
  }

  function requireSupabaseClient() {
    const client = getSupabaseClient();
    if (!client) {
      throw new Error('Supabase is required for data persistence. Check /supabase-config.js and Supabase client loading.');
    }
    return client;
  }

  function getUserKey() {
    const account = window.HPAccount && typeof window.HPAccount.readAccount === 'function'
      ? window.HPAccount.readAccount()
      : {};
    return String(account.email || 'demo@local').trim().toLowerCase();
  }

  function getStoreKey() {
    const account = window.HPAccount && typeof window.HPAccount.readAccount === 'function'
      ? window.HPAccount.readAccount()
      : {};
    return String(account.storeName || 'default-store')
      .trim()
      .toLowerCase();
  }

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
  async function getTransactions(options = {}) {
    const client = requireSupabaseClient();
    const storeScoped = !options || options.storeScoped !== false;
    let query = client
      .from('demo_transactions')
      .select('*')
      .eq('user_key', getUserKey());

    if (storeScoped) {
      query = query.eq('store_key', getStoreKey());
    }

    query = query.order('transaction_date', { ascending: false });
    const { data, error } = await query;
    if (error) {
      throw error;
    }

    const rows = Array.isArray(data) ? data : [];
    return rows.map(row => ({
      id: row.id,
      date: row.transaction_date,
      description: row.description,
      category: row.category,
      type: row.type,
      amount: Number(row.amount || 0),
      unit: row.unit || 'pcs',
      notes: row.notes || '',
      inventoryItemId: row.inventory_item_id || null,
      inventoryQtyChange: row.inventory_qty_change == null ? null : Number(row.inventory_qty_change),
      isUtility: row.is_utility === true,
      userKey: row.user_key,
      storeKey: row.store_key,
    }));
  }

  async function addTransaction(txn) {
    const client = requireSupabaseClient();
    const userKey = getUserKey();
    const storeKey = getStoreKey();
    const transactionId = `txn_${Date.now()}`;
    const normalized = {
      id: transactionId,
      user_key: userKey,
      store_key: storeKey,
      transaction_date: txn.date,
      description: txn.description,
      category: txn.category,
      type: txn.type,
      amount: Number(txn.amount || 0),
      unit: txn.unit || 'pcs',
      notes: txn.notes || '',
      inventory_item_id: txn.inventoryItemId || null,
      inventory_qty_change: txn.inventoryQtyChange == null ? null : Number(txn.inventoryQtyChange),
      is_utility: txn.isUtility === true,
    };

      if (normalized.type === 'expense' && normalized.category === 'Misc' && !normalized.inventory_item_id) {
        const qty = normalized.inventory_qty_change && normalized.inventory_qty_change > 0 ? normalized.inventory_qty_change : 1;
        const cost = qty > 0 ? normalized.amount / qty : normalized.amount;
        const sale = cost * 1.2;
        const invId = `inv_${Date.now()}`;
        const invInsert = await client.from('demo_inventory_items').insert({
          id: invId,
          user_key: userKey,
          store_key: storeKey,
          name: normalized.description,
          category: 'Misc',
          qty,
          unit: 'pcs',
          cost_price: cost,
          sale_price: sale,
          max_qty: Math.max(qty * 2, 10),
          low_threshold: 2,
        });
        if (invInsert.error) throw invInsert.error;
        normalized.inventory_item_id = invId;
        normalized.inventory_qty_change = null;
      }

      const insertResult = await client.from('demo_transactions').insert(normalized);
      if (insertResult.error) throw insertResult.error;

      if (normalized.inventory_item_id && normalized.inventory_qty_change != null && normalized.type === 'expense') {
        const itemRes = await client
          .from('demo_inventory_items')
          .select('*')
          .eq('id', normalized.inventory_item_id)
          .eq('user_key', userKey)
          .eq('store_key', storeKey);
        if (!itemRes.error && Array.isArray(itemRes.data) && itemRes.data.length > 0) {
          const item = itemRes.data[0];
          const updatedQty = Math.max(0, Number(item.qty || 0) + Number(normalized.inventory_qty_change || 0));
          const nextMax = Number(item.max_qty || 0) > 0 ? Number(item.max_qty) : updatedQty;
          await client
            .from('demo_inventory_items')
            .eq('id', normalized.inventory_item_id)
            .eq('user_key', userKey)
            .eq('store_key', storeKey)
            .update({
              qty: updatedQty,
              max_qty: updatedQty > nextMax ? updatedQty : nextMax,
            });
        }
      }

      if (normalized.inventory_item_id && normalized.type === 'sale') {
        const soldQty = Number(normalized.inventory_qty_change || 1);
        const itemRes = await client
          .from('demo_inventory_items')
          .select('*')
          .eq('id', normalized.inventory_item_id)
          .eq('user_key', userKey)
          .eq('store_key', storeKey);
        if (!itemRes.error && Array.isArray(itemRes.data) && itemRes.data.length > 0) {
          const item = itemRes.data[0];
          const updatedQty = Math.max(0, Number(item.qty || 0) - soldQty);
          await client
            .from('demo_inventory_items')
            .eq('id', normalized.inventory_item_id)
            .eq('user_key', userKey)
            .eq('store_key', storeKey)
            .update({ qty: updatedQty });
        }
      }

    return {
      id: normalized.id,
      date: normalized.transaction_date,
      description: normalized.description,
      category: normalized.category,
      type: normalized.type,
      amount: normalized.amount,
      unit: normalized.unit,
      notes: normalized.notes,
      inventoryItemId: normalized.inventory_item_id,
      inventoryQtyChange: normalized.inventory_qty_change,
      isUtility: normalized.is_utility,
      userKey: normalized.user_key,
      storeKey: normalized.store_key,
    };
  }

  async function deleteTransaction(id) {
    const client = requireSupabaseClient();
    const result = await client
      .from('demo_transactions')
      .eq('id', id)
      .eq('user_key', getUserKey())
      .eq('store_key', getStoreKey())
      .delete();

    if (result.error) throw result.error;
    return null;
  }

  // ── CRUD: Inventory ───────────────────────────────────────────────
  async function getInventory() {
    const client = requireSupabaseClient();
    const { data, error } = await client
      .from('demo_inventory_items')
      .select('*')
      .eq('user_key', getUserKey())
      .eq('store_key', getStoreKey())
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    const rows = Array.isArray(data) ? data : [];
    return rows.map(row => ({
      id: row.id,
      userKey: row.user_key,
      storeKey: row.store_key,
      name: row.name,
      category: row.category,
      qty: Number(row.qty || 0),
      unit: row.unit || 'pcs',
      costPrice: Number(row.cost_price || 0),
      salePrice: Number(row.sale_price || 0),
      maxQty: Number(row.max_qty || 0),
      lowThreshold: Number(row.low_threshold || 0),
    }));
  }

  async function addInventoryItem(item) {
    const client = requireSupabaseClient();
    const normalized = { ...item };
    if (normalized.unit === 'dozen') {
      normalized.qty = (normalized.qty || 0) * 12;
      if (normalized.costPrice) normalized.costPrice = normalized.costPrice / 12;
      if (normalized.salePrice) normalized.salePrice = normalized.salePrice / 12;
      if (normalized.maxQty) normalized.maxQty = normalized.maxQty * 12;
      if (normalized.lowThreshold) normalized.lowThreshold = normalized.lowThreshold * 12;
      normalized.unit = 'pcs';
    }

    const payload = {
      id: `inv_${Date.now()}`,
      user_key: getUserKey(),
      store_key: getStoreKey(),
      name: normalized.name,
      category: normalized.category,
      qty: Number(normalized.qty || 0),
      unit: normalized.unit || 'pcs',
      cost_price: Number(normalized.costPrice || 0),
      sale_price: Number(normalized.salePrice || 0),
      max_qty: Number(normalized.maxQty || 20),
      low_threshold: Number(normalized.lowThreshold || 5),
    };

    const result = await client.from('demo_inventory_items').insert(payload);
    if (result.error) throw result.error;

    return {
      id: payload.id,
      userKey: payload.user_key,
      storeKey: payload.store_key,
      name: payload.name,
      category: payload.category,
      qty: payload.qty,
      unit: payload.unit,
      costPrice: payload.cost_price,
      salePrice: payload.sale_price,
      maxQty: payload.max_qty,
      lowThreshold: payload.low_threshold,
    };
  }

  async function updateInventoryItem(id, updates) {
    const client = requireSupabaseClient();
    const payload = {};
    if (Object.prototype.hasOwnProperty.call(updates, 'name')) payload.name = updates.name;
    if (Object.prototype.hasOwnProperty.call(updates, 'category')) payload.category = updates.category;
    if (Object.prototype.hasOwnProperty.call(updates, 'qty')) payload.qty = Number(updates.qty || 0);
    if (Object.prototype.hasOwnProperty.call(updates, 'unit')) payload.unit = updates.unit;
    if (Object.prototype.hasOwnProperty.call(updates, 'costPrice')) payload.cost_price = Number(updates.costPrice || 0);
    if (Object.prototype.hasOwnProperty.call(updates, 'salePrice')) payload.sale_price = Number(updates.salePrice || 0);
    if (Object.prototype.hasOwnProperty.call(updates, 'maxQty')) payload.max_qty = Number(updates.maxQty || 0);
    if (Object.prototype.hasOwnProperty.call(updates, 'lowThreshold')) payload.low_threshold = Number(updates.lowThreshold || 0);

    const result = await client
      .from('demo_inventory_items')
      .eq('id', id)
      .eq('user_key', getUserKey())
      .eq('store_key', getStoreKey())
      .update(payload);

    if (result.error) throw result.error;
    return result.data;
  }

  // ── Analytics helpers ─────────────────────────────────────────────
  async function getSummary(days = 30) {
    const txns = await getTransactions();
    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - days);
    
    const recentTxns = txns.filter(t => {
      const txnDate = parseDateKey(t.date);
      return txnDate ? txnDate >= cutoff : false;
    });
    const totalIncome   = recentTxns.filter(t => t.type === 'sale').reduce((s, t) => s + t.amount, 0);
    const totalExpenses = recentTxns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    return { totalIncome, totalExpenses, netBalance: totalIncome - totalExpenses, count: recentTxns.length };
  }

  async function getTodaySummary() {
    const txns = await getTransactions();
    const today = currentLocalDateKey();
    
    const todayTxns = txns.filter(t => t.date === today);
    const sales    = todayTxns.filter(t => t.type === 'sale').reduce((s, t) => s + t.amount, 0);
    const expenses = todayTxns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    return { sales, expenses, profit: sales - expenses };
  }

  async function getCategoryBreakdown(days = 30) {
    const txns = await getTransactions();
    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - days);
    
    const recentTxns = txns.filter(t => {
      if (t.type !== 'expense') return false;
      const txnDate = parseDateKey(t.date);
      return txnDate ? txnDate >= cutoff : false;
    });
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
    getUserKey,
    getStoreKey,
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
