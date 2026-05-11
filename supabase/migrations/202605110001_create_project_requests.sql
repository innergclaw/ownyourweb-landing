create table if not exists public.project_requests (
  id bigint generated always as identity primary key,
  request_id text not null unique,
  created_at timestamptz not null default now(),
  status text not null default 'pending_owner_approval',
  payment_status text not null default 'pending_owner_approval',
  source_page text,
  customer_first_name text,
  customer_last_name text,
  customer_email text,
  business_name text,
  industry text,
  package text,
  budget_range text,
  timeline text,
  buyer_agent_or_contact text,
  current_website text,
  request text,
  assets_available text,
  raw_payload jsonb not null default '{}'::jsonb
);

create index if not exists project_requests_created_at_idx
  on public.project_requests (created_at desc);

create index if not exists project_requests_status_idx
  on public.project_requests (status);

alter table public.project_requests enable row level security;

drop policy if exists "project requests private by default" on public.project_requests;

create policy "project requests private by default"
  on public.project_requests
  for all
  using (false)
  with check (false);
