# OWNYOURWEB Supabase Intake

Supabase is the official backend lane for OWNYOURWEB project requests.
The live static site can stay on GitHub Pages while the form posts to a Supabase Edge Function.

## Flow

1. Visitor submits the form on `ownyourweb.xyz`.
2. The form posts JSON to the `ownyourweb-intake` Edge Function.
3. The function validates the payload.
4. The packet is saved to `public.project_requests`.
5. Telegram notifications are sent to the configured channel/group/topic.
6. Later, Stripe approval/payment creation can be added to this same function or a second admin function.

## Required Supabase Secrets

Set these in Supabase Edge Function secrets:

```bash
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_IDS=-100..., -100...
TELEGRAM_AGENT_STORE_TOPIC_CHAT_ID=-100...
TELEGRAM_AGENT_STORE_TOPIC_THREAD_ID=3
CORS_ALLOW_ORIGIN=https://ownyourweb.xyz
```

Supabase provides these automatically:

```bash
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

## Deploy Steps

1. Create a Supabase project.
2. Run the SQL in `supabase/migrations/202605110001_create_project_requests.sql`.
3. Deploy `supabase/functions/ownyourweb-intake/index.ts` with JWT verification disabled.
4. Set the secrets listed above.
5. Update `api-config.js`:

```js
window.OWNYOURWEB_INTAKE_ENDPOINT = "https://PROJECT_REF.supabase.co/functions/v1/ownyourweb-intake";
```

## Test

```bash
curl -X POST "https://PROJECT_REF.supabase.co/functions/v1/ownyourweb-intake" \
  -H "Content-Type: application/json" \
  -d '{
    "source_page": "OWNYOURWEB Main Site",
    "customer_first_name": "Test",
    "customer_last_name": "Lead",
    "customer_email": "test@example.com",
    "business_name": "Test Business",
    "industry": "Website / Web System Inquiry",
    "request": "Testing Supabase intake to Telegram."
  }'
```
