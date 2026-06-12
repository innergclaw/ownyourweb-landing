type SignupPayload = {
  email?: string;
  source_page?: string;
  campaign?: string;
  resource?: string;
  referrer?: string;
  _gotcha?: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("CORS_ALLOW_ORIGIN") || "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function clean(value: unknown, fallback = "") {
  return String(value ?? fallback).trim().slice(0, 500);
}

function cleanEmail(value: unknown) {
  return clean(value).toLowerCase();
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function saveSignup(payload: SignupPayload, req: Request) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return { ok: false, status: "supabase_not_configured" };
  }

  const record = {
    email: cleanEmail(payload.email),
    source_page: clean(payload.source_page, "ownyourweb.xyz/free-owner-stack.html"),
    campaign: clean(payload.campaign, "become_an_owner_2026"),
    resource: clean(payload.resource, "free_owner_readiness_stack"),
    user_agent: clean(req.headers.get("user-agent")),
    referrer: clean(payload.referrer || req.headers.get("referer")),
    raw_payload: payload,
  };

  const response = await fetch(
    `${supabaseUrl}/rest/v1/owner_readiness_signups?on_conflict=email`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": serviceRoleKey,
        "Authorization": `Bearer ${serviceRoleKey}`,
        "Prefer": "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify(record),
    },
  );

  const text = await response.text();
  if (!response.ok) {
    return { ok: false, status: "database_insert_failed", error: text };
  }

  return {
    ok: true,
    status: "database_inserted",
    record: JSON.parse(text || "[]")[0] || null,
  };
}

async function sendTelegram(payload: SignupPayload) {
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const chatId = Deno.env.get("TELEGRAM_AGENT_STORE_TOPIC_CHAT_ID");
  const messageThreadId = Deno.env.get("TELEGRAM_AGENT_STORE_TOPIC_THREAD_ID");

  if (!token || !chatId) {
    return { ok: false, status: "telegram_not_configured" };
  }

  const message = [
    "#BecomeAnOwner",
    "New Free Owner Stack signup",
    "",
    `Email: ${cleanEmail(payload.email)}`,
    `Campaign: ${clean(payload.campaign, "become_an_owner_2026")}`,
    `Source: ${clean(payload.source_page, "ownyourweb.xyz/free-owner-stack.html")}`,
  ].join("\n");

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      ...(messageThreadId ? { message_thread_id: Number(messageThreadId) } : {}),
      text: message,
      disable_web_page_preview: true,
    }),
  });

  const data = await response.json().catch(() => ({}));
  return {
    ok: response.ok && data.ok,
    status: response.ok && data.ok ? "telegram_sent" : "telegram_failed",
    error: data?.description || "",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
  }

  let body: SignupPayload;
  try {
    body = await req.json();
  } catch (_error) {
    return jsonResponse({ ok: false, error: "Invalid JSON body" }, 400);
  }

  if (body._gotcha) {
    return jsonResponse({ ok: true, skipped: true });
  }

  const email = cleanEmail(body.email);
  if (!isValidEmail(email)) {
    return jsonResponse({ ok: false, error: "A valid email is required" }, 400);
  }

  const normalized = { ...body, email };
  const database = await saveSignup(normalized, req);
  const telegram = await sendTelegram(normalized);
  const ok = Boolean(database.ok);

  return jsonResponse({ ok, database, telegram }, ok ? 200 : 502);
});
