import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("./services/ai-app-audit/index.html", import.meta.url), "utf8");
const client = await readFile(new URL("./services/ai-app-audit/app.js", import.meta.url), "utf8");
const api = await readFile(new URL("./supabase/functions/ai-app-audit/index.ts", import.meta.url), "utf8");
const webhook = await readFile(new URL("./supabase/functions/ai-app-audit-webhook/index.ts", import.meta.url), "utf8");
const migration = await readFile(new URL("./supabase/migrations/20260920061222_create_ai_app_audits.sql", import.meta.url), "utf8");

assert.match(html, /id="audit-form"/);
assert.match(html, /id="results" hidden/);
assert.match(html, /id="auth-dialog"/);
assert.match(client, /action, \.\.\.payload/);
assert.doesNotMatch(client, /OPENAI_API_KEY|STRIPE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY/);

assert.match(api, /action === "preview"/);
assert.match(api, /action === "create_checkout"/);
assert.match(api, /action === "get_report"/);
assert.match(api, /payment_status !== "paid"/);
assert.match(api, /user_id=eq\./);
assert.match(api, /text: \{ format: \{ type: "json_schema"/);

assert.match(webhook, /stripe-signature/);
assert.match(webhook, /constantTimeEqual/);
assert.match(webhook, /checkout\.session\.completed/);

assert.match(migration, /enable row level security/);
assert.match(migration, /auth\.uid\(\)\) = user_id/);
assert.match(migration, /revoke all on table public\.ai_app_audits from anon/);

console.log("AI App Audit security smoke checks passed.");
