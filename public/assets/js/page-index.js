document.addEventListener('DOMContentLoaded', async () => {
  await HP.init();

  // KPI Cards
  const today = await HP.getTodaySummary();
  const monthly = await HP.getSummary(30);
  document.getElementById('dashSales').textContent    = today.sales.toLocaleString('en-PK');
  document.getElementById('dashExpenses').textContent = today.expenses.toLocaleString('en-PK');
  document.getElementById('dashProfit').textContent   = Math.abs(today.profit).toLocaleString('en-PK');
  document.getElementById('dashBalance').textContent  = Math.abs(monthly.netBalance).toLocaleString('en-PK');

  const allTxns = await HP.getTransactions();
  const salesTxns = allTxns.filter(t => t.type === 'sale').sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const recent7 = salesTxns.slice(-7).reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const prev7 = salesTxns.slice(-14, -7).reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const base = prev7 > 0 ? prev7 : 1;
  const trendPct = Math.round(((recent7 - prev7) / base) * 100);
  const absPct = Math.abs(trendPct);

  const trendBanner = document.getElementById('dashTrendBanner');
  const insightPrimary = document.getElementById('dashInsightPrimary');
  const insightPrimaryMeta = document.getElementById('dashInsightPrimaryMeta');

  if (trendBanner) {
    trendBanner.innerHTML = trendPct >= 0
      ? `Trend engine: <strong>Revenue trend is positive by +${absPct}%</strong> vs the previous week.`
      : `Trend engine: <strong>Revenue trend is down by -${absPct}%</strong> vs the previous week.`;
  }

  if (insightPrimary) {
    insightPrimary.innerHTML = trendPct >= 0
      ? `Positive momentum: sales improved by <strong>${absPct}%</strong> this week.`
      : `Alert: sales dipped by <strong>${absPct}%</strong> this week.`;
  }

  if (insightPrimaryMeta) {
    insightPrimaryMeta.textContent = trendPct >= 0
      ? 'Consider a small inventory top-up for fast-moving items.'
      : 'Reduce slow-moving purchases and push bundles for recovery.';
  }

  // Low Stock Table
  const tbody = document.getElementById('dashLowStockBody');
  const inv = await HP.getInventory();
  // Show low + medium items first, then good (up to 5 rows)
  const sorted = [...inv].sort((a, b) => {
    const order = { low: 0, medium: 1, good: 2 };
    return order[HP.getStockStatus(a)] - order[HP.getStockStatus(b)];
  }).slice(0, 5);

  if (!sorted.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--text-muted)">No inventory items yet. <a href="inventory.html" style="color:var(--emerald)">Add items →</a></td></tr>';
  } else {
    tbody.innerHTML = sorted.map(i => {
      const status = HP.getStockStatus(i);
      const qtyClass = status === 'low' ? 'td-coral' : status === 'medium' ? '' : 'td-emerald';
      const qtyStyle = status === 'medium' ? 'style="color:var(--amber)"' : '';
      const badge = `<span class="badge badge-${status}">${status.charAt(0).toUpperCase()+status.slice(1)}</span>`;
      const action = status === 'good'
        ? '<span class="text-muted text-xs">No action needed</span>'
        : `<a href="log.html" class="btn btn-outline-emerald btn-sm">Restock</a>`;
      return `<tr>
        <td><strong>${i.name}</strong></td>
        <td><span class="chip chip-neutral">${i.category}</span></td>
        <td class="td-mono ${qtyClass}" ${qtyStyle}>${i.qty} ${i.unit}</td>
        <td>${badge}</td>
        <td>${action}</td>
      </tr>`;
    }).join('');
  }
});
