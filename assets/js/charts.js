// =========================================
// HisaabPro — Chart.js Configurations
// =========================================

document.addEventListener('DOMContentLoaded', () => {

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
    const revenue = [4200,5100,3800,6200,4900,5500,7100,4300,5800,6100,4700,5200,6800,4100,5600,7200,4800,5300,6600,4200,5900,7400,5100,4600,6300,5800,4900,6100,5400,7200];
    const expenses = [2100,2400,1900,3100,2300,2600,3300,2100,2800,3000,2200,2500,3200,2000,2700,3400,2300,2600,3100,2000,2800,3500,2400,2200,3000,2700,2300,2900,2500,3400];
    const forecast = Array(30).fill(null).concat([7400,6900,7600,7100,8200,7500,6800,7900,7200,8500,7000,6700,7800,8100]);
    const forecastUp = Array(30).fill(null).concat([8100,7600,8300,7800,9000,8200,7500,8700,7900,9300,7700,7400,8500,8800]);
    const forecastDn = Array(30).fill(null).concat([6700,6200,6900,6400,7400,6800,6100,7100,6500,7700,6300,6000,7100,7400]);

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

  // ---- Transaction Log: Spending by Category ----
  const catCanvas = document.getElementById('categoryChart');
  if (catCanvas) {
    new Chart(catCanvas, {
      type: 'bar',
      data: {
        labels: ['Stock', 'Rent', 'Utilities', 'Transport', 'Misc'],
        datasets: [{
          data: [58, 22, 10, 6, 4],
          backgroundColor: [
            'rgba(5,150,105,0.85)',
            'rgba(220,38,38,0.75)',
            'rgba(217,119,6,0.75)',
            'rgba(101,163,13,0.75)',
            'rgba(100,116,139,0.6)',
          ],
          borderRadius: 6, borderSkipped: false,
        }]
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
          x: {
            max: 70, grid: { color: 'rgba(0,0,0,0.04)' },
            ticks: { color: '#94a3b8', font: { size: 11, family: 'Space Grotesk' }, callback: v => v + '%' },
            border: { color: '#e2e8f0' }
          },
          y: {
            grid: { display: false },
            ticks: { color: '#64748b', font: { size: 12, family: 'Manrope', weight: '600' } },
            border: { display: false }
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
    const seed = (n) => 4000 + Math.round(Math.sin(n * 0.3) * 1200 + Math.cos(n * 0.7) * 800 + n * 30);
    const historical = Array.from({ length: 60 }, (_, i) => seed(i));
    const forecastLine = Array(60).fill(null).concat(Array.from({ length: 30 }, (_, i) => seed(60 + i) + 200));
    const upBound = Array(60).fill(null).concat(Array.from({ length: 30 }, (_, i) => seed(60 + i) + 1100));
    const dnBound = Array(60).fill(null).concat(Array.from({ length: 30 }, (_, i) => seed(60 + i) - 700));

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
    new Chart(seasonCanvas, {
      type: 'bar',
      data: {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        datasets: [{
          data: [72, 68, 74, 70, 91, 85, 78],
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

  // ---- Inventory: Stock Health Donut ----
  const stockCanvas = document.getElementById('stockChart');
  if (stockCanvas) {
    new Chart(stockCanvas, {
      type: 'doughnut',
      data: {
        labels: ['Good Stock', 'Medium Stock', 'Low Stock'],
        datasets: [{
          data: [58, 29, 13],
          backgroundColor: ['rgba(5,150,105,0.85)', 'rgba(217,119,6,0.75)', 'rgba(220,38,38,0.75)'],
          borderWidth: 0, hoverOffset: 6,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '68%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#64748b', font: { size: 12, family: 'Manrope' }, usePointStyle: true, padding: 14 }
          },
          tooltip: {
            backgroundColor: '#fff', titleColor: '#0f172a', bodyColor: '#64748b',
            borderColor: '#e2e8f0', borderWidth: 1,
            callbacks: { label: ctx => `  ${ctx.label}: ${ctx.raw}%` }
          }
        }
      }
    });
  }
});
