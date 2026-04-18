document.addEventListener('DOMContentLoaded', async () => {
  await HP.init();

  const PAGE_SIZE = 10;
  let currentPage = 1;
  let activeFilter = 'all';
  let searchQuery = '';
  let categoryChartInstance = null;

  // ── KPI Cards ──────────────────────────────────────────────────
  async function updateKPIs() {
    const summary = await HP.getSummary(30);
    document.getElementById('kpiIncome').textContent   = summary.totalIncome.toLocaleString('en-PK');
    document.getElementById('kpiExpenses').textContent = summary.totalExpenses.toLocaleString('en-PK');
    const net = summary.netBalance;
    document.getElementById('kpiNet').textContent = `${net < 0 ? '-' : ''}${Math.abs(net).toLocaleString('en-PK')}`;
    if (net < 0) {
      document.getElementById('kpiNet').className = 'kpi-value coral';
      document.getElementById('kpiNetLabel').innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>Net loss this month`;
    } else {
      document.getElementById('kpiNet').className = 'kpi-value lime';
      document.getElementById('kpiNetLabel').innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 15l7-7 7 7"/></svg>Profitable month`;
    }
  }

  // ── Top earning day ────────────────────────────────────────────
  async function updateTopDay() {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);
    const txns = await HP.getTransactions();
    const recentSales = txns.filter(t => t.type === 'sale' && new Date(t.date) >= cutoff);
    const byDay = {};
    recentSales.forEach(t => { byDay[t.date] = (byDay[t.date] || 0) + t.amount; });
    const topDay = Object.entries(byDay).sort((a, b) => b[1] - a[1])[0];
    const maxSale = topDay ? topDay[1] : 0;
    const allDayMax = Math.max(...Object.values(byDay), 1);
    if (topDay) {
      document.getElementById('topDayAmount').textContent = topDay[1].toLocaleString('en-PK');
      const d = new Date(topDay[0]);
      document.getElementById('topDayLabel').textContent = 'PKR · ' + d.toLocaleDateString('en-PK', { weekday: 'long', day: 'numeric', month: 'short' });
      const pct = Math.round((topDay[1] / allDayMax) * 100);
      document.getElementById('topDayBar').style.width = pct + '%';
      document.getElementById('topDayPct').textContent = pct + '% of monthly best-day target';
    }
  }

  // ── Category Chart ─────────────────────────────────────────────
  async function renderCategoryChart() {
    const breakdown = await HP.getCategoryBreakdown(30);
    const labels = Object.keys(breakdown);
    const data   = Object.values(breakdown);
    const total  = data.reduce((s, v) => s + v, 0) || 1;
    const pcts   = data.map(v => Math.round((v / total) * 100));

    const colours = ['rgba(5,150,105,0.85)','rgba(220,38,38,0.75)','rgba(217,119,6,0.75)','rgba(101,163,13,0.75)','rgba(100,116,139,0.6)','rgba(79,70,229,0.7)','rgba(236,72,153,0.7)'];
    const ctx = document.getElementById('categoryChart');
    if (!ctx) return;
    if (categoryChartInstance) categoryChartInstance.destroy();
    categoryChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{ data: pcts, backgroundColor: colours.slice(0, labels.length), borderRadius: 6, borderSkipped: false }]
      },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#fff', titleColor: '#0f172a', bodyColor: '#64748b',
            borderColor: '#e2e8f0', borderWidth: 1,
            callbacks: { label: ctx => `  ${ctx.raw}% of expenses` }
          }
        },
        scales: {
          x: { max: 100, grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { color: '#94a3b8', font: { size: 11 }, callback: v => v + '%' }, border: { color: '#e2e8f0' } },
          y: { grid: { display: false }, ticks: { color: '#64748b', font: { size: 12, weight: '600' } }, border: { display: false } }
        }
      }
    });
  }

  // ── Table rendering ────────────────────────────────────────────
  const CHIP_MAP = {
    Sales:     'chip-emerald', Stock:     'chip-neutral',
    Rent:      'chip-coral',   Utilities: 'chip-amber',
    Transport: 'chip-lime',    Misc:      'chip-neutral',
  };

  function fmtDate(str) {
    const d = new Date(str + 'T00:00:00');
    return d.toLocaleDateString('en-PK', { month: 'short', day: 'numeric' });
  }

  async function getFiltered() {
    const all = await HP.getTransactions();
    return all.filter(t => {
      const typeOk = activeFilter === 'all' || t.type === activeFilter;
      const q = searchQuery.toLowerCase();
      const searchOk = !q || t.description.toLowerCase().includes(q) || t.category.toLowerCase().includes(q) || t.notes?.toLowerCase().includes(q);
      return typeOk && searchOk;
    });
  }

  async function renderTable() {
    const filtered = await getFiltered();
    const total = filtered.length;
    const start = (currentPage - 1) * PAGE_SIZE;
    const page  = filtered.slice(start, start + PAGE_SIZE);
    const tbody = document.getElementById('txnTableBody');

    if (!page.length) {
      tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="48" height="48"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
        <p>No transactions found.<br><a href="log.html" style="color:var(--emerald)">Log your first entry →</a></p>
      </div></td></tr>`;
    } else {
      tbody.innerHTML = page.map(t => {
        const isIncome = t.type === 'sale';
        const chipClass = CHIP_MAP[t.category] || 'chip-neutral';
        return `<tr>
          <td class="td-muted">${fmtDate(t.date)}</td>
          <td><strong>${t.description}</strong>${t.notes ? `<br><span style="font-size:11px;color:var(--text-muted)">${t.notes}</span>` : ''}</td>
          <td><span class="chip ${chipClass}" style="font-size:11px">${t.category}</span></td>
          <td><span class="badge ${isIncome ? 'badge-income' : 'badge-expense'}">${isIncome ? 'Income' : 'Expense'}</span></td>
          <td class="td-mono ${isIncome ? 'td-emerald' : 'td-coral'}" style="text-align:right">${isIncome ? '+' : '-'}${t.amount.toLocaleString('en-PK')}</td>
          <td>
            <button class="btn-delete" data-id="${t.id}" title="Delete">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
          </td>
        </tr>`;
      }).join('');

      // Attach delete handlers
      tbody.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (confirm('Delete this transaction?')) {
            await HP.deleteTransaction(btn.dataset.id);
            await refreshAll();
          }
        });
      });
    }

    // Pagination info
    document.getElementById('paginationInfo').textContent =
      `Showing ${total ? start + 1 : 0}–${Math.min(start + PAGE_SIZE, total)} of ${total} transactions`;
    await renderPagination(total);
  }

  async function renderPagination(total) {
    if (total === undefined) {
      const filtered = await getFiltered();
      total = filtered.length;
    }
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const container = document.getElementById('paginationBtns');
    container.innerHTML = '';

    const prev = document.createElement('button');
    prev.className = 'page-btn';
    prev.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>`;
    prev.disabled = currentPage === 1;
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
    next.className = 'page-btn';
    next.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>`;
    next.disabled = currentPage === totalPages;
    next.addEventListener('click', async () => { if (currentPage < totalPages) { currentPage++; await renderTable(); } });
    container.appendChild(next);
  }

  // ── Filters ────────────────────────────────────────────────────
  document.querySelectorAll('#typeFilterRow .filter-chip').forEach(chip => {
    chip.addEventListener('click', async () => {
      document.querySelectorAll('#typeFilterRow .filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activeFilter = chip.dataset.val;
      currentPage = 1;
      await renderTable();
    });
  });

  document.getElementById('txnSearch').addEventListener('input', async e => {
    searchQuery = e.target.value;
    currentPage = 1;
    await renderTable();
  });

  // ── Export CSV ─────────────────────────────────────────────────
  document.getElementById('exportBtn').addEventListener('click', async () => {
    const rows = [['Date', 'Description', 'Category', 'Type', 'Amount (PKR)', 'Notes']];
    const txns = await HP.getTransactions();
    txns.forEach(t => {
      rows.push([t.date, t.description, t.category, t.type, t.amount, t.notes || '']);
    });
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `hisaabpro_transactions_${new Date().toISOString().split('T')[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
  });

  async function refreshAll() {
    await updateKPIs();
    await updateTopDay();
    await renderCategoryChart();
    await renderTable();
  }

  // Initial render
  await refreshAll();
});
