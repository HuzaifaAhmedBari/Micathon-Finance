# HisaabPro (Micathon Finance)

**The financial co-pilot for Pakistan's kiryana stores.**

🌐 [Live Demo](https://micathon-finance-production.up.railway.app/)

---

## The Problem

Pakistan has millions of kiryana stores — small, neighborhood retail shops that form the backbone of everyday commerce. Yet most of these store owners manage their finances entirely on paper, in their heads, or not at all. They have no clear picture of whether they're profitable, which products are moving, or what their sales will look like next month.

Without accessible tools built for their context, owners are flying blind — unable to plan inventory, spot problems early, or grow with confidence.

---

## What HisaabPro Does

HisaabPro is a simple, web-based finance and forecasting app designed specifically for kiryana store owners and managers. It gives them a real-time view of their business financials and uses machine learning to predict future revenue — all through a clean interface that requires no accounting knowledge.

The product sits at the intersection of three needs:

- **Visibility** — know where money is coming from and going
- **Control** — manage stock before it runs out or goes to waste
- **Foresight** — see what's coming so you can plan ahead

---

## Core Features

### 📊 Dashboard
A single-screen financial overview showing total sales, expenses, and net balance. Designed to answer the daily question every store owner has: *"How am I doing?"*

### 💸 Transaction Logging
Log sales and expenses in seconds. Each entry is categorized, timestamped, and immediately reflected across the app. Owners or managers can build a complete financial history over time without any accounting background.

### 📦 Inventory Management
Track what's in stock, what's selling, and what needs restocking. Inventory is tied to transactions so the numbers stay consistent without manual reconciliation.

### 🔮 Revenue Forecasting
This is HisaabPro's standout feature. A built-in ML service — powered by Facebook's Prophet model — analyzes historical sales data and generates a forward-looking revenue forecast. The owner can see expected revenue trends and plan purchases, staffing, or expenses accordingly.

If the ML service is unavailable, the app automatically falls back to a client-side estimation model so the experience never breaks.

### 🔔 Subscription & Profile
Users can manage their profile and subscription tier, laying the groundwork for a freemium business model where core tracking is free and advanced forecasting is a paid feature.

---

## Who It's For

**Primary user:** A kiryana store owner aged 25–55 who runs a single storefront, may not have formal accounting training, and primarily uses a smartphone. They need something fast, in their language, and trustworthy.

**Secondary user:** A store manager who handles day-to-day sales and inventory but doesn't own the business. They need a simple way to log entries without messing up the owner's books.

---

## Why It's Different

Most finance tools are built for businesses with accountants. HisaabPro is built for businesses *without* them. The UX is intentionally minimal — no jargon, no complex flows — and the ML forecast is surfaced as a plain, readable insight rather than a raw data export.

The fallback forecast also means the core value proposition (knowing what's coming) is always delivered, even in low-connectivity or infrastructure-down scenarios common in Pakistan's market.

---

## Current Status

Built as a working prototype for **Micathon** (a hackathon). The app is live and fully functional with demo credentials. The ML service, database, and frontend are all integrated end-to-end.

**Demo credentials:**

Email                           | Password |
--------------------------------|----------|
demo-owner@hisaabpro.test       | Demo123! |
demo-manager@hisaabpro.test     | Demo123! |

---

## Tech Stack

| Layer      | Technology                                |
|------------|-------------------------------------------|
| Frontend   | HTML, CSS, Vanilla JavaScript, Chart.js   |
| Backend    | Node.js, Express                          |
| Database   | Supabase (PostgreSQL)                     |
| ML Service | Python, FastAPI, Facebook Prophet, pandas |

---

## Repository Structure

```
.
├── public/                             # Frontend pages, styles, and scripts
├── server/                             # Express route handlers and in-memory cache (db.js)
├── ml/                                 # FastAPI ML forecasting service
│   └── main.py                         # Prophet-based forecast endpoint
├── server.js                           # Express app entrypoint
├── supabase_schema.sql                 # Base database schema
├── supabase_seed.sql                   # Optional seed data
├── supabase_demo_public_users.sql      # Demo auth tables, policies, and demo data
├── supabase_fix_sales_entries_demo.sql # Fix script for demo sales entries
├── supabase_fix_seeded_auth.sql        # Fix script for seeded auth users
└── .env.example                        # Environment variables template
```

---

## Running Locally (Fork Guide)

### Prerequisites

Make sure you have the following installed:

- [Node.js](https://nodejs.org/) v18 or higher
- [Python](https://www.python.org/) 3.10 or higher
- A [Supabase](https://supabase.com/) account and project

---

### Step 1 — Clone the repo

```bash
git clone https://github.com/HuzaifaAhmedBari/Micathon-Finance.git
cd Micathon-Finance
```

### Step 2 — Install Node dependencies

```bash
npm install
```

### Step 3 — Set up environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in your Supabase project credentials:

```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

You can find both values in your Supabase project under **Settings → API**.

### Step 4 — Set up the Supabase database

In your Supabase project, open the **SQL Editor** and run the following scripts **in this exact order**:

1. `supabase_schema.sql` — creates the base tables
2. `supabase_seed.sql` — populates optional sample data *(recommended for first-time setup)*
3. `supabase_demo_public_users.sql` — creates demo auth users, demo data tables, and RLS policies

> **Important:** If you ever pull new changes that touch the database, re-run `supabase_demo_public_users.sql` to stay in sync. The project uses demo-table auth (not Supabase's built-in auth) for reliability, so this script is required for login to work.

### Step 5 — Start the web app

```bash
node server.js
```

The app will be running at **http://localhost:3000**. Log in using the demo credentials above or register a new user.

### Step 6 — Start the ML forecasting service *(optional but recommended)*

The forecast feature calls a separate Python service. Open a second terminal and run:

```bash
cd ml
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Once running, the forecast page will use the Prophet ML model. If this service is not running, the app will automatically fall back to a client-side forecast estimate — so the app still works, just with less accurate predictions.

You can verify the ML service is up by visiting:
- **http://127.0.0.1:8000/health** — health check
- **http://127.0.0.1:8000/docs** — interactive API docs

---

## Troubleshooting

**Pages are blank after logging in**
- Double-check `SUPABASE_URL` and `SUPABASE_ANON_KEY` in your `.env` file.
- Make sure `/supabase-config.js` is being served with non-empty values.

**Can't log in or register**
- Re-run `supabase_demo_public_users.sql` in the Supabase SQL Editor.
- Confirm that the tables, policies, and grants were created without errors.

**Forecast page shows an error**
- Start the ML service in the `ml/` folder on port `8000` (see Step 6).
- If the service is down, the app should display a fallback forecast automatically.

---

## Security Notice

The demo auth pattern in `supabase_demo_public_users.sql` uses open RLS policies designed for hackathon speed and demo reliability. **Do not use this auth model in a production deployment.** Replace it with Supabase's native auth and properly scoped RLS policies before going live.
