-- HisaabPro demo-only public users
-- Purpose: hackathon/demo login fallback without relying on Supabase Auth rate limits.
--
-- SECURITY WARNING:
-- - This table is intentionally readable with anon access for demo environments.
-- - Do NOT use this design in production.

create extension if not exists pgcrypto;

create table if not exists public.demo_public_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  demo_password_hash text not null,
  first_name text not null default '',
  last_name text not null default '',
  store_name text not null default '',
  role text not null default 'Demo User',
  phone text not null default '',
  city text not null default '',
  area text not null default '',
  pref_low_stock_alerts boolean not null default true,
  pref_daily_summary boolean not null default true,
  pref_forecast_updates boolean not null default false,
  subscription_plan text not null default 'starter',
  subscription_status text not null default 'active',
  subscription_renewal_date date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.demo_public_users
add column if not exists demo_password_hash text;

alter table public.demo_public_users
add column if not exists pref_low_stock_alerts boolean not null default true;

alter table public.demo_public_users
add column if not exists pref_daily_summary boolean not null default true;

alter table public.demo_public_users
add column if not exists pref_forecast_updates boolean not null default false;

alter table public.demo_public_users
add column if not exists subscription_plan text not null default 'starter';

alter table public.demo_public_users
add column if not exists subscription_status text not null default 'active';

alter table public.demo_public_users
add column if not exists subscription_renewal_date date;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'demo_public_users'
      and column_name = 'demo_password'
  ) then
    execute $legacy_soften$
      alter table public.demo_public_users
      alter column demo_password drop not null
    $legacy_soften$;

    execute $legacy_default$
      alter table public.demo_public_users
      alter column demo_password set default ''
    $legacy_default$;

    execute $migrate$
      update public.demo_public_users
      set demo_password_hash = encode(digest(coalesce(demo_password, ''), 'sha256'), 'hex')
      where (demo_password_hash is null or demo_password_hash = '')
        and coalesce(demo_password, '') <> ''
    $migrate$;

    execute $legacy_fill$
      update public.demo_public_users
      set demo_password = ''
      where demo_password is null
    $legacy_fill$;

    execute $legacy_drop$
      alter table public.demo_public_users
      drop column if exists demo_password
    $legacy_drop$;
  end if;
end
$$;

update public.demo_public_users
set demo_password_hash = ''
where demo_password_hash is null;

alter table public.demo_public_users
alter column demo_password_hash set not null;

create or replace function public.touch_demo_public_users_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_demo_public_users_updated_at on public.demo_public_users;
create trigger touch_demo_public_users_updated_at
before update on public.demo_public_users
for each row execute procedure public.touch_demo_public_users_updated_at();

alter table public.demo_public_users enable row level security;

drop policy if exists "demo_public_users anon read active" on public.demo_public_users;
drop policy if exists "demo_public_users anon insert" on public.demo_public_users;
drop policy if exists "demo_public_users anon update" on public.demo_public_users;
create policy "demo_public_users anon read active"
on public.demo_public_users
for select
using (is_active = true);

create policy "demo_public_users anon insert"
on public.demo_public_users
for insert
with check (true);

create policy "demo_public_users anon update"
on public.demo_public_users
for update
using (true)
with check (true);

create table if not exists public.demo_transactions (
  id text primary key,
  user_key text not null,
  store_key text not null default 'default-store',
  transaction_date date not null,
  description text not null,
  category text not null,
  type text not null check (type in ('sale', 'expense')),
  amount numeric(14,2) not null check (amount >= 0),
  unit text not null default 'pcs',
  notes text,
  inventory_item_id text,
  inventory_qty_change numeric(14,2),
  is_utility boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists demo_transactions_user_store_date_idx
  on public.demo_transactions (user_key, store_key, transaction_date desc);

create table if not exists public.demo_inventory_items (
  id text primary key,
  user_key text not null,
  store_key text not null default 'default-store',
  name text not null,
  category text not null,
  qty numeric(14,2) not null default 0,
  unit text not null default 'pcs',
  cost_price numeric(14,2) not null default 0,
  sale_price numeric(14,2) not null default 0,
  max_qty numeric(14,2) not null default 20,
  low_threshold numeric(14,2) not null default 5,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists demo_inventory_items_user_store_idx
  on public.demo_inventory_items (user_key, store_key);

create table if not exists public.demo_forecast_runs (
  id uuid primary key default gen_random_uuid(),
  user_key text not null,
  store_key text not null default 'default-store',
  periods integer not null default 30,
  history_days integer not null default 0,
  trend_pct integer,
  created_at timestamptz not null default now()
);

create index if not exists demo_forecast_runs_user_store_created_idx
  on public.demo_forecast_runs (user_key, store_key, created_at desc);

create table if not exists public.demo_forecast_points (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.demo_forecast_runs(id) on delete cascade,
  ds date not null,
  yhat numeric(14,2) not null,
  yhat_lower numeric(14,2),
  yhat_upper numeric(14,2),
  created_at timestamptz not null default now()
);

create index if not exists demo_forecast_points_run_idx
  on public.demo_forecast_points (run_id, ds);

create or replace function public.touch_demo_row_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_demo_transactions_updated_at on public.demo_transactions;
create trigger touch_demo_transactions_updated_at
before update on public.demo_transactions
for each row execute procedure public.touch_demo_row_updated_at();

drop trigger if exists touch_demo_inventory_items_updated_at on public.demo_inventory_items;
create trigger touch_demo_inventory_items_updated_at
before update on public.demo_inventory_items
for each row execute procedure public.touch_demo_row_updated_at();

alter table public.demo_transactions enable row level security;
alter table public.demo_inventory_items enable row level security;
alter table public.demo_forecast_runs enable row level security;
alter table public.demo_forecast_points enable row level security;

drop policy if exists "demo_transactions anon all" on public.demo_transactions;
create policy "demo_transactions anon all"
on public.demo_transactions
for all
using (true)
with check (true);

drop policy if exists "demo_inventory_items anon all" on public.demo_inventory_items;
create policy "demo_inventory_items anon all"
on public.demo_inventory_items
for all
using (true)
with check (true);

drop policy if exists "demo_forecast_runs anon all" on public.demo_forecast_runs;
create policy "demo_forecast_runs anon all"
on public.demo_forecast_runs
for all
using (true)
with check (true);

drop policy if exists "demo_forecast_points anon all" on public.demo_forecast_points;
create policy "demo_forecast_points anon all"
on public.demo_forecast_points
for all
using (true)
with check (true);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on table public.demo_public_users to anon, authenticated;
grant select, insert, update, delete on table public.demo_transactions to anon, authenticated;
grant select, insert, update, delete on table public.demo_inventory_items to anon, authenticated;
grant select, insert, update, delete on table public.demo_forecast_runs to anon, authenticated;
grant select, insert, update, delete on table public.demo_forecast_points to anon, authenticated;

insert into public.demo_public_users (
  id,
  email,
  demo_password_hash,
  first_name,
  last_name,
  store_name,
  role,
  phone,
  city,
  area,
  pref_low_stock_alerts,
  pref_daily_summary,
  pref_forecast_updates,
  subscription_plan,
  subscription_status,
  subscription_renewal_date,
  is_active
)
values
  (
    'aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaa1'::uuid,
    'demo-owner@hisaabpro.test',
    '588c55f3ce2b8569b153c5abbf13f9f74308b88a20017cc699b835cc93195d16',
    'Demo',
    'Owner',
    'Khan Traders Demo',
    'Store Owner',
    '+92 300 0000001',
    'Lahore',
    'Gulberg',
    true,
    true,
    true,
    'pro',
    'active',
    current_date + 30,
    true
  ),
  (
    'aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaa2'::uuid,
    'demo-manager@hisaabpro.test',
    '588c55f3ce2b8569b153c5abbf13f9f74308b88a20017cc699b835cc93195d16',
    'Demo',
    'Manager',
    'Ahmed Grocers Demo',
    'Store Manager',
    '+92 300 0000002',
    'Karachi',
    'Clifton',
    true,
    false,
    true,
    'starter',
    'active',
    current_date + 14,
    true
  )
on conflict (email) do update set
  demo_password_hash = excluded.demo_password_hash,
  first_name = excluded.first_name,
  last_name = excluded.last_name,
  store_name = excluded.store_name,
  role = excluded.role,
  phone = excluded.phone,
  city = excluded.city,
  area = excluded.area,
  pref_low_stock_alerts = excluded.pref_low_stock_alerts,
  pref_daily_summary = excluded.pref_daily_summary,
  pref_forecast_updates = excluded.pref_forecast_updates,
  subscription_plan = excluded.subscription_plan,
  subscription_status = excluded.subscription_status,
  subscription_renewal_date = excluded.subscription_renewal_date,
  is_active = excluded.is_active,
  updated_at = now();

-- Demo login credentials
-- demo-owner@hisaabpro.test / Demo123!
-- demo-manager@hisaabpro.test / Demo123!

-- Legacy plaintext password column is dropped automatically during migration.
