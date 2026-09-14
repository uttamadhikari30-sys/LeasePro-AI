-- ============================================================================
-- Harden RLS helper functions against search_path hijacking, per Supabase
-- advisor recommendation for SECURITY DEFINER functions.
-- ============================================================================
create or replace function current_org_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select org_id from profiles where id = auth.uid()
$$;

create or replace function current_user_role()
returns user_role
language sql
security definer
stable
set search_path = public
as $$
  select role from profiles where id = auth.uid()
$$;
