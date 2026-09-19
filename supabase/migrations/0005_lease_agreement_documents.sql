-- Store a reference to the uploaded lease agreement on each lease.
alter table leases add column if not exists agreement_path text;
alter table leases add column if not exists agreement_filename text;

-- Private bucket for lease agreement files. Access is mediated by the backend
-- using the service role after it verifies lease ownership, so no public
-- access and no anon storage policies are granted.
insert into storage.buckets (id, name, public)
values ('lease-documents', 'lease-documents', false)
on conflict (id) do nothing;
