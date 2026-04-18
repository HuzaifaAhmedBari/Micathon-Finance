// =========================================
// HisaabPro — Chart.js Configurations
// =========================================

document.addEventListener('DOMContentLoaded', async () => {
  await HP.init();

  // ---- Dashboard: Revenue vs Expenses + Forecast ----
  const dashCanvas = document.getElementById('revenueChart');
  if (dashCanvas) {
    const labels = [];
    const today = new Date();
    // Past 30 days
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today); d.setDate(today.getDate() - i);
      labels.push(d.toLocaleDateString('en-PK', { month: 'short', day: 'numeric' }));
    }
    // Future 14 days (forecast)
    for (let i = 1; i <= 14; i++) {
      const d = new Date(today); d.setDate(today.getDate() + i);
      labels.push(d.toLocaleDateString('en-PK', { month: 'short', day: 'numeric' }));
    }
    const revenue = Array(30).fill(0);
    const expenses = Array(30).fill(0);
    const allTxns = window.HP ? await HP.getTransactions() : [];
    
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today); d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayTxns = allTxns.filter(t => t.date === dateStr);
      revenue[29 - i] = dayTxns.filter(t => t.type === 'sale').reduce((s, t) => s + t.amount, 0);
      expenses[29 - i] = dayTxns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    }

    // Prophet Standby - simple placeholder forecast
    const lastRev = revenue[29] || 5000;
    const forecastBase = Array.from({length: 14}, (_, i) => lastRev + Math.round(Math.sin((i)*0.8)*400 + i*50));
    const forecast = Array(30).fill(null).concat(forecastBase);
    const forecastUp = Array(30).fill(null).concat(forecastBase.map(v => v + 600));
    const forecastDn = Array(30).fill(null).concat(forecastBase.map(v => v - 400));

    new Chart(dashCanvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Revenue',
            data: revenue,
            borderColor: '#059669', backgroundColor: 'rgba(5,150,105,0.08)',
            borderWidth: 2.5, fill: true, tension: 0.4, pointRadius: 0, pointHoverRadius: 5,
          },
          {
            label: 'Expenses',
            data: expenses,
            borderColor: '#dc2626', backgroundColor: 'rgba(220,38,38,0.06)',
            borderWidth: 2, fill: true, tension: 0.4, pointRadius: 0, pointHoverRadius: 5,
          },
          {
            label: 'Forecast',
            data: forecast,
            borderColor: '#65a30d', borderDash: [6, 3],
            backgroundColor: 'rgba(101,163,13,0)', borderWidth: 2,
            tension: 0.4, pointRadius: 0, pointHoverRadius: 5, fill: false,
          },
          {
            label: 'Forecast Upper',
            data: forecastUp,
            borderColor: 'transparent', backgroundColor: 'rgba(101,163,13,0.12)',
            fill: '+1', tension: 0.4, pointRadius: 0, borderWidth: 0,
          },
          {
            label: 'Forecast Lower',
            data: forecastDn,
            borderColor: 'transparent', backgroundColor: 'rgba(101,163,13,0.12)',
            fill: false, tension: 0.4, pointRadius: 0, borderWidth: 0,
          },
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { intersect: false, mode: 'index' },
        plugins: {
          legend: {
            labels: { color: '#64748b', font: { family: 'Manrope', size: 12 }, boxWidth: 12, usePointStyle: true },
            filter: item => item.label !== 'Forecast Upper' && item.label !== 'Forecast Lower',
          },
          tooltip: {
            backgroundColor: '#fff', titleColor: '#0f172a', bodyColor: '#64748b',
            borderColor: '#e2e8f0', borderWidth: 1, padding: 12,
            callbacks: { label: ctx => `  ${ctx.dataset.label}: PKR ${ctx.raw?.toLocaleString('en-PK')}` }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(0,0,0,0.04)' },
            ticks: { color: '#94a3b8', font: { family: 'Manrope', size: 11 }, maxTicksLimit: 10, maxRotation: 0 },
            border: { color: '#e2e8f0' }
          },
          y: {
            grid: { color: 'rgba(0,0,0,0.04)' },
            ticks: {
              color: '#94a3b8', font: { family: 'Space Grotesk', size: 11 },
              callback: val => 'PKR ' + (val >= 1000 ? (val/1000).toFixed(0) + 'k' : val)
            },
            border: { color: '#e2e8f0' }
          }
        }
      }
    });
  }



  // ---- Forecast Page: Full Prophet Chart ----
  const forecastCanvas = document.getElementById('forecastChart');
  if (forecastCanvas) {
    const labels = [];
    const today = new Date();
    for (let i = 59; i >= 0; i--) {
      const d = new Date(today); d.setDate(today.getDate() - i);
      labels.push(d.toLocaleDateString('en-PK', { month: 'short', day: 'numeric' }));
    }
    for (let i = 1; i <= 30; i++) {
      const d = new Date(today); d.setDate(today.getDate() + i);
      labels.push(d.toLocaleDateString('en-PK', { month: 'short', day: 'numeric' }));
    }
    const historical = Array(60).fill(0);
    const allTxns = window.HP ? await HP.getTransactions() : [];
    
    for (let i = 59; i >= 0; i--) {
      const d = new Date(today); d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      historical[59 - i] = allTxns
        .filter(t => t.date === dateStr && t.type === 'sale')
        .reduce((s, t) => s + t.amount, 0);
    }
    
    // Prophet Standby
    const lastRev = historical[59] || 5000;
    const fBase = Array.from({ length: 30 }, (_, i) => lastRev + Math.round(Math.sin(i*0.5)*600 + i*30));
    const forecastLine = Array(60).fill(null).concat(fBase);
    const upBound = Array(60).fill(null).concat(fBase.map(v => v + 800));
    const dnBound = Array(60).fill(null).concat(fBase.map(v => v - 600));

    new Chart(forecastCanvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Actual Revenue',
            data: historical,
            borderColor: '#059669', backgroundColor: 'rgba(5,150,105,0.07)',
            borderWidth: 2.5, fill: true, tension: 0.4, pointRadius: 0, pointHoverRadius: 5,
          },
          {
            label: 'Forecast',
            data: forecastLine,
            borderColor: '#65a30d', borderDash: [7, 4],
            backgroundColor: 'transparent', borderWidth: 2.5,
            tension: 0.4, pointRadius: 0, pointHoverRadius: 5,
          },
          {
            label: 'Upper Bound',
            data: upBound,
            borderColor: 'transparent', backgroundColor: 'rgba(101,163,13,0.1)',
            fill: '+1', tension: 0.4, pointRadius: 0, borderWidth: 0,
          },
          {
            label: 'Lower Bound',
            data: dnBound,
            borderColor: 'rgba(101,163,13,0.3)', borderDash: [3, 3],
            backgroundColor: 'rgba(101,163,13,0.1)',
            fill: false, tension: 0.4, pointRadius: 0, borderWidth: 1,
          },
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { intersect: false, mode: 'index' },
        plugins: {
          legend: {
            labels: { color: '#64748b', font: { family: 'Manrope', size: 12 }, boxWidth: 12, usePointStyle: true },
            filter: item => item.label !== 'Upper Bound',
          },
          tooltip: {
            backgroundColor: '#fff', titleColor: '#0f172a', bodyColor: '#64748b',
            borderColor: '#e2e8f0', borderWidth: 1, padding: 12,
            callbacks: { label: ctx => ctx.raw ? `  ${ctx.dataset.label}: PKR ${ctx.raw.toLocaleString('en-PK')}` : '' }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(0,0,0,0.04)' },
            ticks: { color: '#94a3b8', font: { size: 11, family: 'Manrope' }, maxTicksLimit: 12, maxRotation: 0 },
            border: { color: '#e2e8f0' }
          },
          y: {
            grid: { color: 'rgba(0,0,0,0.04)' },
            ticks: {
              color: '#94a3b8', font: { size: 11, family: 'Space Grotesk' },
              callback: val => 'PKR ' + (val >= 1000 ? (val/1000).toFixed(1) + 'k' : val)
            },
            border: { color: '#e2e8f0' }
          }
        }
      }
    });
  }

  // ---- Forecast: Seasonality ----
  const seasonCanvas = document.getElementById('seasonChart');
  if (seasonCanvas) {
    const allTxns = window.HP ? await HP.getTransactions() : [];
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);
    const recentTxns = allTxns.filter(t => t.type === 'sale' && new Date(t.date) >= cutoff);
    const dayTotals = [0,0,0,0,0,0,0];
    const dayCounts = [0,0,0,0,0,0,0];
    recentTxns.forEach(t => {
      const dayRaw = new Date(t.date).getDay();
      dayTotals[dayRaw] += t.amount;
      dayCounts[dayRaw] += 1;
    });
    const avgs = Array(7).fill(0);
    for(let i=0; i<7; i++) {
      const avg = dayCounts[i] ? dayTotals[i]/dayCounts[i] : 0;
      const idx = i === 0 ? 6 : i - 1; // map Sun(0) to 6 (Sun), Mon(1) to 0 (Mon)
      avgs[idx] = avg;
    }
    const maxAvg = Math.max(...avgs, 1);
    const seasonData = avgs.map(a => maxAvg ? Math.round((a/maxAvg)*100) : 0);

    new Chart(seasonCanvas, {
      type: 'bar',
      data: {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        datasets: [{
          data: seasonData,
          backgroundColor: (ctx) => {
            const v = ctx.raw;
            if (v >= 85) return 'rgba(5,150,105,0.85)';
            if (v >= 75) return 'rgba(101,163,13,0.75)';
            return 'rgba(217,119,6,0.6)';
          },
          borderRadius: 6, borderSkipped: false,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#fff', titleColor: '#0f172a', bodyColor: '#64748b',
            borderColor: '#e2e8f0', borderWidth: 1,
            callbacks: { label: ctx => `  Relative sales: ${ctx.raw}%` }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#64748b', font: { size: 12, family: 'Manrope', weight: '600' } },
            border: { display: false }
          },
          y: {
            min: 50, max: 100,
            grid: { color: 'rgba(0,0,0,0.04)' },
            ticks: { color: '#94a3b8', font: { size: 11, family: 'Space Grotesk' }, callback: v => v + '%' },
            border: { color: '#e2e8f0' }
          }
        }
      }
    });
  }
});
