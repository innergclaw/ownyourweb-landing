type ProjectRecord = {
  slug: string;
  client_name: string;
  client_email: string;
  business_name: string;
  project_title: string;
  public_url: string;
  status: string;
  status_label: string;
  stage: string;
  package_name: string;
  budget_range: string;
  request_summary: string;
  current_step: string;
  notify_email: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type UpdateRecord = {
  id: number;
  project_slug: string;
  title: string;
  body: string;
  status_label: string;
  created_by: string;
  email_sent_at: string | null;
  email_status: string;
  created_at: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("CORS_ALLOW_ORIGIN") || "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-ownyourweb-admin-key",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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

function clean(value: unknown, max = 4000) {
  return String(value ?? "").trim().slice(0, max);
}

function escapeHtml(value: unknown) {
  return clean(value, 10000)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function dbHeaders() {
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  return {
    "Content-Type": "application/json",
    "apikey": serviceRoleKey,
    "Authorization": `Bearer ${serviceRoleKey}`,
  };
}

function supabaseUrl() {
  return Deno.env.get("SUPABASE_URL") || "";
}

async function rest<T>(path: string, init: RequestInit = {}): Promise<{ ok: boolean; status: number; data: T | null; text: string }> {
  const response = await fetch(`${supabaseUrl()}/rest/v1/${path}`, {
    ...init,
    headers: {
      ...dbHeaders(),
      ...(init.headers || {}),
    },
  });
  const text = await response.text();
  let data: T | null = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (_error) {
    data = null;
  }
  return { ok: response.ok, status: response.status, data, text };
}

function isAdminRequest(req: Request) {
  const configured = clean(Deno.env.get("CLIENT_PROJECT_ADMIN_KEY"));
  if (!configured) return false;
  const header = clean(req.headers.get("x-ownyourweb-admin-key"));
  const bearer = clean(req.headers.get("authorization")).replace(/^Bearer\s+/i, "");
  return header === configured || bearer === configured;
}

async function getProject(slug: string) {
  const projectResult = await rest<ProjectRecord[]>(
    `client_projects?slug=eq.${encodeURIComponent(slug)}&select=*&limit=1`
  );
  if (!projectResult.ok) {
    return { ok: false, status: projectResult.status, error: projectResult.text };
  }
  const project = projectResult.data?.[0];
  if (!project) return { ok: false, status: 404, error: "Project not found" };

  const updatesResult = await rest<UpdateRecord[]>(
    `client_project_updates?project_slug=eq.${encodeURIComponent(slug)}&select=*&order=created_at.desc&limit=25`
  );
  if (!updatesResult.ok) {
    return { ok: false, status: updatesResult.status, error: updatesResult.text };
  }

  return { ok: true, project, updates: updatesResult.data || [] };
}

async function recordView(req: Request, slug: string) {
  await rest("client_project_page_views", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      project_slug: slug,
      user_agent: clean(req.headers.get("user-agent"), 1000),
      referrer: clean(req.headers.get("referer"), 1000),
      metadata: {
        source: "client_project_page",
      },
    }),
  }).catch(() => null);
}

async function sendEmail(project: ProjectRecord, update: UpdateRecord) {
  if (!project.notify_email || !project.client_email) {
    return { sent: false, status: "skipped" };
  }

  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("CLIENT_PROJECT_EMAIL_FROM") || "OwnYourWeb <updates@ownyourweb.xyz>";
  const replyTo = Deno.env.get("CLIENT_PROJECT_EMAIL_REPLY_TO") || "nasirr@shopnasgfx.co";

  if (!apiKey) {
    return { sent: false, status: "resend_not_configured" };
  }

  const subject = `${project.business_name} project update: ${update.title}`;
  const safeBusinessName = escapeHtml(project.business_name);
  const safeTitle = escapeHtml(update.title);
  const safeBody = escapeHtml(update.body).replace(/\n/g, "<br>");
  const safeStatus = escapeHtml(update.status_label || project.status_label);
  const safeUrl = escapeHtml(project.public_url);
  const html = `
    <div style="font-family:Arial,sans-serif;color:#101014;line-height:1.55">
      <h2 style="margin:0 0 12px">${safeBusinessName} Project Update</h2>
      <p><strong>${safeTitle}</strong></p>
      <p>${safeBody}</p>
      <p><strong>Status:</strong> ${safeStatus}</p>
      <p><a href="${safeUrl}">Open your live project tracker</a></p>
    </div>
  `;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from,
      to: [project.client_email],
      reply_to: replyTo,
      subject,
      html,
    }),
  });

  const data = await response.json().catch(() => ({}));
  await rest("client_project_notification_log", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      project_slug: project.slug,
      update_id: update.id,
      recipient_email: project.client_email,
      provider: "resend",
      status: response.ok ? "sent" : "failed",
      response: data,
    }),
  }).catch(() => null);

  return { sent: response.ok, status: response.ok ? "sent" : "failed", response: data };
}

async function createUpdate(req: Request) {
  if (!isAdminRequest(req)) {
    return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
  }

  const body = await req.json().catch(() => ({}));
  const slug = clean(body.slug, 160);
  const title = clean(body.title, 200);
  const updateBody = clean(body.body, 8000);
  const statusLabel = clean(body.status_label || body.statusLabel, 200);
  const status = clean(body.status, 120);
  const stage = clean(body.stage, 200);
  const currentStep = clean(body.current_step || body.currentStep, 1000);

  if (!slug || !title || !updateBody) {
    return jsonResponse({ ok: false, error: "slug, title, and body are required" }, 400);
  }

  const loaded = await getProject(slug);
  if (!loaded.ok) {
    return jsonResponse({ ok: false, error: loaded.error }, loaded.status || 500);
  }
  const project = loaded.project as ProjectRecord;

  const insertResult = await rest<UpdateRecord[]>("client_project_updates", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      project_slug: slug,
      title,
      body: updateBody,
      status_label: statusLabel || project.status_label,
      created_by: clean(body.created_by || body.createdBy || "ShopNasGraphics", 120),
      email_status: "pending",
    }),
  });
  if (!insertResult.ok || !insertResult.data?.[0]) {
    return jsonResponse({ ok: false, error: insertResult.text || "Update insert failed" }, insertResult.status || 500);
  }

  const update = insertResult.data[0];
  const projectPatch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (status) projectPatch.status = status;
  if (stage) projectPatch.stage = stage;
  if (statusLabel) projectPatch.status_label = statusLabel;
  if (currentStep) projectPatch.current_step = currentStep;

  await rest(`client_projects?slug=eq.${encodeURIComponent(slug)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(projectPatch),
  });

  const email = await sendEmail({ ...project, ...projectPatch } as ProjectRecord, update);
  await rest(`client_project_updates?id=eq.${update.id}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      email_status: email.status,
      email_sent_at: email.sent ? new Date().toISOString() : null,
    }),
  });

  return jsonResponse({ ok: true, update, email });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (!supabaseUrl() || !Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
    return jsonResponse({ ok: false, error: "Supabase environment is not configured" }, 500);
  }

  if (req.method === "POST") {
    return createUpdate(req);
  }

  if (req.method !== "GET") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
  }

  const url = new URL(req.url);
  const slug = clean(url.searchParams.get("slug"), 160);
  if (!slug) {
    return jsonResponse({ ok: false, error: "Missing slug" }, 400);
  }

  const loaded = await getProject(slug);
  if (!loaded.ok) {
    return jsonResponse({ ok: false, error: loaded.error }, loaded.status || 500);
  }

  if (url.searchParams.get("view") === "1") {
    await recordView(req, slug);
  }

  return jsonResponse({
    ok: true,
    project: loaded.project,
    updates: loaded.updates,
    refreshed_at: new Date().toISOString(),
  });
});
