document.addEventListener('DOMContentLoaded', async () => {
  await HP.init();

  function toLocalDateKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function parseRangeFromChipText(text) {
    const normalized = String(text || '').trim().toUpperCase();
    if (normalized === '7D') return 7;
    if (normalized === '90D') return 90;
    return 30;
  }

  function buildSeriesByDate(txns, days) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const labels = [];
    const revenue = [];
    const expenses = [];

    const salesByDay = new Map();
    const expenseByDay = new Map();

    txns.forEach(txn => {
      if (!txn || !txn.date) return;
      const key = String(txn.date).slice(0, 10);
      const amt = Number(txn.amount || 0);
      if (txn.type === 'sale') {
        salesByDay.set(key, (salesByDay.get(key) || 0) + amt);
      } else if (txn.type === 'expense') {
        expenseByDay.set(key, (expenseByDay.get(key) || 0) + amt);
      }
    });

    for (let i = days - 1; i >= 0; i -= 1) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = toLocalDateKey(d);
      labels.push(d.toLocaleDateString('en-PK', { month: 'short', day: 'numeric' }));
      revenue.push(Math.round(salesByDay.get(key) || 0));
      expenses.push(Math.round(expenseByDay.get(key) || 0));
    }

    return { labels, revenue, expenses };
  }

  function renderRevenueExpenseChart(txns, days) {
    const canvas = document.getElementById('revenueChart');
    if (!canvas || typeof Chart === 'undefined') return;

    const existing = Chart.getChart(canvas);
    if (existing) existing.destroy();

    const { labels, revenue, expenses } = buildSeriesByDate(txns, days);

    new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Revenue',
            data: revenue,
            borderColor: '#059669',
            backgroundColor: 'rgba(5,150,105,0.08)',
            borderWidth: 2.5,
            fill: true,
            tension: 0.35,
            pointRadius: 0,
            pointHoverRadius: 5,
          },
          {
            label: 'Expenses',
            data: expenses,
            borderColor: '#dc2626',
            backgroundColor: 'rgba(220,38,38,0.06)',
            borderWidth: 2,
            fill: true,
            tension: 0.35,
            pointRadius: 0,
            pointHoverRadius: 5,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: 'index' },
        plugins: {
          legend: {
            labels: {
              color: '#64748b',
              font: { family: 'Manrope', size: 12 },
              boxWidth: 12,
              usePointStyle: true,
            },
          },
          tooltip: {
            backgroundColor: '#fff',
            titleColor: '#0f172a',
            bodyColor: '#64748b',
            borderColor: '#e2e8f0',
            borderWidth: 1,
            padding: 12,
            callbacks: {
              label: ctx => `  ${ctx.dataset.label}: PKR ${Number(ctx.raw || 0).toLocaleString('en-PK')}`,
            },
          },
        },
        scales: {
          x: {
            grid: { color: 'rgba(0,0,0,0.04)' },
            ticks: {
              color: '#94a3b8',
              font: { family: 'Manrope', size: 11 },
              maxTicksLimit: days <= 7 ? 7 : days <= 30 ? 10 : 14,
              maxRotation: 0,
            },
            border: { color: '#e2e8f0' },
          },
          y: {
            grid: { color: 'rgba(0,0,0,0.04)' },
            ticks: {
              color: '#94a3b8',
              font: { family: 'Space Grotesk', size: 11 },
              callback: val => `PKR ${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`,
            },
            border: { color: '#e2e8f0' },
          },
        },
      },
    });

    const title = document.getElementById('dashRevenueChartTitle');
    const subtitle = document.getElementById('dashRevenueChartSubtitle');
    if (title) title.textContent = `Revenue vs Expenses — Last ${days} Days`;
    if (subtitle) subtitle.textContent = 'Daily sales and expenses for selected period';
  }

  function updateAIInsights(txns, inventory) {
    const today = new Date();
    const cutoff30 = new Date(today);
    cutoff30.setHours(0, 0, 0, 0);
    cutoff30.setDate(cutoff30.getDate() - 30);

    const sales30 = txns.filter(t => t.type === 'sale' && new Date(String(t.date).slice(0, 10)) >= cutoff30);
    const expense30 = txns.filter(t => t.type === 'expense' && new Date(String(t.date).slice(0, 10)) >= cutoff30);

    const totalsByItem = new Map();
    sales30.forEach(t => {
      const key = String(t.description || 'Item').trim();
      totalsByItem.set(key, (totalsByItem.get(key) || 0) + Number(t.amount || 0));
    });

    const topItem = [...totalsByItem.entries()].sort((a, b) => b[1] - a[1])[0];
    const topItemName = topItem ? topItem[0] : 'Top selling item';
    const topItemTotal = topItem ? topItem[1] : 0;

    const sales7 = sales30.slice(-7).reduce((s, t) => s + Number(t.amount || 0), 0);
    const salesPrev7 = sales30.slice(-14, -7).reduce((s, t) => s + Number(t.amount || 0), 0);
    const trendBase = salesPrev7 > 0 ? salesPrev7 : 1;
    const trendPct = Math.round(((sales7 - salesPrev7) / trendBase) * 100);
    const absTrend = Math.abs(trendPct);

    const primary = document.getElementById('dashInsightPrimary');
    const primaryMeta = document.getElementById('dashInsightPrimaryMeta');
    if (primary) {
      primary.innerHTML = trendPct >= 0
        ? `<strong>${topItemName}</strong> revenue trend is up <strong>+${absTrend}%</strong> vs last week.`
        : `<strong>${topItemName}</strong> revenue trend is down <strong>-${absTrend}%</strong> vs last week.`;
    }
    if (primaryMeta) {
      primaryMeta.textContent = topItem
        ? `Last 30d sales from this item: PKR ${Math.round(topItemTotal).toLocaleString('en-PK')}`
        : 'Log more sales to generate stronger item-level insight.';
    }

    const avgDailyExpense = expense30.reduce((s, t) => s + Number(t.amount || 0), 0) / Math.max(1, 30);
    const net30 = sales30.reduce((s, t) => s + Number(t.amount || 0), 0) - expense30.reduce((s, t) => s + Number(t.amount || 0), 0);
    const runwayDays = avgDailyExpense > 0 ? Math.max(0, Math.round(Math.abs(net30) / avgDailyExpense)) : 0;

    const cashflow = document.getElementById('dashInsightCashflow');
    const cashflowMeta = document.getElementById('dashInsightCashflowMeta');
    if (cashflow) {
      cashflow.innerHTML = net30 >= 0
        ? `Cashflow is healthy: <strong>+PKR ${Math.round(net30).toLocaleString('en-PK')}</strong> in the last 30 days.`
        : `Potential <strong>cash crunch in ~${runwayDays || 7} days</strong> based on current burn rate.`;
    }
    if (cashflowMeta) {
      cashflowMeta.textContent = net30 >= 0
        ? 'Maintain discipline on recurring expenses to preserve margin.'
        : 'Reduce non-essential expenses or push high-margin inventory sales.';
    }

    const weekdayTotals = new Map();
    sales30.forEach(t => {
      const date = new Date(String(t.date).slice(0, 10));
      const day = date.toLocaleDateString('en-PK', { weekday: 'long' });
      weekdayTotals.set(day, (weekdayTotals.get(day) || 0) + Number(t.amount || 0));
    });
    const weekdayTop = [...weekdayTotals.entries()].sort((a, b) => b[1] - a[1])[0];
    const topWeekday = weekdayTop ? weekdayTop[0] : 'Friday';
    const weekdayAvg = weekdayTotals.size ? ([...weekdayTotals.values()].reduce((a, b) => a + b, 0) / weekdayTotals.size) : 1;
    const weekdayPct = weekdayTop ? Math.round(((weekdayTop[1] - weekdayAvg) / Math.max(1, weekdayAvg)) * 100) : 0;

    const weekday = document.getElementById('dashInsightWeekday');
    const weekdayMeta = document.getElementById('dashInsightWeekdayMeta');
    if (weekday) {
      weekday.innerHTML = `${topWeekday} is your strongest sales day — <strong>${weekdayPct >= 0 ? '+' : ''}${weekdayPct}%</strong> vs weekday average.`;
    }
    if (weekdayMeta) {
      weekdayMeta.textContent = `Computed from ${sales30.length} sales entries in the last 30 days.`;
    }

    const lowItems = inventory.filter(i => HP.getStockStatus(i) === 'low').slice(0, 3);
    const stock = document.getElementById('dashInsightStock');
    const stockMeta = document.getElementById('dashInsightStockMeta');
    if (stock) {
      if (lowItems.length) {
        stock.innerHTML = `${lowItems.length} item${lowItems.length > 1 ? 's are' : ' is'} <strong>critically low on stock</strong> — ${lowItems.map(i => i.name).join(', ')}.`;
      } else {
        stock.innerHTML = `Inventory health looks stable — <strong>no critical stockouts</strong> detected.`;
      }
    }
    if (stockMeta) {
      stockMeta.textContent = lowItems.length
        ? 'Restock low items first to avoid lost sales in peak hours.'
        : 'Keep monitoring fast-moving SKUs to maintain this status.';
    }
  }

  // KPI Cards
  const today = await HP.getTodaySummary();
  const monthly = await HP.getSummary(30);
  const profitEl = document.getElementById('dashProfit');
  const balanceEl = document.getElementById('dashBalance');

  document.getElementById('dashSales').textContent    = today.sales.toLocaleString('en-PK');
  document.getElementById('dashExpenses').textContent = today.expenses.toLocaleString('en-PK');
  if (profitEl) {
    profitEl.textContent = `${today.profit < 0 ? '-' : ''}${Math.abs(today.profit).toLocaleString('en-PK')}`;
    profitEl.className = `kpi-value ${today.profit >= 0 ? 'lime' : 'coral'}`;
  }
  if (balanceEl) {
    balanceEl.textContent = `${monthly.netBalance < 0 ? '-' : ''}${Math.abs(monthly.netBalance).toLocaleString('en-PK')}`;
    balanceEl.className = `kpi-value ${monthly.netBalance >= 0 ? 'amber' : 'coral'}`;
  }

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

  const invForInsights = await HP.getInventory();
  updateAIInsights(allTxns, invForInsights);

  renderRevenueExpenseChart(allTxns, 30);

  document.querySelectorAll('.filter-chip[data-group="chart-range"]').forEach(chip => {
    chip.addEventListener('click', () => {
      const days = parseRangeFromChipText(chip.textContent);
      renderRevenueExpenseChart(allTxns, days);
    });
  });

  // Low Stock Table
  const tbody = document.getElementById('dashLowStockBody');
  const inv = invForInsights;
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
