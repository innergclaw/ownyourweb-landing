create table if not exists public.sr_family_intake_submissions (
  id bigint generated always as identity primary key,
  intake_id text not null unique,
  intake_type text not null,
  status text not null default 'new',
  parent_guardian_name text not null,
  child_names text,
  child_ages text,
  phone text,
  email text not null,
  emergency_contact_name text,
  emergency_contact_relationship text,
  emergency_contact_phone text,
  requested_service text,
  preferred_date text,
  preferred_time text,
  party_package text,
  guest_count text,
  membership_interest text,
  message text,
  health_notes text,
  photo_video_consent boolean,
  assumption_of_risk boolean not null default false,
  parent_supervision boolean not null default false,
  release_of_liability boolean not null default false,
  medical_authorization boolean not null default false,
  health_safety_acknowledgment boolean not null default false,
  facility_rules_agreement boolean not null default false,
  electronic_signature text,
  signed_at timestamptz,
  waiver_version text,
  source_page text,
  user_agent text,
  referrer text,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists sr_family_intake_created_at_idx
  on public.sr_family_intake_submissions (created_at desc);

create index if not exists sr_family_intake_type_idx
  on public.sr_family_intake_submissions (intake_type);

create index if not exists sr_family_intake_email_idx
  on public.sr_family_intake_submissions (email);

alter table public.sr_family_intake_submissions enable row level security;

drop policy if exists "sr family intake private by default" on public.sr_family_intake_submissions;

create policy "sr family intake private by default"
  on public.sr_family_intake_submissions
  for all
  using (false)
  with check (false);
