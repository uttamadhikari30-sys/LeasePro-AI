-- ============================================================================
-- Disable self-service signup once any organization already exists.
-- After the first org+admin is created (normally via the one-time bootstrap
-- signup), every subsequent user account must be provisioned by an org admin
-- via POST /organizations/users, never through the public signup form.
-- ============================================================================
create or replace function create_organization_with_admin(
  p_org_name text,
  p_user_id uuid,
  p_full_name text,
  p_reporting_standard reporting_standard default 'IND_AS_116'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  if exists (select 1 from organizations limit 1) then
    raise exception 'Self-service signup is disabled. Ask your organization admin to create your account.';
  end if;

  if exists (select 1 from profiles where id = p_user_id) then
    raise exception 'User already belongs to an organization';
  end if;

  insert into organizations (name, reporting_standard)
  values (p_org_name, p_reporting_standard)
  returning id into v_org_id;

  insert into profiles (id, org_id, full_name, role)
  values (p_user_id, v_org_id, p_full_name, 'ADMIN');

  return v_org_id;
end;
$$;

grant execute on function create_organization_with_admin(text, uuid, text, reporting_standard) to authenticated, service_role;
