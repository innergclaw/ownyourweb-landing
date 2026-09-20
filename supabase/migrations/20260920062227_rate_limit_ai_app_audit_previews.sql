alter table public.ai_app_audits
  add column if not exists request_fingerprint text;

create index if not exists ai_app_audits_preview_rate_idx
  on public.ai_app_audits (request_fingerprint, created_at desc)
  where request_fingerprint is not null;

comment on column public.ai_app_audits.request_fingerprint is
  'One-way server-salted request fingerprint used only for preview rate limiting. Raw IP addresses are not stored.';
