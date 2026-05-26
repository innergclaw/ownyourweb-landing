create table if not exists public.client_projects (
  id bigint generated always as identity primary key,
  slug text not null unique,
  client_name text not null,
  client_email text not null,
  business_name text not null,
  project_title text not null,
  public_url text not null,
  status text not null default 'active',
  status_label text not null default 'Active Project',
  stage text not null default 'In Progress',
  package_name text,
  budget_range text,
  request_summary text,
  current_step text,
  notify_email boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.client_project_updates (
  id bigint generated always as identity primary key,
  project_slug text not null references public.client_projects(slug) on delete cascade,
  title text not null,
  body text not null,
  status_label text,
  created_by text not null default 'OwnYourWeb',
  email_sent_at timestamptz,
  email_status text not null default 'not_sent',
  created_at timestamptz not null default now(),
  unique (project_slug, title, body)
);

create table if not exists public.client_project_page_views (
  id bigint generated always as identity primary key,
  project_slug text not null references public.client_projects(slug) on delete cascade,
  viewed_at timestamptz not null default now(),
  user_agent text,
  referrer text,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.client_project_notification_log (
  id bigint generated always as identity primary key,
  project_slug text not null references public.client_projects(slug) on delete cascade,
  update_id bigint references public.client_project_updates(id) on delete set null,
  recipient_email text not null,
  provider text not null default 'resend',
  status text not null,
  response jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists client_projects_slug_idx
  on public.client_projects (slug);

create index if not exists client_project_updates_slug_created_idx
  on public.client_project_updates (project_slug, created_at desc);

create index if not exists client_project_page_views_slug_viewed_idx
  on public.client_project_page_views (project_slug, viewed_at desc);

alter table public.client_projects enable row level security;
alter table public.client_project_updates enable row level security;
alter table public.client_project_page_views enable row level security;
alter table public.client_project_notification_log enable row level security;

drop policy if exists "client projects private by default" on public.client_projects;
drop policy if exists "client project updates private by default" on public.client_project_updates;
drop policy if exists "client project page views private by default" on public.client_project_page_views;
drop policy if exists "client project notification log private by default" on public.client_project_notification_log;

create policy "client projects private by default"
  on public.client_projects
  for all
  using (false)
  with check (false);

create policy "client project updates private by default"
  on public.client_project_updates
  for all
  using (false)
  with check (false);

create policy "client project page views private by default"
  on public.client_project_page_views
  for all
  using (false)
  with check (false);

create policy "client project notification log private by default"
  on public.client_project_notification_log
  for all
  using (false)
  with check (false);

insert into public.client_projects (
  slug,
  client_name,
  client_email,
  business_name,
  project_title,
  public_url,
  status,
  status_label,
  stage,
  package_name,
  budget_range,
  request_summary,
  current_step,
  metadata
)
values
  (
    'brinx-entertainment-rush-logo-suite',
    'Jazmine Flamer',
    'Admin@brinxentertainment.com',
    'Brinx Entertainment',
    'Rush Logo Suite Package',
    'https://ownyourweb.xyz/demos/brinx-entertainment-rush-logo-suite.html',
    'complete',
    'Order Completed',
    'Final files sent',
    'Logo Suite Package + Rush Weekend Service',
    '$200',
    'Logo suite package completed for Brinx Entertainment. Option 01 was selected and approved.',
    'Complete, approved, and final files sent out.',
    '{"selected_option":"Option 01","source":"manual_client_tracker"}'::jsonb
  ),
  (
    'omni-global-solutions-logo-package',
    'Torrance',
    'darealtorr@icloud.com',
    'Omni Global Solutions LLC',
    'Name Your Price Logo Offer',
    'https://ownyourweb.xyz/demos/omni-global-solutions-logo-package.html',
    'active',
    'Direction Review',
    'Logo direction review',
    'Name Your Price Logo Offer',
    '$100 - $250',
    'Omni nice writing Global with the O being a globe.',
    'Confirm direction, then prepare first logo preview options.',
    '{"request_id":"2026-05-23T01-36-11-282Z-name-your-price-name-your-price-logo-offer-torrance","source":"ShopNasGraphics Name Your Price Form"}'::jsonb
  )
on conflict (slug) do update
set
  client_name = excluded.client_name,
  client_email = excluded.client_email,
  business_name = excluded.business_name,
  project_title = excluded.project_title,
  public_url = excluded.public_url,
  status = excluded.status,
  status_label = excluded.status_label,
  stage = excluded.stage,
  package_name = excluded.package_name,
  budget_range = excluded.budget_range,
  request_summary = excluded.request_summary,
  current_step = excluded.current_step,
  metadata = public.client_projects.metadata || excluded.metadata,
  updated_at = now();

insert into public.client_project_updates (
  project_slug,
  title,
  body,
  status_label,
  created_by,
  email_status
)
values
  (
    'brinx-entertainment-rush-logo-suite',
    'Final logo suite sent',
    'The Brinx Entertainment logo suite is complete, approved, and final files have been sent out.',
    'Order Completed',
    'ShopNasGraphics',
    'seed'
  ),
  (
    'omni-global-solutions-logo-package',
    'Client tracker created',
    'The Omni Global Solutions LLC tracker is active. The current step is direction review before first logo previews are prepared.',
    'Direction Review',
    'ShopNasGraphics',
    'seed'
  )
on conflict (project_slug, title, body) do nothing;
