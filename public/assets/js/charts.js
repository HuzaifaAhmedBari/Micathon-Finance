// =========================================
// HisaabPro — Chart Helpers (Fixed)
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

  // Stitch actual + forecast together with one overlap point
  // so the lines connect visually at the handoff
  const lastActualLabel = historicalLabels[historicalLabels.length - 1];
  const lastActualValue = historicalAmounts[historicalAmounts.length - 1];

  const allLabels = [...historicalLabels, ...forecastLabels];

  // Actual line: real values, then null for forecast period
  const actualData = [
    ...historicalAmounts,
    ...Array(forecastLabels.length).fill(null)
  ];

  // Forecast line: null for historical, starts one point early to connect
  const forecastData = [
    ...Array(historicalAmounts.length - 1).fill(null),
    lastActualValue,  // connect at last actual point
    ...forecastYhat
  ];

  // Confidence band datasets — upper and lower must be same length as allLabels
  const upperData = [
    ...Array(historicalAmounts.length - 1).fill(null),
    lastActualValue,
    ...forecastUpper
  ];
  const lowerData = [
    ...Array(historicalAmounts.length - 1).fill(null),
    lastActualValue,
    ...forecastLower
  ];

  forecastChartInstance = new Chart(forecastCanvas, {
    type: 'line',
    data: {
      labels: allLabels,
      datasets: [
        // Dataset 0: Upper bound (invisible line, fills DOWN to lower)
        {
          label: 'Upper Bound',
          data: upperData,
          borderColor: 'transparent',
          backgroundColor: 'rgba(101, 163, 13, 0.12)',
          fill: '+1',  // fill between this and dataset below (Lower Bound)
          tension: 0.4,
          pointRadius: 0,
          borderWidth: 0,
          order: 3,
        },
        // Dataset 1: Lower bound (invisible line, defines bottom of band)
        {
          label: 'Lower Bound',
          data: lowerData,
          borderColor: 'rgba(101, 163, 13, 0.25)',
          borderDash: [3, 3],
          backgroundColor: 'transparent',
          fill: false,
          tension: 0.4,
          pointRadius: 0,
          borderWidth: 1,
          order: 3,
        },
        // Dataset 2: Forecast line (on top of band)
        {
          label: 'Forecast',
          data: forecastData,
          borderColor: '#65a30d',
          borderDash: [8, 4],
          backgroundColor: 'transparent',
          borderWidth: 2.5,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 5,
          pointHoverBackgroundColor: '#65a30d',
          fill: false,
          order: 2,
        },
        // Dataset 3: Actual revenue (topmost, solid)
        {
          label: 'Actual Revenue',
          data: actualData,
          borderColor: '#059669',
          backgroundColor: 'rgba(5, 150, 105, 0.07)',
          borderWidth: 2.5,
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 5,
          pointHoverBackgroundColor: '#059669',
          order: 1,
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
            // Hide Upper Bound and Lower Bound from legend
            filter: item => item.text !== 'Upper Bound' && item.text !== 'Lower Bound',
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
            label: ctx => {
              if (ctx.raw == null) return '';
              // Hide bound lines from tooltip
              if (ctx.dataset.label === 'Upper Bound' || ctx.dataset.label === 'Lower Bound') return '';
              return `  ${ctx.dataset.label}: PKR ${Math.round(ctx.raw).toLocaleString('en-PK')}`;
            },
            // Add confidence interval range as extra tooltip line
            afterBody: (items) => {
              const idx = items[0]?.dataIndex;
              if (idx === undefined) return [];
              const upper = upperData[idx];
              const lower = lowerData[idx];
              if (upper == null || lower == null) return [];
              return [
                `  Range: PKR ${Math.round(lower).toLocaleString('en-PK')} – PKR ${Math.round(upper).toLocaleString('en-PK')}`
              ];
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(0,0,0,0.04)' },
          ticks: {
            color: '#94a3b8',
            font: { size: 11, family: 'Manrope' },
            maxTicksLimit: 10,
            maxRotation: 0,
          },
          border: { color: '#e2e8f0' }
        },
        y: {
          beginAtZero: true,
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

  weekdays.forEach(day => { sums.set(day, 0); counts.set(day, 0); });

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

  // Color each bar based on relative performance
  const barColors = relative.map(v => {
    if (v >= 85) return 'rgba(5, 150, 105, 0.85)';   // strong — emerald
    if (v >= 60) return 'rgba(101, 163, 13, 0.75)';  // medium — lime
    return 'rgba(217, 119, 6, 0.6)';                  // weak — amber
  });

  seasonalityChartInstance = new Chart(seasonCanvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Relative Sales',
        data: relative,
        backgroundColor: barColors,
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
          padding: 12,
          callbacks: {
            label: ctx => `  Relative sales: ${ctx.raw}%`,
            afterLabel: ctx => {
              const avg = averages[ctx.dataIndex];
              return `  Avg revenue: PKR ${Math.round(avg).toLocaleString('en-PK')}`;
            }
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
            callback: v => `${v}%`,
            stepSize: 25,
          },
          border: { color: '#e2e8f0' }
        }
      }
    }
  });
}