-- Org-level discount-rate policy ("discount rate engine").
--   UNIFORM   -> one rate applied to every lease
--   PER_LEASE -> each lease carries its own rate
-- default_deposit_discount_rate lets security deposits be discounted at a
-- different rate from the lease liability.
alter table organizations add column if not exists discount_rate_mode text not null default 'PER_LEASE';
alter table organizations add column if not exists default_lease_discount_rate numeric(8,5) not null default 0.10;
alter table organizations add column if not exists default_deposit_discount_rate numeric(8,5) not null default 0.07;

do $$ begin
  alter table organizations add constraint discount_rate_mode_chk check (discount_rate_mode in ('UNIFORM', 'PER_LEASE'));
exception when duplicate_object then null; end $$;
