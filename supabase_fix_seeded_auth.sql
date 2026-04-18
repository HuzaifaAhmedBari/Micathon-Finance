-- Fix legacy SQL-seeded auth users that fail password sign-in with 500 unexpected_failure
-- Run in Supabase SQL editor (service role).
--
-- This removes legacy seeded auth users and dependent rows.
-- After running, create these users again from the app Register page.

begin;

delete from auth.users
where lower(email) in (
  lower('owner@hisaabpro.test'),
  lower('manager@hisaabpro.test')
);

commit;

-- Optional verification:
-- select id, email, created_at from auth.users
-- where lower(email) in (lower('owner@hisaabpro.test'), lower('manager@hisaabpro.test'));