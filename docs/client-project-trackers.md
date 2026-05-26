# OWNYOURWEB Client Project Trackers

The live client tracker pages use Supabase as the source of truth for project status and update history.

Current client tracker pages:

- Brinx Entertainment: `https://ownyourweb.xyz/demos/brinx-entertainment-rush-logo-suite.html`
- Omni Global Solutions LLC: `https://ownyourweb.xyz/demos/omni-global-solutions-logo-package.html`

## Flow

1. Client opens their tracker URL.
2. The page loads its static fallback content immediately.
3. `demos/client-project-live.js` calls the public Edge Function:
   `https://zkyhhoxcrjkhywblzehr.supabase.co/functions/v1/ownyourweb-client-projects?slug=...`
4. The Edge Function reads `client_projects` and `client_project_updates` with the service role key.
5. The page renders the latest status/current step/updates and refreshes every 30 seconds.
6. The Edge Function records page views in `client_project_page_views`.
7. When an admin posts a new update through the Edge Function, it stores the update and sends a client email through Resend when configured.

## Database

Run the migration:

```bash
supabase/migrations/20260526203742_create_client_project_trackers.sql
```

The tables are:

- `public.client_projects`
- `public.client_project_updates`
- `public.client_project_page_views`
- `public.client_project_notification_log`

All tables have RLS enabled and are private by default. Public client pages do not read the tables directly; they read through the Edge Function.

## Edge Function

Function path:

```bash
supabase/functions/ownyourweb-client-projects/index.ts
```

Deploy with JWT verification disabled:

```bash
supabase functions deploy ownyourweb-client-projects --no-verify-jwt
```

If using `supabase/config.toml`, add:

```toml
[functions.ownyourweb-client-projects]
verify_jwt = false
```

## Required Secrets

Supabase provides:

```bash
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

Set this secret for admin-only update posting:

```bash
CLIENT_PROJECT_ADMIN_KEY=choose_a_long_random_value
```

For email notifications, set:

```bash
RESEND_API_KEY=...
CLIENT_PROJECT_EMAIL_FROM="OwnYourWeb <updates@ownyourweb.xyz>"
CLIENT_PROJECT_EMAIL_REPLY_TO="nasirr@shopnasgfx.co"
CORS_ALLOW_ORIGIN=https://ownyourweb.xyz
```

If `RESEND_API_KEY` is not configured, updates still save to Supabase but email status is recorded as `resend_not_configured`.

## Add A Project Update

```bash
curl -X POST "https://zkyhhoxcrjkhywblzehr.supabase.co/functions/v1/ownyourweb-client-projects" \
  -H "Content-Type: application/json" \
  -H "x-ownyourweb-admin-key: $CLIENT_PROJECT_ADMIN_KEY" \
  -d '{
    "slug": "omni-global-solutions-logo-package",
    "title": "First preview direction added",
    "body": "Initial logo preview direction has been added for review.",
    "status_label": "Preview Delivery",
    "stage": "Initial previews",
    "current_step": "Review first logo previews and send feedback."
  }'
```

## Test Public Read

```bash
curl "https://zkyhhoxcrjkhywblzehr.supabase.co/functions/v1/ownyourweb-client-projects?slug=brinx-entertainment-rush-logo-suite"
```
