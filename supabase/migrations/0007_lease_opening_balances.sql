-- Transition / opening balances for leases already running when brought into
-- the system (e.g. on first-time adoption). When is_transition is true the
-- engine starts the schedules from opening_date at the supplied opening
-- liability and ROU carrying amounts, using only the remaining payments.
alter table leases add column if not exists is_transition boolean not null default false;
alter table leases add column if not exists opening_date date;
alter table leases add column if not exists opening_liability numeric(18,2);
alter table leases add column if not exists opening_rou_nbv numeric(18,2);
