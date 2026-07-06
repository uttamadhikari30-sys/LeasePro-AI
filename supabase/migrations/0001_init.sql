-- LeasePro AI — Phase 1 schema
-- Multi-tenant lease accounting (Ind AS 116 / IFRS 16), RLS-isolated by organization.

create extension if not exists "pgcrypto";

-- ============================================================================
-- Enums
-- ============================================================================
create type user_role as enum ('ADMIN', 'ACCOUNTANT', 'APPROVER', 'VIEWER');
create type reporting_standard as enum ('IND_AS_116', 'IFRS_16');
create type payment_frequency as enum ('MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'ANNUALLY');
create type payment_timing as enum ('ADVANCE', 'ARREARS');
create type escalation_type as enum ('NONE', 'FIXED_PERCENT', 'CUSTOM');
create type lease_status as enum ('DRAFT', 'ACTIVE', 'MODIFIED', 'TERMINATED', 'EXPIRED');
create type modification_type as enum (
  'TERM_EXTENSION', 'TERM_REDUCTION', 'SCOPE_INCREASE', 'SCOPE_DECREASE',
  'RATE_CHANGE', 'PRICE_CHANGE', 'FULL_TERMINATION', 'PARTIAL_TERMINATION'
);
create type journal_entry_type as enum (
  'INITIAL_RECOGNITION', 'INTEREST_EXPENSE', 'DEPRECIATION', 'PAYMENT',
  'REMEASUREMENT', 'TERMINATION', 'SECURITY_DEPOSIT', 'SHORT_TERM_EXPENSE'
);
create type journal_status as enum ('DRAFT', 'POSTED', 'REVERSED');

-- ============================================================================
-- Core tenancy
-- ============================================================================
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cin text,
  gstin text,
  functional_currency text not null default 'INR',
  reporting_standard reporting_standard not null default 'IND_AS_116',
  fiscal_year_start_month int not null default 4 check (fiscal_year_start_month between 1 and 12),
  low_value_asset_threshold numeric(18,2) not null default 500000,
  short_term_threshold_months int not null default 12,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  full_name text,
  role user_role not null default 'VIEWER',
  created_at timestamptz not null default now()
);
create index profiles_org_id_idx on profiles(org_id);

-- Helper: current user's org id, used throughout RLS policies
create or replace function current_org_id()
returns uuid
language sql
security definer
stable
as $$
  select org_id from profiles where id = auth.uid()
$$;

-- Helper: current user's role
create or replace function current_user_role()
returns user_role
language sql
security definer
stable
as $$
  select role from profiles where id = auth.uid()
$$;

-- ============================================================================
-- Masters
-- ============================================================================
create table lessors (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  gstin text,
  pan text,
  address text,
  contact_name text,
  contact_email text,
  contact_phone text,
  bank_details jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index lessors_org_id_idx on lessors(org_id);

-- ============================================================================
-- Lease repository
-- ============================================================================
create table leases (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  lessor_id uuid not null references lessors(id),
  lease_code text not null,
  asset_name text not null,
  asset_category text not null default 'Other',
  location text,

  commencement_date date not null,
  lease_term_months int not null check (lease_term_months > 0),
  non_cancellable_period_months int not null,
  renewal_option_months int not null default 0,
  reasonably_certain_to_renew boolean not null default false,
  termination_option_months int not null default 0,
  reasonably_certain_to_terminate_early boolean not null default false,

  payment_frequency payment_frequency not null default 'MONTHLY',
  payment_timing payment_timing not null default 'ARREARS',
  base_payment_amount numeric(18,2) not null,
  escalation_type escalation_type not null default 'NONE',
  escalation_percent numeric(6,3) not null default 0,
  escalation_frequency_months int not null default 12,

  discount_rate_annual numeric(8,5) not null,
  currency text not null default 'INR',

  initial_direct_costs numeric(18,2) not null default 0,
  lease_incentives numeric(18,2) not null default 0,
  restoration_cost_estimate numeric(18,2) not null default 0,
  prepaid_rent numeric(18,2) not null default 0,

  is_short_term boolean not null default false,
  is_low_value boolean not null default false,

  useful_life_months int,

  gst_applicable boolean not null default false,
  gst_rate numeric(5,2) not null default 0,
  tds_applicable boolean not null default false,
  tds_rate numeric(5,2) not null default 0,

  status lease_status not null default 'DRAFT',
  notes text,

  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (org_id, lease_code)
);
create index leases_org_id_idx on leases(org_id);
create index leases_lessor_id_idx on leases(lessor_id);

-- Contractual cash flow lines (generated from the frequency/escalation params;
-- can be overridden per period for irregular schedules).
create table lease_payment_schedule (
  id uuid primary key default gen_random_uuid(),
  lease_id uuid not null references leases(id) on delete cascade,
  period_number int not null,
  due_date date not null,
  payment_amount numeric(18,2) not null,
  is_override boolean not null default false,
  created_at timestamptz not null default now(),
  unique (lease_id, period_number)
);
create index lease_payment_schedule_lease_id_idx on lease_payment_schedule(lease_id);

-- Modification / remeasurement events
create table lease_modifications (
  id uuid primary key default gen_random_uuid(),
  lease_id uuid not null references leases(id) on delete cascade,
  modification_date date not null,
  modification_type modification_type not null,
  description text,
  revised_discount_rate numeric(8,5),
  revised_term_months int,
  revised_payment_amount numeric(18,2),
  is_separate_lease boolean not null default false,
  liability_before numeric(18,2),
  liability_after numeric(18,2),
  rou_adjustment numeric(18,2),
  gain_loss_on_termination numeric(18,2),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index lease_modifications_lease_id_idx on lease_modifications(lease_id);

-- Computed: lease liability amortization schedule (effective interest method).
-- modification_id is null for the original schedule segment; a new segment is
-- inserted (with modification_id set) for periods after a remeasurement.
create table lease_liability_schedule (
  id uuid primary key default gen_random_uuid(),
  lease_id uuid not null references leases(id) on delete cascade,
  modification_id uuid references lease_modifications(id),
  period_number int not null,
  period_start date not null,
  period_end date not null,
  opening_liability numeric(18,2) not null,
  interest_expense numeric(18,2) not null,
  payment numeric(18,2) not null,
  closing_liability numeric(18,2) not null,
  created_at timestamptz not null default now()
);
create index lease_liability_schedule_lease_id_idx on lease_liability_schedule(lease_id);

-- Computed: ROU asset depreciation schedule.
create table rou_asset_schedule (
  id uuid primary key default gen_random_uuid(),
  lease_id uuid not null references leases(id) on delete cascade,
  modification_id uuid references lease_modifications(id),
  period_number int not null,
  period_start date not null,
  period_end date not null,
  opening_nbv numeric(18,2) not null,
  depreciation numeric(18,2) not null,
  impairment numeric(18,2) not null default 0,
  closing_nbv numeric(18,2) not null,
  created_at timestamptz not null default now()
);
create index rou_asset_schedule_lease_id_idx on rou_asset_schedule(lease_id);

-- ============================================================================
-- Security deposits
-- ============================================================================
create table security_deposits (
  id uuid primary key default gen_random_uuid(),
  lease_id uuid not null references leases(id) on delete cascade,
  deposit_amount numeric(18,2) not null,
  paid_date date not null,
  refundable boolean not null default true,
  expected_refund_date date not null,
  discount_rate_annual numeric(8,5) not null,
  present_value numeric(18,2) not null,
  prepaid_rent_component numeric(18,2) not null,
  created_at timestamptz not null default now()
);
create index security_deposits_lease_id_idx on security_deposits(lease_id);

create table security_deposit_schedule (
  id uuid primary key default gen_random_uuid(),
  security_deposit_id uuid not null references security_deposits(id) on delete cascade,
  period_number int not null,
  period_date date not null,
  opening_balance numeric(18,2) not null,
  interest_income numeric(18,2) not null,
  closing_balance numeric(18,2) not null
);
create index security_deposit_schedule_deposit_id_idx on security_deposit_schedule(security_deposit_id);

-- ============================================================================
-- Journals
-- ============================================================================
create table journal_entries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  lease_id uuid references leases(id) on delete cascade,
  entry_date date not null,
  entry_type journal_entry_type not null,
  narration text,
  status journal_status not null default 'DRAFT',
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index journal_entries_org_id_idx on journal_entries(org_id);
create index journal_entries_lease_id_idx on journal_entries(lease_id);

create table journal_lines (
  id uuid primary key default gen_random_uuid(),
  journal_entry_id uuid not null references journal_entries(id) on delete cascade,
  account_code text not null,
  account_name text not null,
  debit numeric(18,2) not null default 0,
  credit numeric(18,2) not null default 0,
  description text,
  check (debit = 0 or credit = 0)
);
create index journal_lines_entry_id_idx on journal_lines(journal_entry_id);

-- ============================================================================
-- Audit trail
-- ============================================================================
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid references profiles(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_org_id_idx on audit_log(org_id);
create index audit_log_entity_idx on audit_log(entity_type, entity_id);

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table organizations enable row level security;
alter table profiles enable row level security;
alter table lessors enable row level security;
alter table leases enable row level security;
alter table lease_payment_schedule enable row level security;
alter table lease_modifications enable row level security;
alter table lease_liability_schedule enable row level security;
alter table rou_asset_schedule enable row level security;
alter table security_deposits enable row level security;
alter table security_deposit_schedule enable row level security;
alter table journal_entries enable row level security;
alter table journal_lines enable row level security;
alter table audit_log enable row level security;

create policy org_isolation_select on organizations for select using (id = current_org_id());
create policy org_isolation_update on organizations for update using (id = current_org_id());

create policy profiles_same_org on profiles for select using (org_id = current_org_id());
create policy profiles_self_update on profiles for update using (id = auth.uid());

create policy lessors_isolation on lessors for all using (org_id = current_org_id()) with check (org_id = current_org_id());

create policy leases_isolation on leases for all using (org_id = current_org_id()) with check (org_id = current_org_id());

create policy lease_payment_schedule_isolation on lease_payment_schedule for all
  using (lease_id in (select id from leases where org_id = current_org_id()))
  with check (lease_id in (select id from leases where org_id = current_org_id()));

create policy lease_modifications_isolation on lease_modifications for all
  using (lease_id in (select id from leases where org_id = current_org_id()))
  with check (lease_id in (select id from leases where org_id = current_org_id()));

create policy lease_liability_schedule_isolation on lease_liability_schedule for all
  using (lease_id in (select id from leases where org_id = current_org_id()))
  with check (lease_id in (select id from leases where org_id = current_org_id()));

create policy rou_asset_schedule_isolation on rou_asset_schedule for all
  using (lease_id in (select id from leases where org_id = current_org_id()))
  with check (lease_id in (select id from leases where org_id = current_org_id()));

create policy security_deposits_isolation on security_deposits for all
  using (lease_id in (select id from leases where org_id = current_org_id()))
  with check (lease_id in (select id from leases where org_id = current_org_id()));

create policy security_deposit_schedule_isolation on security_deposit_schedule for all
  using (security_deposit_id in (
    select sd.id from security_deposits sd join leases l on l.id = sd.lease_id
    where l.org_id = current_org_id()
  ))
  with check (security_deposit_id in (
    select sd.id from security_deposits sd join leases l on l.id = sd.lease_id
    where l.org_id = current_org_id()
  ));

create policy journal_entries_isolation on journal_entries for all using (org_id = current_org_id()) with check (org_id = current_org_id());

create policy journal_lines_isolation on journal_lines for all
  using (journal_entry_id in (select id from journal_entries where org_id = current_org_id()))
  with check (journal_entry_id in (select id from journal_entries where org_id = current_org_id()));

create policy audit_log_isolation on audit_log for select using (org_id = current_org_id());
create policy audit_log_insert on audit_log for insert with check (org_id = current_org_id());

-- ============================================================================
-- updated_at triggers
-- ============================================================================
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger organizations_set_updated_at before update on organizations for each row execute function set_updated_at();
create trigger lessors_set_updated_at before update on lessors for each row execute function set_updated_at();
create trigger leases_set_updated_at before update on leases for each row execute function set_updated_at();

-- ============================================================================
-- Signup: creates an organization + its first ADMIN profile atomically.
-- Bypasses RLS (security definer) since no profile/org exists yet for the
-- new auth user. Called by the backend right after supabase auth signUp.
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
