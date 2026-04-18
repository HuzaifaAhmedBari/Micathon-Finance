// =========================================
// HisaabPro — ML Forecast Integration
// =========================================

const ML_API = "http://127.0.0.1:8000"; // ← swap to Render URL when deploying

// ---- Warm up Render on page load (avoids cold-start delay when user clicks) ----
fetch(`${ML_API}/health`).catch(() => {});

// ---- Fetch sales history from Supabase ----
async function getSalesHistory() {
  const hasSupabase = window.supabase && window.supabase._config && window.supabase._config.url && window.supabase._config.anonKey;
  if (hasSupabase) {
    const { data, error } = await supabase
      .from("sales_entries")
      .select("amount, created_at")
      .order("created_at", { ascending: true });

    if (!error && Array.isArray(data) && data.length > 0) {
      return data;
    }

    // Demo mode commonly reads with anon role; fallback to local API history.
    if (error) {
      console.warn("Supabase sales_entries unavailable, using local fallback:", error.message || error);
    }
  }

  const transactions = await HP.getTransactions();
  return transactions
    .filter(txn => txn.type === 'sale')
    .map(txn => ({ amount: txn.amount, created_at: `${txn.date}T00:00:00.000Z` }));
}

// ---- Aggregate individual entries into daily totals ----
// Supabase returns one row per transaction; Prophet needs one row per day
function aggregateByDay(entries) {
  const map = {};
  entries.forEach(e => {
    const date = e.created_at.slice(0, 10); // "YYYY-MM-DD"
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

// ---- Update Model Notes card with real history count ----
function updateModelNotes(historyLength, usingProphet) {
  const notesEl = document.getElementById("model-notes-text");
  if (!notesEl) return;

  if (usingProphet) {
    notesEl.innerHTML = `Based on <strong>${historyLength} historical data points</strong>. Handles weekly &amp; monthly seasonality. Model accuracy improves with more entries.`;
  } else {
    notesEl.innerHTML = `Only <strong>${historyLength} days</strong> of data available. Showing average-based estimate. Log at least <strong>14 days</strong> of sales to enable full AI forecasting.`;
  }
}

// ---- Update the header subtitle with real MAPE (placeholder until you compute it) ----
function updateHeaderStatus(usingProphet) {
  const subtitle = document.querySelector(".header-subtitle");
  if (!subtitle) return;
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

// ---- Main orchestrator ----
async function loadForecast() {
  setLoadingState(true);
  hideStatus();

  try {
    // 1. Get raw entries from Supabase
    const entries = await getSalesHistory();

    if (!entries || entries.length === 0) {
      showError("No sales data found. Start logging entries to enable forecasting.");
      setLoadingState(false);
      return;
    }

    // 2. Aggregate to daily totals
    const dailyHistory = aggregateByDay(entries);
    const usingProphet = dailyHistory.length >= 14;

    // 3. Call the ML API
    const forecastData = await fetchForecast(dailyHistory);

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
    updateModelNotes(dailyHistory.length, usingProphet);
    updateHeaderStatus(usingProphet);

  } catch (err) {
    console.error("Forecast error:", err);
    showError("Could not load forecast. Make sure the ML server is running.");
  } finally {
    setLoadingState(false);
  }
}

// ---- Re-run button ----
document.addEventListener("DOMContentLoaded", () => {
  loadForecast();

  const btn = document.getElementById("rerun-btn");
  if (btn) btn.addEventListener("click", loadForecast);
});