// =========================================
// HisaabPro — ML Forecast Integration
// =========================================

const ML_API = window.ML_API_URL || 'https://micathon-finance-production-d9f6.up.railway.app/';
const ML_RETRY_MS = 30000;

let lastForecastSource = 'ml';
let retryIntervalId = null;

// ---- Warm up Render on page load (avoids cold-start delay when user clicks) ----
fetch(`${ML_API}/health`).catch(() => {});

// ---- Fetch sales history from Supabase ----
async function getSalesHistorySupabase() {
  const { data, error } = await supabase
    .from("sales_entries")
    .select("amount, transaction_date")
    .order("transaction_date", { ascending: true });

  if (error) {
    console.error("Supabase error:", error);
    return null;
  }
  return (Array.isArray(data) ? data : []).map(row => ({
    date: String(row.transaction_date || '').slice(0, 10),
    amount: Number(row.amount || 0),
  }));
}


// ---- Main data fetcher - switches between local and Supabase ----
// For now, uses local backend. Uncomment Supabase version when migrating.
async function getSalesHistory() {
  return getSalesHistorySupabase(); // ← Uncomment to use Supabase
}

// ---- Aggregate individual entries into daily totals ----
// Local backend returns date in "YYYY-MM-DD"; Prophet needs one row per day
function aggregateByDay(entries) {
  const map = {};
  entries.forEach(e => {
    const date = e.date; // Already in "YYYY-MM-DD" format
    map[date] = (map[date] || 0) + e.amount;
  });
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, amount]) => ({ date, amount }));
}

// ---- Call the FastAPI ML endpoint ----
async function fetchForecast(history) {
  const response = await fetch(`${ML_API}/forecast`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ history, periods: 30 })
  });

  if (!response.ok) {
    throw new Error(`ML API error: ${response.status}`);
  }
  return response.json();
}

function buildLocalFallbackForecast(history, periods = 30) {
  const safeHistory = Array.isArray(history) ? history : [];
  const lastDate = safeHistory.length
    ? new Date(safeHistory[safeHistory.length - 1].date)
    : new Date();

  const last7 = safeHistory.slice(-7).map(h => Number(h.amount || 0));
  const prev7 = safeHistory.slice(-14, -7).map(h => Number(h.amount || 0));

  const avgLast7 = last7.length ? last7.reduce((a, b) => a + b, 0) / last7.length : 0;
  const avgPrev7 = prev7.length ? prev7.reduce((a, b) => a + b, 0) / prev7.length : avgLast7;
  const slope = avgPrev7 > 0 ? (avgLast7 - avgPrev7) / avgPrev7 : 0;

  const result = [];
  for (let i = 1; i <= periods; i += 1) {
    const d = new Date(lastDate);
    d.setDate(lastDate.getDate() + i);
    const dateKey = d.toISOString().slice(0, 10);

    const trendFactor = 1 + (slope * (i / Math.max(1, periods / 2)));
    const yhat = Math.max(0, Math.round(avgLast7 * trendFactor));
    const yhatLower = Math.max(0, Math.round(yhat * 0.85));
    const yhatUpper = Math.max(0, Math.round(yhat * 1.15));

    result.push({
      ds: dateKey,
      yhat,
      yhat_lower: yhatLower,
      yhat_upper: yhatUpper,
    });
  }

  return result;
}

// ---- Update the 3 KPI cards with real forecast data ----
function updateKPICards(forecastData) {
  // Use first 7 days of forecast for the KPI row
  const next7 = forecastData.slice(0, 7);

  const midpoint  = next7.reduce((sum, d) => sum + d.yhat, 0);
  const bestCase  = next7.reduce((sum, d) => sum + d.yhat_upper, 0);
  const worstCase = next7.reduce((sum, d) => sum + d.yhat_lower, 0);

  const fmt = val => Math.round(val).toLocaleString("en-PK");

  // KPI values — target by class matching your existing HTML structure
  const kpiValues = document.querySelectorAll(".kpi-value");
  if (kpiValues[0]) kpiValues[0].textContent = fmt(midpoint);
  if (kpiValues[1]) kpiValues[1].textContent = fmt(bestCase);
  if (kpiValues[2]) kpiValues[2].textContent = fmt(worstCase);
}

function updateTrendSummaries(dailyHistory, forecastData) {
  const primary = document.getElementById('forecastInsightPrimary');
  const primaryMeta = document.getElementById('forecastInsightPrimaryMeta');
  const secondary = document.getElementById('forecastInsightSecondary');
  const secondaryMeta = document.getElementById('forecastInsightSecondaryMeta');
  const trendCaption = document.getElementById('forecastTrendCaption');

  if (!dailyHistory.length || !forecastData.length) return;

  const recentActual = dailyHistory.slice(-7).reduce((sum, row) => sum + row.amount, 0);
  const forecastNext7 = forecastData.slice(0, 7).reduce((sum, row) => sum + row.yhat, 0);
  const baseline = recentActual > 0 ? recentActual : 1;
  const trendPct = Math.round(((forecastNext7 - recentActual) / baseline) * 100);
  const absPct = Math.abs(trendPct);

  if (trendCaption) {
    trendCaption.textContent = trendPct >= 0
      ? `Positive trend: +${absPct}% vs last 7 days`
      : `Negative trend: -${absPct}% vs last 7 days`;
  }

  const byWeekday = new Map();
  dailyHistory.forEach(row => {
    const day = new Date(row.date).toLocaleDateString('en-PK', { weekday: 'long' });
    const curr = byWeekday.get(day) || { sum: 0, count: 0 };
    curr.sum += row.amount;
    curr.count += 1;
    byWeekday.set(day, curr);
  });

  let bestDay = 'Friday';
  let bestAvg = 0;
  for (const [day, entry] of byWeekday.entries()) {
    const avg = entry.sum / Math.max(1, entry.count);
    if (avg > bestAvg) {
      bestAvg = avg;
      bestDay = day;
    }
  }

  if (primary) {
    primary.innerHTML = trendPct >= 0
      ? `Positive trend detected: <strong>+${absPct}%</strong> expected in the next 7 days.`
      : `Demand cooling expected: <strong>-${absPct}%</strong> projected over the next 7 days.`;
  }
  if (primaryMeta) {
    primaryMeta.textContent = `Historically strongest day: ${bestDay}. Adjust stock one day earlier.`;
  }

  const minForecast = forecastData.reduce((min, row) => row.yhat < min.yhat ? row : min, forecastData[0]);
  const dipDate = new Date(minForecast.ds).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' });
  if (secondary) {
    secondary.innerHTML = trendPct >= 0
      ? `Momentum looks healthy. Keep an eye on <strong>${dipDate}</strong> for a short dip.`
      : `Plan tighter spending near <strong>${dipDate}</strong> as revenue softens.`;
  }
  if (secondaryMeta) {
    secondaryMeta.textContent = `Trend confidence computed from ${dailyHistory.length} daily points.`;
  }
}

function updateMonthlyBreakdown(dailyHistory, forecastData) {
  const body = document.getElementById('forecastMonthlyBreakdownBody');
  if (!body) return;

  const monthKey = date => {
    const d = new Date(date);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  };

  const monthLabel = key => {
    const [y, m] = key.split('-').map(Number);
    return new Date(y, (m || 1) - 1, 1).toLocaleDateString('en-PK', { month: 'long', year: 'numeric' });
  };

  const actualMap = new Map();
  dailyHistory.forEach(row => {
    const key = monthKey(row.date);
    actualMap.set(key, (actualMap.get(key) || 0) + Number(row.amount || 0));
  });

  const forecastMap = new Map();
  forecastData.forEach(row => {
    const key = monthKey(row.ds);
    forecastMap.set(key, (forecastMap.get(key) || 0) + Number(row.yhat || 0));
  });

  const allMonths = [...new Set([...actualMap.keys(), ...forecastMap.keys()])]
    .sort((a, b) => b.localeCompare(a))
    .slice(0, 3);

  if (!allMonths.length) {
    body.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--text-muted)">No monthly data available.</td></tr>';
    return;
  }

  const now = new Date();
  const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  body.innerHTML = allMonths.map(key => {
    const actual = Math.round(actualMap.get(key) || 0);
    const forecast = Math.round(forecastMap.get(key) || 0);
    const variance = actual - forecast;
    const varianceText = forecast > 0
      ? `${variance >= 0 ? '+' : ''}${Math.abs(variance).toLocaleString('en-PK')}`
      : 'N/A';

    let trendBadge = '<span class="badge badge-medium">In Progress</span>';
    if (forecast > 0) {
      trendBadge = variance >= 0
        ? '<span class="badge badge-good">Above Forecast</span>'
        : '<span class="badge badge-low">Below Forecast</span>';
    }

    const varianceClass = forecast > 0
      ? (variance >= 0 ? 'td-emerald' : 'td-coral')
      : 'td-muted';

    const currentChip = key === currentKey
      ? ' <span class="chip chip-lime" style="font-size:10px;margin-left:4px">Current</span>'
      : '';

    return `<tr>
      <td><strong>${monthLabel(key)}</strong>${currentChip}</td>
      <td class="td-mono" style="text-align:right">${actual.toLocaleString('en-PK')}</td>
      <td class="td-mono text-muted" style="text-align:right">${forecast > 0 ? forecast.toLocaleString('en-PK') : '—'}</td>
      <td class="td-mono ${varianceClass}" style="text-align:right">${varianceText}</td>
      <td>${trendBadge}</td>
    </tr>`;
  }).join('');
}

// ---- Update Model Notes card with real history count ----
function updateModelNotes(historyLength, usingProphet, source = 'ml') {
  const notesEl = document.getElementById("model-notes-text");
  if (!notesEl) return;

  if (source === 'local-fallback') {
    notesEl.innerHTML = `ML service is unavailable, so a <strong>local estimate</strong> is shown using recent sales trend from <strong>${historyLength} days</strong>.`;
    return;
  }

  if (usingProphet) {
    notesEl.innerHTML = `Based on <strong>${historyLength} historical data points</strong>. Handles weekly &amp; monthly seasonality. Model accuracy improves with more entries.`;
  } else {
    notesEl.innerHTML = `Only <strong>${historyLength} days</strong> of data available. Showing average-based estimate. Log at least <strong>14 days</strong> of sales to enable full AI forecasting.`;
  }
}

// ---- Update the header subtitle with real MAPE (placeholder until you compute it) ----
function updateHeaderStatus(usingProphet, source = 'ml') {
  const subtitle = document.querySelector(".header-subtitle");
  if (!subtitle) return;

  if (source === 'local-fallback') {
    subtitle.textContent = 'Local fallback forecast · ML server offline';
    return;
  }

  subtitle.textContent = usingProphet
    ? "Powered by Facebook Prophet · Live ML forecast"
    : "Powered by Facebook Prophet · Average estimate (needs more data)";
}

// ---- Show/hide loading and error states ----
function setLoadingState(loading) {
  const btn = document.getElementById("rerun-btn");
  if (btn) btn.textContent = loading ? "Running…" : "Re-run Model";

  const chartWrapper = document.getElementById("forecast-chart-wrapper");
  if (chartWrapper) chartWrapper.style.opacity = loading ? "0.4" : "1";
}

function showError(message) {
  const el = document.getElementById("forecast-status");
  if (!el) return;
  el.textContent = message;
  el.style.display = "block";
  el.className = "forecast-status-error";
}

function hideStatus() {
  const el = document.getElementById("forecast-status");
  if (el) el.style.display = "none";
}

function getSupabaseClient() {
  if (!window.supabase) return null;
  const config = window.supabase._config || {};
  if (!config.url || !config.anonKey) return null;
  return window.supabase;
}

async function persistForecastRun(dailyHistory, forecastData) {
  const client = getSupabaseClient();
  if (!client || !window.HP) return;

  const userKey = typeof window.HP.getUserKey === 'function' ? window.HP.getUserKey() : '';
  const storeKey = typeof window.HP.getStoreKey === 'function' ? window.HP.getStoreKey() : 'default-store';
  if (!userKey) return;

  const recentActual = dailyHistory.slice(-7).reduce((sum, row) => sum + row.amount, 0);
  const forecastNext7 = forecastData.slice(0, 7).reduce((sum, row) => sum + row.yhat, 0);
  const baseline = recentActual > 0 ? recentActual : 1;
  const trendPct = Math.round(((forecastNext7 - recentActual) / baseline) * 100);

  const runInsert = await client.from('demo_forecast_runs').insert({
    user_key: userKey,
    store_key: storeKey,
    periods: forecastData.length,
    history_days: dailyHistory.length,
    trend_pct: trendPct,
  });

  if (runInsert.error || !Array.isArray(runInsert.data) || !runInsert.data.length) {
    return;
  }

  const runId = runInsert.data[0].id;
  if (!runId) return;

  const pointRows = forecastData.map(point => ({
    run_id: runId,
    ds: point.ds,
    yhat: point.yhat,
    yhat_lower: point.yhat_lower,
    yhat_upper: point.yhat_upper,
  }));

  const pointsInsert = await client.from('demo_forecast_points').insert(pointRows);
  if (pointsInsert.error) {
    console.warn('Could not persist forecast points:', pointsInsert.error.message || pointsInsert.error);
  }
}

// ---- Main orchestrator ----
async function loadForecast() {
  setLoadingState(true);
  hideStatus();

  try {
    // 1. Get raw entries from local backend (or Supabase if switched)
    const entries = await getSalesHistory();

    if (!entries || entries.length === 0) {
      showError("No sales data found. Start logging entries to enable forecasting.");
      setLoadingState(false);
      return;
    }

    // 2. Aggregate to daily totals
    const dailyHistory = aggregateByDay(entries);
    const usingProphet = dailyHistory.length >= 14;

    // 3. Call the ML API with graceful local fallback
    let forecastData = [];
    let forecastSource = 'ml';
    try {
      forecastData = await fetchForecast(dailyHistory);
    } catch (mlError) {
      console.warn('ML API unavailable, using local fallback forecast:', mlError);
      forecastData = buildLocalFallbackForecast(dailyHistory, 30);
      forecastSource = 'local-fallback';
      showError('ML server is offline. Showing local fallback forecast.');
    }

    // 4. Build historical data arrays for the chart
    // We pass the last 60 days of actuals (or all if fewer)
    const recentHistory = dailyHistory.slice(-60);
    const historicalAmounts = recentHistory.map(d => d.amount);
    const historicalLabels  = recentHistory.map(d =>
      new Date(d.date).toLocaleDateString("en-PK", { month: "short", day: "numeric" })
    );

    // 5. Build forecast arrays
    const forecastLabels = forecastData.map(d =>
      new Date(d.ds).toLocaleDateString("en-PK", { month: "short", day: "numeric" })
    );
    const forecastYhat  = forecastData.map(d => d.yhat);
    const forecastUpper = forecastData.map(d => d.yhat_upper);
    const forecastLower = forecastData.map(d => d.yhat_lower);

    // 6. Render chart (defined in charts.js)
    renderForecastChart({
      historicalLabels,
      historicalAmounts,
      forecastLabels,
      forecastYhat,
      forecastUpper,
      forecastLower,
    });

    // 7. Update KPI cards and metadata
    updateKPICards(forecastData);
    updateTrendSummaries(dailyHistory, forecastData);
    updateMonthlyBreakdown(dailyHistory, forecastData);
    if (typeof renderSeasonalityChart === 'function') {
      renderSeasonalityChart(dailyHistory);
    }
    updateModelNotes(dailyHistory.length, usingProphet, forecastSource);
    updateHeaderStatus(usingProphet, forecastSource);
    await persistForecastRun(dailyHistory, forecastData);
    lastForecastSource = forecastSource;

  } catch (err) {
    console.error("Forecast error:", err);
    showError("Could not load forecast. Make sure the ML server is running.");
    lastForecastSource = 'local-fallback';
  } finally {
    setLoadingState(false);
  }
}

// ---- Re-run button ----
document.addEventListener("DOMContentLoaded", () => {
  loadForecast();

  const btn = document.getElementById("rerun-btn");
  if (btn) btn.addEventListener("click", loadForecast);

  if (!retryIntervalId) {
    retryIntervalId = window.setInterval(() => {
      if (lastForecastSource === 'local-fallback') {
        loadForecast();
      }
    }, ML_RETRY_MS);
  }
});