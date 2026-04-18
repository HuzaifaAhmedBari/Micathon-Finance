-- HisaabPro sample seed data
-- Run this after supabase_schema.sql in the Supabase SQL editor.
--
-- This file inserts sample auth users plus matching profiles, settings,
-- inventory, transactions, and forecast data.
--
-- NOTE:
-- Users inserted directly into auth.users can trigger password sign-in errors
-- in some Supabase projects (for example: unexpected_failure / Database error
-- querying schema). For production-like auth testing, register users through
-- /auth/v1/signup instead of relying on SQL-seeded auth rows.
--
-- Sample credentials:
-- owner@hisaabpro.test / Owner123!
-- manager@hisaabpro.test / Manager123!

create extension if not exists pgcrypto;

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
select
  '11111111-1111-1111-1111-111111111111'::uuid,
  '00000000-0000-0000-0000-000000000000'::uuid,
  'authenticated',
  'authenticated',
  'owner@hisaabpro.test',
  crypt('Owner123!', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"first_name":"Ahsan","last_name":"Khan","store_name":"Khan Traders","phone":"+92 300 1111111","city":"Lahore","area":"Gulberg","role":"Store Owner"}'::jsonb,
  now(),
  now()
where not exists (
  select 1
  from auth.users u
  where lower(u.email) = lower('owner@hisaabpro.test')
);

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
select
  '22222222-2222-2222-2222-222222222222'::uuid,
  '00000000-0000-0000-0000-000000000000'::uuid,
  'authenticated',
  'authenticated',
  'manager@hisaabpro.test',
  crypt('Manager123!', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"first_name":"Sara","last_name":"Ahmed","store_name":"Ahmed Grocers","phone":"+92 321 2222222","city":"Karachi","area":"Clifton","role":"Store Manager"}'::jsonb,
  now(),
  now()
where not exists (
  select 1
  from auth.users u
  where lower(u.email) = lower('manager@hisaabpro.test')
);

insert into public.profiles (id, first_name, last_name, store_name, phone, city, area, role)
select '11111111-1111-1111-1111-111111111111'::uuid, 'Ahsan', 'Khan', 'Khan Traders', '+92 300 1111111', 'Lahore', 'Gulberg', 'Store Owner'
union all
select '22222222-2222-2222-2222-222222222222'::uuid, 'Sara', 'Ahmed', 'Ahmed Grocers', '+92 321 2222222', 'Karachi', 'Clifton', 'Store Manager'
on conflict (id) do update set
  first_name = excluded.first_name,
  last_name = excluded.last_name,
  store_name = excluded.store_name,
  phone = excluded.phone,
  city = excluded.city,
  area = excluded.area,
  role = excluded.role,
  updated_at = now();

insert into public.user_settings (id, low_stock_alerts, daily_summary, forecast_updates)
select '11111111-1111-1111-1111-111111111111'::uuid, true, true, false
union all
select '22222222-2222-2222-2222-222222222222'::uuid, true, false, true
on conflict (id) do update set
  low_stock_alerts = excluded.low_stock_alerts,
  daily_summary = excluded.daily_summary,
  forecast_updates = excluded.forecast_updates,
  updated_at = now();

insert into public.categories (id, owner_id, name, category_type)
select '33333333-3333-3333-3333-333333333331'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, 'Groceries', 'sale'
union all
select '33333333-3333-3333-3333-333333333332'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, 'Utilities', 'expense'
union all
select '33333333-3333-3333-3333-333333333333'::uuid, '22222222-2222-2222-2222-222222222222'::uuid, 'Fruits', 'sale'
on conflict (id) do nothing;

insert into public.inventory_items (id, owner_id, name, category, qty, unit, cost_price, sale_price, max_qty, low_threshold)
select '44444444-4444-4444-4444-444444444441'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, 'Basmati Rice', 'Groceries', 32, 'kg', 180, 210, 60, 10
union all
select '44444444-4444-4444-4444-444444444442'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, 'Sugar', 'Groceries', 24, 'kg', 145, 160, 50, 8
union all
select '44444444-4444-4444-4444-444444444443'::uuid, '22222222-2222-2222-2222-222222222222'::uuid, 'Apples', 'Fruits', 18, 'kg', 220, 260, 40, 6
on conflict (id) do update set
  owner_id = excluded.owner_id,
  name = excluded.name,
  category = excluded.category,
  qty = excluded.qty,
  unit = excluded.unit,
  cost_price = excluded.cost_price,
  sale_price = excluded.sale_price,
  max_qty = excluded.max_qty,
  low_threshold = excluded.low_threshold,
  updated_at = now();

insert into public.transactions (id, owner_id, transaction_date, description, category, type, amount, unit, notes, inventory_item_id, inventory_qty_change, is_utility)
select '55555555-5555-5555-5555-555555555551'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, current_date - 4, 'Retail rice sale', 'Groceries', 'sale', 7800, 'pcs', 'Cash sale', '44444444-4444-4444-4444-444444444441'::uuid, -12, false
union all
select '55555555-5555-5555-5555-555555555552'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, current_date - 3, 'Electricity bill', 'Utilities', 'expense', 4200, 'pcs', 'Monthly bill', null, null, true
union all
select '55555555-5555-5555-5555-555555555553'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, current_date - 2, 'Sugar sale', 'Groceries', 'sale', 5400, 'pcs', 'Counter sale', '44444444-4444-4444-4444-444444444442'::uuid, -9, false
union all
select '55555555-5555-5555-5555-555555555554'::uuid, '22222222-2222-2222-2222-222222222222'::uuid, current_date - 1, 'Apple sale', 'Fruits', 'sale', 3600, 'pcs', 'Morning sale', '44444444-4444-4444-4444-444444444443'::uuid, -6, false
on conflict (id) do nothing;

insert into public.inventory_movements (id, owner_id, inventory_item_id, transaction_id, movement_type, qty_change, note)
select '66666666-6666-6666-6666-666666666661'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, '44444444-4444-4444-4444-444444444441'::uuid, '55555555-5555-5555-5555-555555555551'::uuid, 'sale', -12, 'Seed sale movement'
union all
select '66666666-6666-6666-6666-666666666662'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, '44444444-4444-4444-4444-444444444442'::uuid, '55555555-5555-5555-5555-555555555553'::uuid, 'sale', -9, 'Seed sale movement'
union all
select '66666666-6666-6666-6666-666666666663'::uuid, '22222222-2222-2222-2222-222222222222'::uuid, '44444444-4444-4444-4444-444444444443'::uuid, '55555555-5555-5555-5555-555555555554'::uuid, 'sale', -6, 'Seed sale movement'
on conflict (id) do nothing;

insert into public.forecast_runs (id, owner_id, model_name, horizon_days)
select '77777777-7777-7777-7777-777777777771'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, 'Prophet', 30
union all
select '77777777-7777-7777-7777-777777777772'::uuid, '22222222-2222-2222-2222-222222222222'::uuid, 'Prophet', 30
on conflict (id) do nothing;

insert into public.forecast_points (id, forecast_run_id, forecast_date, yhat, yhat_lower, yhat_upper)
values
  ('88888888-8888-8888-8888-888888888881'::uuid, '77777777-7777-7777-7777-777777777771'::uuid, current_date + 1, 7100, 6400, 7800),
  ('88888888-8888-8888-8888-888888888882'::uuid, '77777777-7777-7777-7777-777777777771'::uuid, current_date + 2, 7350, 6600, 8050),
  ('88888888-8888-8888-8888-888888888883'::uuid, '77777777-7777-7777-7777-777777777772'::uuid, current_date + 1, 3900, 3500, 4300)
on conflict (id) do nothing;