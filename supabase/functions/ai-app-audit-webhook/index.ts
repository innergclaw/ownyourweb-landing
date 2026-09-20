const allowedMethods = "POST, OPTIONS";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function secretKey() {
  const modern = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (modern) {
    try { return JSON.parse(modern).default || ""; } catch { /* use legacy fallback */ }
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
}

function adminHeaders(extra: HeadersInit = {}) {
  const key = secretKey();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "apikey": key,
    ...Object.fromEntries(new Headers(extra).entries()),
  };
  if (key.startsWith("eyJ")) headers.Authorization = `Bearer ${key}`;
  return headers;
}

async function rest<T>(path: string, init: RequestInit = {}) {
  const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/${path}`, {
    ...init,
    headers: adminHeaders(init.headers),
  });
  const text = await response.text();
  let data: T | null = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  return { ok: response.ok, status: response.status, data, text };
}

function parseSignature(header: string) {
  const parts = header.split(",").map((part) => part.trim().split("="));
  const timestamp = parts.find(([key]) => key === "t")?.[1] || "";
  const signatures = parts.filter(([key]) => key === "v1").map(([, value]) => value);
  return { timestamp, signatures };
}

async function hmacHex(secret: string, content: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(content));
  return Array.from(new Uint8Array(signature)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return difference === 0;
}

async function validStripeSignature(payload: string, header: string, secret: string) {
  const { timestamp, signatures } = parseSignature(header);
  const timestampNumber = Number(timestamp);
  if (!timestamp || !Number.isFinite(timestampNumber)) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - timestampNumber) > 300) return false;
  const expected = await hmacHex(secret, `${timestamp}.${payload}`);
  return signatures.some((signature) => constantTimeEqual(signature, expected));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: { "Allow": allowedMethods } });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const webhookSecret = Deno.env.get("STRIPE_AUDIT_WEBHOOK_SECRET") || "";
  if (!webhookSecret || !secretKey() || !Deno.env.get("SUPABASE_URL")) return json({ error: "Webhook is not configured." }, 503);

  const rawBody = await req.text();
  const signature = req.headers.get("stripe-signature") || "";
  if (!(await validStripeSignature(rawBody, signature, webhookSecret))) return json({ error: "Invalid signature." }, 400);

  let event: Record<string, any>;
  try { event = JSON.parse(rawBody); } catch { return json({ error: "Invalid JSON." }, 400); }
  const eventId = String(event.id || "").slice(0, 255);
  const eventType = String(event.type || "").slice(0, 255);
  if (!eventId || !eventType) return json({ error: "Invalid Stripe event." }, 400);

  const previous = await rest<Array<{ id: number }>>(`ai_app_audit_events?provider_event_id=eq.${encodeURIComponent(eventId)}&select=id&limit=1`);
  if (previous.ok && previous.data?.length) return json({ received: true, duplicate: true });

  const session = event.data?.object || {};
  const auditId = String(session.metadata?.audit_id || session.client_reference_id || "").slice(0, 80);
  if (!auditId) return json({ received: true, ignored: true });

  if (["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(eventType)) {
    if (!["paid", "no_payment_required"].includes(session.payment_status)) {
      return json({ received: true, pending: true });
    }
    const update = await rest(`ai_app_audits?id=eq.${encodeURIComponent(auditId)}&stripe_checkout_session_id=eq.${encodeURIComponent(String(session.id || ""))}`, {
      method: "PATCH",
      headers: { "Prefer": "return=minimal" },
      body: JSON.stringify({
        status: "paid",
        payment_status: "paid",
        stripe_payment_intent_id: session.payment_intent || null,
        amount_cents: Number.isFinite(Number(session.amount_total)) ? Number(session.amount_total) : null,
        currency: typeof session.currency === "string" ? session.currency.slice(0, 3).toLowerCase() : null,
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
    });
    if (!update.ok) {
      console.error("Paid audit update failed", update.status, update.text);
      return json({ error: "Payment event could not be applied." }, 500);
    }
  }

  if (eventType === "checkout.session.expired") {
    await rest(`ai_app_audits?id=eq.${encodeURIComponent(auditId)}&payment_status=eq.pending`, {
      method: "PATCH",
      headers: { "Prefer": "return=minimal" },
      body: JSON.stringify({ status: "previewed", payment_status: "unpaid", updated_at: new Date().toISOString() }),
    });
  }

  const inserted = await rest("ai_app_audit_events", {
    method: "POST",
    headers: { "Prefer": "return=minimal" },
    body: JSON.stringify({
      audit_id: auditId,
      provider: "stripe",
      provider_event_id: eventId,
      event_type: eventType,
      payload: {
        livemode: Boolean(event.livemode),
        created: event.created || null,
        checkout_session_id: session.id || null,
        payment_status: session.payment_status || null,
      },
    }),
  });
  if (!inserted.ok && inserted.status !== 409) {
    console.error("Audit event log failed", inserted.status, inserted.text);
  }
  return json({ received: true });
});
