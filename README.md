# HisaabPro (Micathon Finance)

HisaabPro is a lightweight finance and forecasting web app for kiryana stores. It helps track sales, expenses, and inventory, then uses an ML service to generate revenue forecasts and trend insights.

## What This Project Includes

- Multi-page web UI for dashboard, transactions, inventory, forecast, logging, profile, and subscription.
- Express server for static hosting and REST endpoints.
- Supabase-backed persistence for demo auth, transactions, inventory, and forecast artifacts.
- FastAPI + Prophet ML service for forecast generation.
- Automatic client fallback forecast if ML service is unavailable.

## Tech Stack

- Frontend: HTML, CSS, vanilla JavaScript, Chart.js
- Backend: Node.js, Express
- Database: Supabase (PostgreSQL)
- ML API: Python, FastAPI, Prophet, pandas

## Repository Structure

```text
.
|- public/                  # Frontend pages, styles, and scripts
|- server/                  # Express route handlers and runtime cache module
|- ml/                      # FastAPI forecasting service
|- server.js                # Express app entrypoint
|- supabase_schema.sql      # Base schema
|- supabase_seed.sql        # Optional seed data
|- supabase_demo_public_users.sql   # Demo auth + demo data tables and policies
|- .env.example             # Environment variables template
```

## How The App Works

1. The browser app loads Supabase config from /supabase-config.js.
2. Authentication/profile in demo mode uses public.demo_public_users.
3. Transactions and inventory are saved to:
	 - public.demo_transactions
	 - public.demo_inventory_items
4. Forecast runs and points are saved to:
	 - public.demo_forecast_runs
	 - public.demo_forecast_points
5. Forecast page calls ML API at http://127.0.0.1:8000/forecast.
6. If ML is down, the frontend generates a local fallback forecast and auto-retries ML.

## Prerequisites

- Node.js 18+ (recommended)
- Python 3.10+ (recommended for Prophet compatibility)
- A Supabase project

## Local Setup

### 1) Install Node dependencies

```bash
npm install
```

### 2) Configure environment variables

Copy .env.example to .env and set:

```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3) Configure Supabase schema

In Supabase SQL Editor, run scripts in this order:

1. supabase_schema.sql
2. supabase_seed.sql (optional)
3. supabase_demo_public_users.sql (required for current demo auth + demo data tables)

Note:
- Re-run supabase_demo_public_users.sql after pulling DB-related updates.
- The project currently uses demo-table auth mode for hackathon reliability.

### 4) Run the web app

```bash
node server.js
```

App URL:

- http://localhost:3000

### 5) Run the ML API (optional but recommended)

From the ml folder:

```bash
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

ML endpoints:

- http://127.0.0.1:8000/health
- http://127.0.0.1:8000/forecast
- http://127.0.0.1:8000/docs

If ML is not running, the forecast page still works using local fallback estimation.

## Demo Credentials

Available after running supabase_demo_public_users.sql:

- demo-owner@hisaabpro.test / Demo123!
- demo-manager@hisaabpro.test / Demo123!

## Key API Routes (Express)

- GET /api/presets
- GET /api/transactions
- POST /api/transactions
- DELETE /api/transactions/:id
- GET /api/inventory
- POST /api/inventory
- PUT /api/inventory/:id

## Data and Persistence Notes

- Primary persistence is Supabase from frontend scripts.
- server/db.js keeps in-memory data for local API route compatibility.
- Runtime app data is not written to server/data.json.

## Troubleshooting

- Empty pages after login:
	- Verify SUPABASE_URL and SUPABASE_ANON_KEY in .env.
	- Ensure /supabase-config.js returns non-empty values.
- Login/register issues:
	- Re-run supabase_demo_public_users.sql and confirm policies/grants exist.
- Forecast errors:
	- Start ML service in ml/ on port 8000.
	- Check http://127.0.0.1:8000/health.
	- If down, app should show fallback forecast and retry automatically.

## Security Notice

The demo auth design in supabase_demo_public_users.sql is intentionally permissive for hackathon/demo speed. Do not use this auth model or open anon policies in production.
