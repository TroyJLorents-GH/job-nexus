-- Deny-all RLS. The API uses the service-role key, which bypasses RLS entirely,
-- so application behavior is unchanged. This closes anon/authenticated access
-- if a publishable key is ever exposed. Applied to production 2026-08-20.
alter table documents enable row level security;
alter table chunks enable row level security;
