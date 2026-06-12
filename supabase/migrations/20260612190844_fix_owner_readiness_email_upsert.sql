drop index if exists public.owner_readiness_signups_email_unique_idx;

alter table public.owner_readiness_signups
  drop constraint if exists owner_readiness_signups_email_key;

alter table public.owner_readiness_signups
  add constraint owner_readiness_signups_email_key unique (email);
