-- Update the sales_entries view to read from demo_transactions
-- Run this in the Supabase SQL editor for the live database.

drop view if exists public.sales_entries;

create view public.sales_entries as
select
  id,
  user_key,
  store_key,
  amount,
  created_at,
  transaction_date,
  description,
  category,
  type
from public.demo_transactions
where type = 'sale';