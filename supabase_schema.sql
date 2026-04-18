-- HisaabPro Supabase schema
-- Run this in the Supabase SQL editor.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text not null default '',
  last_name text not null default '',
  store_name text not null default '',
  phone text not null default '',
  city text not null default '',
  area text not null default '',
  role text not null default 'Store Owner',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_settings (
  id uuid primary key references auth.users (id) on delete cascade,
  low_stock_alerts boolean not null default true,
  daily_summary boolean not null default true,
  forecast_updates boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  category_type text not null check (category_type in ('sale', 'expense')),
  created_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  transaction_date date not null,
  description text not null,
  category text not null,
  type text not null check (type in ('sale', 'expense')),
  amount numeric(14,2) not null check (amount >= 0),
  unit text not null default 'pcs',
  notes text,
  inventory_item_id uuid,
  inventory_qty_change numeric(14,2),
  is_utility boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists transactions_owner_date_idx on public.transactions (owner_id, transaction_date desc);

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
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

create index if not exists inventory_items_owner_idx on public.inventory_items (owner_id);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items (id) on delete cascade,
  transaction_id uuid references public.transactions (id) on delete set null,
  movement_type text not null check (movement_type in ('sale', 'restock', 'adjustment')),
  qty_change numeric(14,2) not null,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.forecast_runs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  model_name text not null default 'Prophet',
  horizon_days integer not null default 30,
  created_at timestamptz not null default now()
);

create table if not exists public.forecast_points (
  id uuid primary key default gen_random_uuid(),
  forecast_run_id uuid not null references public.forecast_runs (id) on delete cascade,
  forecast_date date not null,
  yhat numeric(14,2) not null,
  yhat_lower numeric(14,2),
  yhat_upper numeric(14,2),
  created_at timestamptz not null default now()
);

drop view if exists public.sales_entries;
create view public.sales_entries as
select
  id,
  owner_id,
  amount,
  created_at,
  transaction_date,
  description,
  category,
  type
from public.transactions
where type = 'sale';

create or replace function public.bootstrap_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, first_name, last_name, store_name, phone, city, area, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    coalesce(new.raw_user_meta_data ->> 'last_name', ''),
    coalesce(new.raw_user_meta_data ->> 'store_name', ''),
    coalesce(new.raw_user_meta_data ->> 'phone', ''),
    coalesce(new.raw_user_meta_data ->> 'city', ''),
    coalesce(new.raw_user_meta_data ->> 'area', ''),
    coalesce(new.raw_user_meta_data ->> 'role', 'Store Owner')
  )
  on conflict (id) do update set
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    store_name = excluded.store_name,
    phone = excluded.phone,
    city = excluded.city,
    area = excluded.area,
    role = excluded.role,
    updated_at = now();

  insert into public.user_settings (id)
  values (new.id)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.bootstrap_user_profile();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_profiles_updated_at on public.profiles;
create trigger touch_profiles_updated_at
before update on public.profiles
for each row execute procedure public.touch_updated_at();

drop trigger if exists touch_user_settings_updated_at on public.user_settings;
create trigger touch_user_settings_updated_at
before update on public.user_settings
for each row execute procedure public.touch_updated_at();

drop trigger if exists touch_transactions_updated_at on public.transactions;
create trigger touch_transactions_updated_at
before update on public.transactions
for each row execute procedure public.touch_updated_at();

drop trigger if exists touch_inventory_items_updated_at on public.inventory_items;
create trigger touch_inventory_items_updated_at
before update on public.inventory_items
for each row execute procedure public.touch_updated_at();

create or replace function public.adjust_inventory_after_movement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.inventory_items
  set qty = greatest(0, qty + new.qty_change),
      updated_at = now()
  where id = new.inventory_item_id;

  return new;
end;
$$;

drop trigger if exists inventory_movement_adjustment on public.inventory_movements;
create trigger inventory_movement_adjustment
after insert on public.inventory_movements
for each row execute procedure public.adjust_inventory_after_movement();

alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.inventory_items enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.forecast_runs enable row level security;
alter table public.forecast_points enable row level security;

drop policy if exists "profiles owner read" on public.profiles;
drop policy if exists "profiles owner insert" on public.profiles;
drop policy if exists "profiles owner update" on public.profiles;
drop policy if exists "user_settings owner read" on public.user_settings;
drop policy if exists "user_settings owner insert" on public.user_settings;
drop policy if exists "user_settings owner update" on public.user_settings;
drop policy if exists "categories owner all" on public.categories;
drop policy if exists "transactions owner all" on public.transactions;
drop policy if exists "inventory_items owner all" on public.inventory_items;
drop policy if exists "inventory_movements owner all" on public.inventory_movements;
drop policy if exists "forecast_runs owner all" on public.forecast_runs;
drop policy if exists "forecast_points owner read" on public.forecast_points;

create policy "profiles owner read" on public.profiles for select using (auth.uid() = id);
create policy "profiles owner insert" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles owner update" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "user_settings owner read" on public.user_settings for select using (auth.uid() = id);
create policy "user_settings owner insert" on public.user_settings for insert with check (auth.uid() = id);
create policy "user_settings owner update" on public.user_settings for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "categories owner all" on public.categories for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "transactions owner all" on public.transactions for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "inventory_items owner all" on public.inventory_items for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "inventory_movements owner all" on public.inventory_movements for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "forecast_runs owner all" on public.forecast_runs for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "forecast_points owner read" on public.forecast_points for select using (
  exists (
    select 1
    from public.forecast_runs fr
    where fr.id = forecast_points.forecast_run_id
      and fr.owner_id = auth.uid()
  )
);
