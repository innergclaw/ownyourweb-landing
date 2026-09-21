# OWNYOURWEB AI App Audit

Manifest-first AI build receipt for AI-built applications. The product shows what the project declares directly, what arrived through those packages, what can execute, and what deserves review.

## Product lane

The service is an AI build provenance report, presented to customers as an **AI Build Receipt**. It does not compete as a broad vulnerability scanner. It explains the dependency trail an AI-built app leaves behind:

- packages declared directly by the project
- packages inherited through those direct choices
- install-time execution paths
- verified and possible reach
- evidence that requires human review

Manifest data cannot prove whether the user or an AI agent chose a package. The report states that boundary instead of inventing authorship.

## Public route

`/services/ai-app-audit/`

The GitHub Pages client accepts:

- `package.json`
- `package-lock.json`
- `npm-shrinkwrap.json`

The free preview uploads only dependency metadata to the Edge Function. It does not ask for source code, `.env` files, API keys, or passwords.

## Security boundary

```text
GitHub Pages UI
  -> public preview request
  -> Supabase Edge Function
  -> private audit row
  -> guest email + Stripe Checkout
  -> signed Stripe webhook
  -> paid audit entitlement
  -> background deterministic + AI report job
  -> private saved report
  -> signed private report link by email
```

The free preview is deterministic. It does not call OpenAI. The frontend receives up to three preview findings, a count of locked analysis areas, framework and runtime signals, and package metrics. The private prompt, complete evidence, paid findings, Stripe key, Supabase secret key, and OpenAI key remain server-side.

The v1 entitlement is the paid state on one audit row. A separate credits table is intentionally deferred until builder or agency demand makes reusable credits necessary.

## Guest email delivery

The free preview does not require an account. Before checkout, the customer enters an email address. Stripe uses that address for the one-time $9 payment. After the signed webhook confirms payment and the AI report is complete, the service sends one private report link to that address.

The delivery link contains a signed token. The raw token is never stored in the database. The report endpoint checks the token and the paid state on the server before it returns the report. No Google sign-in, membership, or client dashboard is part of this purchase path.

Checkout stays closed unless Stripe and the paid AI engine are both configured. A paid audit never silently falls back to a reduced report. If the AI job fails, the audit moves to `failed`, the payment record remains saved, and support can resolve the paid order.

## Two-scan state machine

```text
previewed
  -> checkout_created
  -> paid
  -> processing
  -> complete
```

The Stripe webhook is the only payment authority. After it verifies Stripe's signature and confirms `payment_status=paid`, it marks the audit as paid and starts the full report job with `EdgeRuntime.waitUntil`.

The private report route polls the saved state. It can claim a paid audit if the background trigger has not started it, but it cannot start an unpaid audit. A browser-side paywall is never treated as authorization.

## Database

Migration:

`supabase/migrations/20260920061222_create_ai_app_audits.sql`

Tables:

- `ai_app_audits`
- `ai_app_audit_events`

RLS is enabled. Browser clients receive no insert, update, or select grants. All reads and writes pass through the Edge Function, which checks the signed delivery token before returning a paid report.

Public previews are limited to 12 requests per server-salted request fingerprint per hour. Raw IP addresses are not stored.

## Edge Functions

- `ai-app-audit`: preview, checkout creation, paid processing, and signed report retrieval
- `ai-app-audit-webhook`: signed Stripe entitlement updates and paid-job trigger

Both functions use `verify_jwt = false` because the preview is public and Stripe webhooks do not carry Supabase user JWTs. The main function validates user access tokens inside authenticated actions. The webhook validates the raw Stripe signature before changing payment state.

## Required production secrets

Set these through Supabase Edge Function secrets. Do not commit them.

```text
STRIPE_SECRET_KEY
STRIPE_AUDIT_PRICE_ID
STRIPE_AUDIT_WEBHOOK_SECRET
OPENAI_API_KEY
OPENAI_MODEL
RESEND_API_KEY
AI_AUDIT_FROM_EMAIL
```

Optional configuration:

```text
STRIPE_API_VERSION=2026-02-25.clover
AI_AUDIT_SITE_URL=https://ownyourweb.xyz/services/ai-app-audit
AI_AUDIT_ALLOWED_ORIGINS=https://ownyourweb.xyz,https://www.ownyourweb.xyz,https://innergclaw.github.io
```

`OPENAI_MODEL` must name a model available to the connected OpenAI project that supports Structured Outputs in the Responses API.

## Stripe setup

1. Create a one-time $9 product/price in Stripe.
2. Store its `price_...` ID as `STRIPE_AUDIT_PRICE_ID`.
3. Add a webhook endpoint:

   `https://zkyhhoxcrjkhywblzehr.supabase.co/functions/v1/ai-app-audit-webhook`

4. Subscribe to:

   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `checkout.session.expired`

5. Store the endpoint signing secret as `STRIPE_AUDIT_WEBHOOK_SECRET`.

## Current v1 evidence boundary

Verified by the deterministic scanner:

- direct dependency count
- transitive dependency count from supported npm lockfiles
- lockfile presence and version
- exact versus ranged direct declarations
- root install lifecycle scripts
- lockfile `hasInstallScript` flags
- git, URL, file, link, and workspace dependency sources
- framework signal from declared direct dependencies
- runtime signal from `engines` or `packageManager`
- current npm registry release date and maintainer count for up to 40 direct packages in a paid report

Not claimed without further evidence:

- malicious intent
- confirmed package abandonment
- runtime network calls
- actual secret access
- source-code vulnerabilities
- exploitability

## Launch verification

Before accepting live payments:

1. Run a preview with the safe sample.
2. Run a preview with a real npm project containing a lockfile.
3. Confirm anonymous users cannot read `ai_app_audits` through the Data API.
4. Confirm one signed-in user cannot retrieve another user's report.
5. Complete a Stripe test-mode purchase with the email entered on the audit page.
6. Confirm the signed webhook changes the audit to `paid`.
7. Confirm the webhook moves the audit from `paid` to `processing` without a browser report request.
8. Confirm the background job generates and stores one report.
9. Confirm the report email arrives and its private link opens the report.
10. Confirm a changed or incomplete delivery token returns `403`.
11. Confirm later requests return the stored report without another AI call.
12. Review Supabase security and performance advisors.
13. Repeat the full flow in Stripe live mode before announcing access.
