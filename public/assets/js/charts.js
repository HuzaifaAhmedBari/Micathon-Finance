// =========================================
// HisaabPro — Chart Helpers (Dynamic Only)
// =========================================

let forecastChartInstance = null;
let seasonalityChartInstance = null;

function renderForecastChart({ historicalLabels, historicalAmounts, forecastLabels, forecastYhat, forecastUpper, forecastLower }) {
  const forecastCanvas = document.getElementById('forecastChart');
  if (!forecastCanvas) return;

  if (forecastChartInstance) {
    forecastChartInstance.destroy();
    forecastChartInstance = null;
  }

  const allLabels = [...historicalLabels, ...forecastLabels];
  const historicalData = [
    ...historicalAmounts,
    ...Array(forecastLabels.length).fill(null)
  ];
  const forecastLine = [...Array(historicalAmounts.length).fill(null), ...forecastYhat];
  const upperBound = [...Array(historicalAmounts.length).fill(null), ...forecastUpper];
  const lowerBound = [...Array(historicalAmounts.length).fill(null), ...forecastLower];

  forecastChartInstance = new Chart(forecastCanvas, {
    type: 'line',
    data: {
      labels: allLabels,
      datasets: [
        {
          label: 'Actual Revenue',
          data: historicalData,
          borderColor: '#059669',
          backgroundColor: 'rgba(5,150,105,0.07)',
          borderWidth: 2.5,
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 5,
        },
        {
          label: 'Forecast',
          data: forecastLine,
          borderColor: '#65a30d',
          borderDash: [7, 4],
          backgroundColor: 'transparent',
          borderWidth: 2.5,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 5,
        },
        {
          label: 'Upper Bound',
          data: upperBound,
          borderColor: 'transparent',
          backgroundColor: 'rgba(101,163,13,0.1)',
          fill: '+1',
          tension: 0.4,
          pointRadius: 0,
          borderWidth: 0,
        },
        {
          label: 'Lower Bound',
          data: lowerBound,
          borderColor: 'rgba(101,163,13,0.3)',
          borderDash: [3, 3],
          backgroundColor: 'rgba(101,163,13,0.1)',
          fill: false,
          tension: 0.4,
          pointRadius: 0,
          borderWidth: 1,
        },
      ]
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
          filter: item => item.label !== 'Upper Bound',
        },
        tooltip: {
          backgroundColor: '#fff',
          titleColor: '#0f172a',
          bodyColor: '#64748b',
          borderColor: '#e2e8f0',
          borderWidth: 1,
          padding: 12,
          callbacks: {
            label: ctx => ctx.raw != null
              ? `  ${ctx.dataset.label}: PKR ${ctx.raw.toLocaleString('en-PK')}`
              : ''
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(0,0,0,0.04)' },
          ticks: {
            color: '#94a3b8',
            font: { size: 11, family: 'Manrope' },
            maxTicksLimit: 12,
            maxRotation: 0,
          },
          border: { color: '#e2e8f0' }
        },
        y: {
          grid: { color: 'rgba(0,0,0,0.04)' },
          ticks: {
            color: '#94a3b8',
            font: { size: 11, family: 'Space Grotesk' },
            callback: val => 'PKR ' + (val >= 1000 ? (val / 1000).toFixed(1) + 'k' : val)
          },
          border: { color: '#e2e8f0' }
        }
      }
    }
  });
}

function renderSeasonalityChart(points) {
  const seasonCanvas = document.getElementById('seasonChart');
  if (!seasonCanvas) return;

  if (seasonalityChartInstance) {
    seasonalityChartInstance.destroy();
    seasonalityChartInstance = null;
  }

  const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const sums = new Map();
  const counts = new Map();

  weekdays.forEach(day => {
    sums.set(day, 0);
    counts.set(day, 0);
  });

  (Array.isArray(points) ? points : []).forEach(row => {
    const day = new Date(row.date).toLocaleDateString('en-PK', { weekday: 'long' });
    if (!sums.has(day)) return;
    sums.set(day, sums.get(day) + Number(row.amount || 0));
    counts.set(day, counts.get(day) + 1);
  });

  const averages = weekdays.map(day => {
    const count = counts.get(day) || 0;
    return count > 0 ? sums.get(day) / count : 0;
  });

  const maxAvg = Math.max(...averages, 1);
  const relative = averages.map(v => Math.round((v / maxAvg) * 100));

  seasonalityChartInstance = new Chart(seasonCanvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data: relative,
        backgroundColor: ctx => {
          const v = ctx.raw;
          if (v >= 85) return 'rgba(5,150,105,0.85)';
          if (v >= 70) return 'rgba(101,163,13,0.75)';
          return 'rgba(217,119,6,0.6)';
        },
        borderRadius: 6,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#fff',
          titleColor: '#0f172a',
          bodyColor: '#64748b',
          borderColor: '#e2e8f0',
          borderWidth: 1,
          callbacks: {
            label: ctx => `  Relative sales: ${ctx.raw}%`
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#64748b', font: { size: 12, family: 'Manrope', weight: '600' } },
          border: { display: false }
        },
        y: {
          min: 0,
          max: 100,
          grid: { color: 'rgba(0,0,0,0.04)' },
          ticks: {
            color: '#94a3b8',
            font: { size: 11, family: 'Space Grotesk' },
            callback: v => `${v}%`
          },
          border: { color: '#e2e8f0' }
        }
      }
    }
  });
}
