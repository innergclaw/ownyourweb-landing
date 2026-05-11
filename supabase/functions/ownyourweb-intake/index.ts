type IntakePayload = {
  source_page?: string;
  customer_first_name?: string;
  customer_last_name?: string;
  customer_email?: string;
  business_name?: string;
  industry?: string;
  package?: string;
  budget_range?: string;
  timeline?: string;
  buyer_agent?: string;
  buyer_agent_or_contact?: string;
  current_website?: string;
  request?: string;
  assets?: string;
  website?: string;
  company?: string;
  email?: string;
  name?: string;
  _gotcha?: string;
};

type ProjectPacket = {
  request_id: string;
  created_at: string;
  status: string;
  payment_status: string;
  source_page: string;
  customer_first_name: string;
  customer_last_name: string;
  customer_email: string;
  business_name: string;
  industry: string;
  package: string;
  budget_range: string;
  timeline: string;
  buyer_agent_or_contact: string;
  current_website: string;
  request: string;
  assets_available: string;
  raw_payload: IntakePayload;
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
  return String(value ?? fallback).trim().slice(0, 2000);
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "ownyourweb-request";
}

function splitName(name: string) {
  const parts = clean(name).split(/\s+/).filter(Boolean);
  return {
    first: parts[0] || "",
    last: parts.slice(1).join(" "),
  };
}

function buildPacket(body: IntakePayload): ProjectPacket {
  const fallbackName = splitName(body.name || "");
  const businessName = clean(body.business_name || body.company || "OWNYOURWEB Website Request");
  const createdAt = new Date().toISOString();
  const requestId = `${createdAt.replace(/[:.]/g, "-")}-${slugify(businessName)}`;
  const customerEmail = clean(body.customer_email || body.email).toLowerCase();

  return {
    request_id: requestId,
    created_at: createdAt,
    status: "pending_owner_approval",
    payment_status: "pending_owner_approval",
    source_page: clean(body.source_page, "OWNYOURWEB Main Site"),
    customer_first_name: clean(body.customer_first_name || fallbackName.first),
    customer_last_name: clean(body.customer_last_name || fallbackName.last),
    customer_email: customerEmail,
    business_name: businessName,
    industry: clean(body.industry, "Website / Web System Inquiry"),
    package: clean(body.package, "Local Website System"),
    budget_range: clean(body.budget_range, "$1,500 - $3,000"),
    timeline: clean(body.timeline),
    buyer_agent_or_contact: clean(body.buyer_agent_or_contact || body.buyer_agent || customerEmail),
    current_website: clean(body.current_website || body.website),
    request: clean(body.request),
    assets_available: clean(body.assets),
    raw_payload: body,
  };
}

function customerName(packet: ProjectPacket) {
  return [packet.customer_first_name, packet.customer_last_name].filter(Boolean).join(" ").trim();
}

function adminActionUrl(packet: ProjectPacket, action: "accept" | "decline") {
  const params = new URLSearchParams({
    request_id: packet.request_id,
    action,
  });
  return `https://ownyourweb.xyz/agent-store/admin.html?${params.toString()}`;
}

async function savePacket(packet: ProjectPacket) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return { ok: false, status: "supabase_not_configured" };
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/project_requests`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": serviceRoleKey,
      "Authorization": `Bearer ${serviceRoleKey}`,
      "Prefer": "return=representation",
    },
    body: JSON.stringify(packet),
  });

  const text = await response.text();
  if (!response.ok) {
    return { ok: false, status: "database_insert_failed", error: text };
  }
  return { ok: true, status: "database_inserted" };
}

async function sendTelegram(packet: ProjectPacket) {
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const topicChatId = Deno.env.get("TELEGRAM_AGENT_STORE_TOPIC_CHAT_ID");
  const topicThreadId = Deno.env.get("TELEGRAM_AGENT_STORE_TOPIC_THREAD_ID");

  const destinations = [];
  if (topicChatId && topicThreadId) {
    destinations.push({ chatId: topicChatId, messageThreadId: topicThreadId });
  }

  if (!token || destinations.length === 0) {
    return { ok: false, status: "telegram_not_configured" };
  }

  const message = [
    "#AgentStoreRequests",
    "OWNYOURWEB Intake",
    "",
    `New project request: ${packet.business_name}`,
    `Industry: ${packet.industry || "Not provided"}`,
    `Package: ${packet.package || "Not provided"}`,
    `Budget: ${packet.budget_range || "Not provided"}`,
    `Timeline: ${packet.timeline || "Not provided"}`,
    `Customer: ${customerName(packet) || "Not provided"}`,
    `Email: ${packet.customer_email || "Not provided"}`,
    `Source: ${packet.source_page || "OWNYOURWEB"}`,
    `Current Website: ${packet.current_website || "Not provided"}`,
    "",
    "Request:",
    packet.request || "Not provided",
    "",
    `Request ID: ${packet.request_id}`,
  ].join("\n");

  const replyMarkup = {
    inline_keyboard: [
      [
        { text: "ACCEPT", url: adminActionUrl(packet, "accept") },
        { text: "DECLINE", url: adminActionUrl(packet, "decline") },
      ],
    ],
  };

  const results = [];
  for (const destination of destinations) {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: destination.chatId,
        ...(destination.messageThreadId ? { message_thread_id: Number(destination.messageThreadId) } : {}),
        text: message,
        disable_web_page_preview: true,
        reply_markup: replyMarkup,
      }),
    });
    const data = await response.json().catch(() => ({}));
    results.push({
      chat_id: destination.chatId,
      message_thread_id: destination.messageThreadId,
      ok: response.ok && data.ok,
      message_id: data?.result?.message_id || "",
      error: data?.description || "",
    });
  }

  const failed = results.filter((result) => !result.ok);
  return {
    ok: failed.length === 0,
    status: failed.length === 0 ? "telegram_sent" : failed.length === results.length ? "telegram_failed" : "telegram_partially_sent",
    results,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
  }

  let body: IntakePayload;
  try {
    body = await req.json();
  } catch (_error) {
    return jsonResponse({ ok: false, error: "Invalid JSON body" }, 400);
  }

  if (body._gotcha) {
    return jsonResponse({ ok: true, skipped: true });
  }

  const packet = buildPacket(body);
  if (!packet.customer_email || !packet.customer_email.includes("@")) {
    return jsonResponse({ ok: false, error: "A valid email is required" }, 400);
  }

  const database = await savePacket(packet);
  const telegram = await sendTelegram(packet);
  const intakeOk = Boolean(database.ok) && (telegram.ok || telegram.status === "telegram_partially_sent");

  return jsonResponse({
    ok: intakeOk,
    packet,
    database,
    telegram,
  }, intakeOk ? 200 : 502);
});
