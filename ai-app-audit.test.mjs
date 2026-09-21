import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("./services/ai-app-audit/index.html", import.meta.url), "utf8");
const client = await readFile(new URL("./services/ai-app-audit/app.js", import.meta.url), "utf8");
const api = await readFile(new URL("./supabase/functions/ai-app-audit/index.ts", import.meta.url), "utf8");
const webhook = await readFile(new URL("./supabase/functions/ai-app-audit-webhook/index.ts", import.meta.url), "utf8");
const migration = await readFile(new URL("./supabase/migrations/20260920061222_create_ai_app_audits.sql", import.meta.url), "utf8");

assert.match(html, /id="audit-form"/);
assert.match(html, /id="results"[^>]*hidden/);
assert.match(html, /id="email-dialog"/);
assert.match(html, /id="customer-email"/);
assert.match(html, /id="email-submit"/);
assert.match(html, /No account or membership is required/);
assert.doesNotMatch(html, /member access/i);
assert.match(html, /id="file-readiness"/);
assert.match(html, /id="scan-button" disabled/);
assert.match(html, /id="access-meter"/);
assert.match(html, /email → \$9 payment → private report link/);
assert.match(html, /AI build receipt/i);
assert.match(html, />\$9</);
assert.doesNotMatch(html, /\$29/);
assert.match(client, /action, \.\.\.payload/);
assert.match(client, /ready for the strongest preview/);
assert.match(client, /resultTitle\.focus/);
assert.match(client, /visible_findings_count/);
assert.match(client, /waiting for Stripe to confirm payment/);
assert.match(client, /customer_email/);
assert.match(client, /get_report_by_delivery_token/);
assert.match(client, /delivery/);
assert.doesNotMatch(client, /signInWithOAuth|provider: "google"|list_reports|view=dashboard|receipt-library/i);
assert.doesNotMatch(client, /OPENAI_API_KEY|STRIPE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY/);

const previewHandler = api.slice(api.indexOf("async function preview"), api.indexOf("async function createCheckout"));
assert.match(api, /action === "preview"/);
assert.match(api, /action === "create_checkout"/);
assert.match(api, /action === "get_report_by_delivery_token"/);
assert.match(api, /delivery_token_hash/);
assert.match(api, /RESEND_API_KEY/);
assert.match(api, /api\.resend\.com/);
assert.match(api, /payment_status=eq\.paid/);
assert.match(api, /action === "process_paid"/);
assert.match(api, /internalRequestIsAuthorized/);
assert.match(api, /payment_status !== "paid"/);
assert.match(api, /AUDIT_ENGINE_NOT_CONFIGURED/);
assert.match(api, /type: "json_schema"/);
assert.match(api, /name: "ai_app_audit_report"/);
assert.doesNotMatch(api, /fallbackReport/);
assert.doesNotMatch(previewHandler, /aiReport|OPENAI_API_KEY|api\.openai\.com/);

assert.match(webhook, /stripe-signature/);
assert.match(webhook, /constantTimeEqual/);
assert.match(webhook, /checkout\.session\.completed/);
assert.match(webhook, /EdgeRuntime\.waitUntil\(triggerPaidAudit/);
assert.match(webhook, /action: "process_paid"/);

assert.match(migration, /enable row level security/);
assert.match(migration, /auth\.uid\(\)\) = user_id/);
assert.match(migration, /revoke all on table public\.ai_app_audits from anon/);

console.log("AI App Audit security smoke checks passed.");
