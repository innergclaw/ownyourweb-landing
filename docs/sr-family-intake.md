# SR Family Intake Supabase Setup

SR Sensory Gym uses a dedicated Edge Function and private database table for family submissions.

## Public Pages

- Waiver page: `https://ownyourweb.xyz/demos/strength-resilience-waiver.html`
- Book Now page: `https://ownyourweb.xyz/demos/strength-resilience-book-now.html#book-request`
- Party booking page: `https://ownyourweb.xyz/demos/strength-resilience-book-a-party.html#party-request`
- Home contact form: `https://ownyourweb.xyz/demos/strength-resilience-children-lounge.html#connect`
- Newsletter popup: appears on the homepage after five seconds.

## Submission Types

- `waiver`: general liability waiver form.
- `open_play_booking`: Book Now form for open play, daily pass, and summer open play requests.
- `party_booking`: Book A Party form for birthday packages.
- `general_inquiry`: homepage contact form.
- `newsletter_signup`: email-only signup from the delayed homepage popup.

## Backend Files

- Migration: `supabase/migrations/20260604143000_create_sr_family_intake_submissions.sql`
- Edge Function: `supabase/functions/sr-family-intake/index.ts`
- Browser handler: `demos/assets/strength-resilience/sr-family-intake.js`

## Live Endpoint

The static site points to:

```text
https://zkyhhoxcrjkhywblzehr.supabase.co/functions/v1/sr-family-intake
```

## Required Secrets

```bash
RESEND_API_KEY=...
SR_INTAKE_EMAIL_TO=info@srchildrenslounge.com
SR_INTAKE_EMAIL_FROM="SR Sensory Gym <updates@ownyourweb.xyz>"
CORS_ALLOW_ORIGIN=https://ownyourweb.xyz
```

Supabase provides these automatically:

```bash
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

## Deployment Notes

The table is private by default with RLS enabled. The browser never receives the service role key. Public forms submit to the Edge Function, and the Edge Function validates the payload, saves it to `public.sr_family_intake_submissions`, and sends the notification email through Resend.

Deploy with JWT verification disabled because this is a public family form. The function itself validates the submitted fields and keeps the table private.
