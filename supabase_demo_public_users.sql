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
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.demo_public_users
add column if not exists demo_password_hash text;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'demo_public_users'
      and column_name = 'demo_password'
  ) then
    execute $migrate$
      update public.demo_public_users
      set demo_password_hash = encode(digest(coalesce(demo_password, ''), 'sha256'), 'hex')
      where (demo_password_hash is null or demo_password_hash = '')
        and coalesce(demo_password, '') <> ''
    $migrate$;
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
  is_active = excluded.is_active,
  updated_at = now();

-- Demo login credentials
-- demo-owner@hisaabpro.test / Demo123!
-- demo-manager@hisaabpro.test / Demo123!

-- Optional cleanup after migration:
-- alter table public.demo_public_users drop column if exists demo_password;
