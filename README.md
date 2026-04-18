# Micathon Finance / HisaabPro

## Supabase Setup

1. Create a Supabase project.
2. Paste the SQL from [supabase_schema.sql](supabase_schema.sql) into the SQL editor and run it.
3. Optional: run [supabase_seed.sql](supabase_seed.sql) to load sample users and sample app data.
4. Optional for demos: run [supabase_demo_public_users.sql](supabase_demo_public_users.sql) to enable public demo-user login fallback.
4. Copy your Supabase project URL and anon key into [.env](.env).
5. Start the app with `node server.js`.

## Demo Login Fallback (Hackathon Mode)

- If Supabase Auth login/signup is rate-limited or unavailable, the app can fallback to `public.demo_public_users` for login.
- Run [supabase_demo_public_users.sql](supabase_demo_public_users.sql) (re-run after updates to refresh policies/data).
- Demo credentials:
	- `demo-owner@hisaabpro.test` / `Demo123!`
	- `demo-manager@hisaabpro.test` / `Demo123!`
- Demo passwords are stored as SHA-256 hashes in `demo_public_users.demo_password_hash`.
- This mode is for demos/testing only and should not be used in production.

## User-Specific Demo Data

- Transactions, expenses, inventory, and forecast source history are scoped by logged-in user email (`userKey`).
- Each demo user sees only their own records from the local API data store.
- New account creation includes contact number and saves it to `demo_public_users.phone`.

## Environment

- `SUPABASE_URL`: your Supabase project URL.
- `SUPABASE_ANON_KEY`: your public anon key for browser auth and reads.

## Auth

- `login.html`, `register.html`, and `profile.html` run in demo-table mode using `public.demo_public_users`.
- This avoids Supabase Auth signup/signin rate limits during hackathon demos.
- Run [supabase_demo_public_users.sql](supabase_demo_public_users.sql) before testing auth flows.
- The profile page tabs (personal/store/notifications/security) load and save directly to `demo_public_users`.
- `payment.html` updates `subscription_plan`, `subscription_status`, and `subscription_renewal_date` in `demo_public_users`.
