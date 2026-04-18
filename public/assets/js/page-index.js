document.addEventListener('DOMContentLoaded', async () => {
  await HP.init();

  // KPI Cards
  const today = await HP.getTodaySummary();
  const monthly = await HP.getSummary(30);
  document.getElementById('dashSales').textContent    = today.sales.toLocaleString('en-PK');
  document.getElementById('dashExpenses').textContent = today.expenses.toLocaleString('en-PK');
  document.getElementById('dashProfit').textContent   = Math.abs(today.profit).toLocaleString('en-PK');
  document.getElementById('dashBalance').textContent  = Math.abs(monthly.netBalance).toLocaleString('en-PK');

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
