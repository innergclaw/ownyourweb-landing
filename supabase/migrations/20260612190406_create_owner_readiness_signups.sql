create table if not exists public.owner_readiness_signups (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  email text not null,
  source_page text not null default 'ownyourweb.xyz/free-owner-stack.html',
  campaign text not null default 'become_an_owner_2026',
  resource text not null default 'free_owner_readiness_stack',
  user_agent text,
  referrer text,
  raw_payload jsonb not null default '{}'::jsonb,
  constraint owner_readiness_signups_email_format_chk
    check (email ~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$')
);

create unique index if not exists owner_readiness_signups_email_unique_idx
  on public.owner_readiness_signups (lower(email));

create index if not exists owner_readiness_signups_created_at_idx
  on public.owner_readiness_signups (created_at desc);

alter table public.owner_readiness_signups enable row level security;

drop policy if exists "owner readiness signups private by default"
  on public.owner_readiness_signups;

create policy "owner readiness signups private by default"
  on public.owner_readiness_signups
  for all
  using (false)
  with check (false);

revoke all on table public.owner_readiness_signups from anon, authenticated;
