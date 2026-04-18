from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import pandas as pd
from prophet import Prophet
import logging

# ── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ── App setup ─────────────────────────────────────────────────────────────────
app = FastAPI(
    title="HisaabPro ML Service",
    description="Revenue forecasting API for kiryana store owners",
    version="1.0.0"
)

# ── CORS ──────────────────────────────────────────────────────────────────────
# Allow your Netlify frontend to call this API
app.add_middleware(
    app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # or replace * with your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Request / Response models ─────────────────────────────────────────────────
class SalesEntry(BaseModel):
    date: str    # "YYYY-MM-DD"
    amount: float

class ForecastRequest(BaseModel):
    history: List[SalesEntry]
    periods: int = 30

class ForecastPoint(BaseModel):
    ds: str
    yhat: float
    yhat_lower: float
    yhat_upper: float

# ── Minimum data threshold for Prophet ───────────────────────────────────────
MIN_DAYS_FOR_PROPHET = 14

# ── Helper: simple average-based fallback ────────────────────────────────────
def average_fallback(df: pd.DataFrame, periods: int) -> List[dict]:
    """
    When there is not enough history for Prophet,
    return a flat forecast based on the daily average
    with ±15% confidence bounds.
    """
    avg = df["y"].mean()
    last_date = pd.to_datetime(df["ds"].max())
    future_dates = pd.date_range(start=last_date + pd.Timedelta(days=1), periods=periods)

    return [
        {
            "ds": str(d.date()),
            "yhat": round(avg, 2),
            "yhat_lower": round(avg * 0.85, 2),
            "yhat_upper": round(avg * 1.15, 2),
        }
        for d in future_dates
    ]

# ── Helper: run Prophet ───────────────────────────────────────────────────────
def run_prophet(df: pd.DataFrame, periods: int) -> List[dict]:
    """
    Fit a Prophet model and return the next `periods` days of forecasts.
    """
    model = Prophet(
        weekly_seasonality=True,    # Kiryana stores are busier on weekends
        yearly_seasonality=False,   # Not enough data for yearly patterns
        daily_seasonality=False,
        changepoint_prior_scale=0.05,   # Conservative — stable on sparse data
        seasonality_prior_scale=10.0,
    )

    model.fit(df)

    future = model.make_future_dataframe(periods=periods, freq="D")
    forecast = model.predict(future)

    # Only return the future portion (not historical fitted values)
    result = forecast[["ds", "yhat", "yhat_lower", "yhat_upper"]].tail(periods)

    return [
        {
            "ds": str(row["ds"].date()),
            "yhat": round(max(row["yhat"], 0), 2),           # revenue can't be negative
            "yhat_lower": round(max(row["yhat_lower"], 0), 2),
            "yhat_upper": round(max(row["yhat_upper"], 0), 2),
        }
        for _, row in result.iterrows()
    ]

# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health_check():
    """
    Lightweight ping endpoint.
    Call this on frontend page load to warm up the Render instance
    before the user requests a forecast.
    """
    return {"status": "ok", "service": "HisaabPro ML"}


@app.post("/forecast", response_model=List[ForecastPoint])
def forecast(req: ForecastRequest):
    """
    Accepts daily sales history and returns a 30-day revenue forecast.

    - If history >= 14 days  → Prophet model with weekly seasonality
    - If history  < 14 days  → Average-based fallback with ±15% bounds
    """

    if not req.history:
        raise HTTPException(
            status_code=400,
            detail="No sales history provided. Log some sales first."
        )

    if req.periods < 1 or req.periods > 90:
        raise HTTPException(
            status_code=400,
            detail="periods must be between 1 and 90."
        )

    # Build DataFrame in the format Prophet expects: columns ds and y
    try:
        df = pd.DataFrame([
            {"ds": entry.date, "y": entry.amount}
            for entry in req.history
        ])
        df["ds"] = pd.to_datetime(df["ds"])
        df["y"] = pd.to_numeric(df["y"])
        df = df.sort_values("ds").reset_index(drop=True)

        # Drop duplicates — aggregate same-day entries by summing
        df = df.groupby("ds", as_index=False)["y"].sum()

    except Exception as e:
        logger.error(f"Data parsing error: {e}")
        raise HTTPException(status_code=422, detail=f"Invalid data format: {str(e)}")

    unique_days = len(df)
    logger.info(f"Received {unique_days} days of history. Periods requested: {req.periods}")

    # Route to Prophet or fallback based on data sufficiency
    try:
        if unique_days >= MIN_DAYS_FOR_PROPHET:
            logger.info("Running Prophet model.")
            result = run_prophet(df, req.periods)
        else:
            logger.info(f"Only {unique_days} days available. Using average fallback.")
            result = average_fallback(df, req.periods)
    except Exception as e:
        logger.error(f"Forecasting error: {e}")
        raise HTTPException(status_code=500, detail=f"Forecasting failed: {str(e)}")

    return result


@app.get("/")
def root():
    return {
        "message": "HisaabPro ML Service is running.",
        "docs": "/docs",
        "forecast_endpoint": "POST /forecast"
    }