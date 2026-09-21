alter table public.ai_app_audits
  add column if not exists customer_email text,
  add column if not exists delivery_token_hash text,
  add column if not exists delivery_sent_at timestamptz;

create index if not exists ai_app_audits_customer_email_idx
  on public.ai_app_audits (customer_email, created_at desc);

comment on column public.ai_app_audits.customer_email is
  'Customer email supplied for guest checkout and private report delivery.';

comment on column public.ai_app_audits.delivery_token_hash is
  'Hash of the signed guest delivery token. The raw token is only sent in the report email.';
