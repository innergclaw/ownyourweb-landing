create table if not exists public.ai_app_audits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  project_name text not null check (char_length(project_name) between 1 and 80),
  status text not null default 'previewed'
    check (status in ('previewed', 'checkout_created', 'paid', 'processing', 'complete', 'failed', 'refunded')),
  payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid', 'pending', 'paid', 'refunded', 'disputed')),
  preview_secret_hash text not null,
  source_manifest jsonb not null default '{}'::jsonb,
  source_lockfile jsonb,
  source_lockfile_name text,
  preview jsonb not null default '{}'::jsonb,
  deterministic_findings jsonb not null default '[]'::jsonb,
  full_report jsonb,
  report_version text,
  ai_model text,
  ai_response_id text,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  amount_cents integer check (amount_cents is null or amount_cents >= 0),
  currency text check (currency is null or currency ~ '^[a-z]{3}$'),
  paid_at timestamptz,
  completed_at timestamptz,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_app_audit_events (
  id bigint generated always as identity primary key,
  audit_id uuid references public.ai_app_audits(id) on delete cascade,
  provider text not null default 'stripe',
  provider_event_id text not null unique,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_app_audits_user_created_idx
  on public.ai_app_audits (user_id, created_at desc);

create index if not exists ai_app_audits_status_idx
  on public.ai_app_audits (status, created_at desc);

create index if not exists ai_app_audit_events_audit_idx
  on public.ai_app_audit_events (audit_id, created_at desc);

alter table public.ai_app_audits enable row level security;
alter table public.ai_app_audit_events enable row level security;

drop policy if exists "users read their own ai app audits" on public.ai_app_audits;
create policy "users read their own ai app audits"
  on public.ai_app_audits
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.ai_app_audits from anon;
revoke all on table public.ai_app_audit_events from anon, authenticated;
grant select on table public.ai_app_audits to authenticated;

comment on table public.ai_app_audits is
  'Private manifest-first security audits. Writes occur only through the server-side Edge Function.';

comment on column public.ai_app_audits.preview_secret_hash is
  'SHA-256 hash of the one-time browser token used to attach an anonymous preview to an authenticated owner.';
