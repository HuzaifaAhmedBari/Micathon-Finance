document.addEventListener('DOMContentLoaded', async () => {
  await HP.init();

  const PAGE_SIZE = 10;
  let currentPage = 1;
  let activeFilter = 'all';
  let searchQuery = '';
  let stockChartInstance = null;

  // ── KPIs & Alert ───────────────────────────────────────────────
  async function updateKPIs() {
    const inv = await HP.getInventory();
    const lowItems = inv.filter(i => HP.getStockStatus(i) === 'low');
    const totalValue = inv.reduce((s, i) => s + (i.qty * i.costPrice), 0);
    const reorderItems = inv.filter(i => HP.getStockStatus(i) !== 'good');

    document.getElementById('kpiTotal').textContent   = inv.length;
    document.getElementById('kpiLow').textContent     = lowItems.length;
    document.getElementById('kpiValue').textContent   = Math.round(totalValue).toLocaleString('en-PK');
    document.getElementById('kpiReorder').textContent = reorderItems.length;

    if (lowItems.length) {
      const alert = document.getElementById('lowStockAlert');
      alert.hidden = false;
      document.getElementById('lowStockAlertText').innerHTML =
        `<strong>${lowItems.length} item${lowItems.length > 1 ? 's' : ''} critically low on stock</strong> — ${lowItems.map(i => i.name).join(', ')}. Restock soon.`;
    } else {
      document.getElementById('lowStockAlert').hidden = true;
    }
  }

  // ── Reorder Alerts Panel ───────────────────────────────────────
  async function renderReorderAlerts() {
    const inv = await HP.getInventory();
    const alerts = inv.filter(i => HP.getStockStatus(i) !== 'good').slice(0, 5);
    const container = document.getElementById('reorderAlerts');
    if (!alerts.length) {
      container.innerHTML = '<p style="font-size:13px;color:var(--emerald)">✓ All items are well stocked!</p>';
      return;
    }
    container.innerHTML = alerts.map(i => {
      const status = HP.getStockStatus(i);
      const bg = status === 'low' ? 'var(--coral-light)' : 'var(--amber-light)';
      const color = status === 'low' ? 'var(--coral)' : 'var(--amber)';
      const suggest = Math.max(i.maxQty - i.qty, 5);
      return `<div style="background:${bg};border-radius:var(--radius-md);padding:12px;display:flex;gap:10px;align-items:flex-start">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" width="18" height="18" style="color:${color};flex-shrink:0;margin-top:1px"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
        <div>
          <div class="text-sm font-semibold" style="color:var(--text-primary)">${i.name}</div>
          <div class="text-xs text-secondary mt-1">Only ${i.qty} ${i.unit} left — Recommend ordering ${suggest} ${i.unit}</div>
          <a href="log.html" style="font-size:11px;color:var(--emerald);font-weight:600;margin-top:4px;display:inline-block">→ Log Restock</a>
        </div>
      </div>`;
    }).join('');
  }

  // ── Stock Chart ────────────────────────────────────────────────
  async function renderStockChart() {
    const inv = await HP.getInventory();
    const good   = inv.filter(i => HP.getStockStatus(i) === 'good').length;
    const medium = inv.filter(i => HP.getStockStatus(i) === 'medium').length;
    const low    = inv.filter(i => HP.getStockStatus(i) === 'low').length;
    const ctx = document.getElementById('stockChart');
    if (!ctx) return;
    if (stockChartInstance) stockChartInstance.destroy();
    stockChartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Good Stock', 'Medium Stock', 'Low Stock'],
        datasets: [{ data: [good, medium, low], backgroundColor: ['rgba(5,150,105,0.85)','rgba(217,119,6,0.75)','rgba(220,38,38,0.75)'], borderWidth: 0, hoverOffset: 6 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '68%',
        plugins: {
          legend: { position: 'bottom', labels: { color: '#64748b', font: { size: 12, family: 'Manrope' }, usePointStyle: true, padding: 14 } },
          tooltip: { backgroundColor: '#fff', titleColor: '#0f172a', bodyColor: '#64748b', borderColor: '#e2e8f0', borderWidth: 1, callbacks: { label: ctx => `  ${ctx.label}: ${ctx.raw} items` } }
        }
      }
    });
  }

  // ── Table ──────────────────────────────────────────────────────
  async function getFiltered() {
    const inv = await HP.getInventory();
    const q = searchQuery.toLowerCase();
    return inv.filter(i => {
      const qOk = !q || i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q);
      const status = HP.getStockStatus(i);
      const fOk = activeFilter === 'all' || status === activeFilter;
      return qOk && fOk;
    });
  }

  async function renderTable() {
    const filtered = await getFiltered();
    const total = filtered.length;
    const start = (currentPage - 1) * PAGE_SIZE;
    const page  = filtered.slice(start, start + PAGE_SIZE);
    const tbody = document.getElementById('invTableBody');

    if (!page.length) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--text-muted);font-size:14px">No items found</td></tr>`;
    } else {
      tbody.innerHTML = page.map(i => {
        const status = HP.getStockStatus(i);
        const pct    = Math.min(100, Math.round((i.qty / i.maxQty) * 100));
        const qtyColor = status === 'low' ? 'td-coral' : status === 'medium' ? '' : 'td-emerald';
        const qtyStyle = status === 'medium' ? 'style="color:var(--amber)"' : '';
        const barClass = status === 'low' ? 'coral' : status === 'medium' ? 'amber' : 'emerald';
        const badgeClass = `badge-${status}`;
        const badgeLabel = status.charAt(0).toUpperCase() + status.slice(1);
        return `<tr>
          <td><strong>${i.name}</strong></td>
          <td><span class="chip chip-neutral" style="font-size:11px">${i.category}</span></td>
          <td class="td-mono ${qtyColor}" ${qtyStyle} style="text-align:right" id="qty-cell-${i.id}">${i.qty} ${i.unit}</td>
          <td class="td-mono" style="text-align:right">
            <div style="font-size:12px; color:var(--text-primary)">S: ${i.salePrice.toLocaleString('en-PK')}</div>
            <div style="font-size:10px; color:var(--text-muted)">C: ${i.costPrice.toLocaleString('en-PK')}</div>
          </td>
          <td><span class="badge ${badgeClass}">${badgeLabel}</span></td>
          <td style="width:100px"><div class="progress-bar-wrap" style="margin-top:0"><div class="progress-bar-fill ${barClass}" style="width:${pct}%"></div></div></td>
          <td>
            <div style="display:flex;gap:4px">
              <button class="row-edit-btn" data-id="${i.id}" title="Quick edit qty">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
              </button>
            </div>
          </td>
        </tr>`;
      }).join('');

      tbody.querySelectorAll('.row-edit-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.id;
          const inv = await HP.getInventory();
          const item = inv.find(i => i.id === id);
          if (!item) return;
          const cell = document.getElementById('qty-cell-' + id);
          cell.innerHTML = `<div class="qty-editor">
            <input type="number" value="${item.qty}" min="0" id="qe-${id}" />
            <button onclick="saveQty('${id}')">✓</button>
          </div>`;
        });
      });
    }

    document.getElementById('invPaginationInfo').textContent =
      `Showing ${total ? start + 1 : 0}–${Math.min(start + PAGE_SIZE, total)} of ${total} items`;
    renderPagination(total);
  }

  window.saveQty = async function(id) {
    const input = document.getElementById('qe-' + id);
    const newQty = parseFloat(input.value);
    if (isNaN(newQty) || newQty < 0) return;
    await HP.updateInventoryItem(id, { qty: newQty });
    await refreshAll();
  };

  function renderPagination(total) {
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const container = document.getElementById('invPaginationBtns');
    container.innerHTML = '';

    const prev = document.createElement('button');
    prev.className = 'page-btn'; prev.disabled = currentPage === 1;
    prev.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>`;
    prev.addEventListener('click', async () => { if (currentPage > 1) { currentPage--; await renderTable(); } });
    container.appendChild(prev);

    for (let p = 1; p <= totalPages; p++) {
      const btn = document.createElement('button');
      btn.className = 'page-btn' + (p === currentPage ? ' active' : '');
      btn.textContent = p;
      btn.addEventListener('click', async () => { currentPage = p; await renderTable(); });
      container.appendChild(btn);
    }

    const next = document.createElement('button');
    next.className = 'page-btn'; next.disabled = currentPage === totalPages;
    next.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>`;
    next.addEventListener('click', async () => { if (currentPage < totalPages) { currentPage++; await renderTable(); } });
    container.appendChild(next);
  }

  // ── Filters ────────────────────────────────────────────────────
  document.querySelectorAll('#invFilterRow .filter-chip').forEach(chip => {
    chip.addEventListener('click', async () => {
      document.querySelectorAll('#invFilterRow .filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activeFilter = chip.dataset.val;
      currentPage = 1;
      await renderTable();
    });
  });

  document.getElementById('invSearch').addEventListener('input', async e => {
    searchQuery = e.target.value;
    currentPage = 1;
    await renderTable();
  });

  // ── Add Item Modal ─────────────────────────────────────────────
  const modal = document.getElementById('addItemModal');
  document.getElementById('addItemBtn').addEventListener('click', () => modal.classList.add('open'));
  document.getElementById('cancelAddItem').addEventListener('click', () => modal.classList.remove('open'));
  modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('open'); });

  document.getElementById('confirmAddItem').addEventListener('click', async () => {
    const name = document.getElementById('newItemName').value.trim();
    const category = document.getElementById('newItemCategory').value;
    const qty = parseFloat(document.getElementById('newItemQty').value) || 0;
    const unit = document.getElementById('newItemUnit').value.trim();
    const costPrice = parseFloat(document.getElementById('newItemCost').value) || 0;
    const salePrice = parseFloat(document.getElementById('newItemSale').value) || 0;
    
    let maxQty = parseFloat(document.getElementById('newItemMax').value);
    if (isNaN(maxQty)) {
      maxQty = Math.max(20, qty * 2); // Default to double the starting qty, or at least 20
    }
    
    let lowThreshold = parseFloat(document.getElementById('newItemThreshold').value);
    if (isNaN(lowThreshold)) {
      lowThreshold = Math.max(1, Math.round(maxQty * 0.15)); // Automatically set to 15% of Max Qty
    }

    if (!name || !unit) { alert('Please fill in item name and unit.'); return; }

    await HP.addInventoryItem({ name, category, qty, unit, costPrice, salePrice, maxQty, lowThreshold });
    modal.classList.remove('open');
    // Clear form
    ['newItemName','newItemCategory','newItemQty','newItemUnit','newItemCost','newItemSale','newItemMax','newItemThreshold'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    if (saleInput) saleInput.dataset.autoFilled = 'true';
    await refreshAll();
  });

  // ── Refresh All ────────────────────────────────────────────────
  async function refreshAll() {
    await updateKPIs();
    await renderReorderAlerts();
    await renderStockChart();
    await renderTable();
  }

  await refreshAll();

  // ── Auto-fill Sale Price logic ─────────────────────────────────
  const costInput = document.getElementById('newItemCost');
  const saleInput = document.getElementById('newItemSale');
  if (costInput && saleInput) {
    costInput.addEventListener('input', () => {
      // Auto-fill sale price if it's empty OR if it was previously auto-filled
      if (!saleInput.value || saleInput.dataset.autoFilled === 'true') {
        saleInput.value = costInput.value;
        saleInput.dataset.autoFilled = 'true';
      }
    });

    // If user manually edits sale price, stop the auto-fill behavior
    saleInput.addEventListener('input', () => {
      saleInput.dataset.autoFilled = 'false';
    });
  }

  // ── Auto-open Add Item logic ───────────────────────────────────
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('action') === 'add-item') {
    modal.classList.add('open');
    window.history.replaceState({}, document.title, window.location.pathname);
  }
});
