type IntakePayload = {
  intake_type?: string;
  parent_guardian_name?: string;
  first_name?: string;
  last_name?: string;
  child_names?: string;
  child_ages?: string;
  phone?: string;
  email?: string;
  emergency_contact_name?: string;
  emergency_contact_relationship?: string;
  emergency_contact_phone?: string;
  requested_service?: string;
  preferred_date?: string;
  preferred_time?: string;
  party_package?: string;
  guest_count?: string;
  membership_interest?: string;
  message?: string;
  health_notes?: string;
  photo_video_consent?: string | boolean;
  assumption_of_risk?: string | boolean;
  parent_supervision?: string | boolean;
  release_of_liability?: string | boolean;
  medical_authorization?: string | boolean;
  health_safety_acknowledgment?: string | boolean;
  facility_rules_agreement?: string | boolean;
  electronic_signature?: string;
  waiver_version?: string;
  source_page?: string;
  _gotcha?: string;
};

type IntakeRecord = {
  intake_id: string;
  intake_type: string;
  status: string;
  parent_guardian_name: string;
  child_names: string;
  child_ages: string;
  phone: string;
  email: string;
  emergency_contact_name: string;
  emergency_contact_relationship: string;
  emergency_contact_phone: string;
  requested_service: string;
  preferred_date: string;
  preferred_time: string;
  party_package: string;
  guest_count: string;
  membership_interest: string;
  message: string;
  health_notes: string;
  photo_video_consent: boolean | null;
  assumption_of_risk: boolean;
  parent_supervision: boolean;
  release_of_liability: boolean;
  medical_authorization: boolean;
  health_safety_acknowledgment: boolean;
  facility_rules_agreement: boolean;
  electronic_signature: string;
  signed_at: string | null;
  waiver_version: string;
  source_page: string;
  user_agent: string;
  referrer: string;
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

function cleanEmail(value: unknown) {
  return clean(value, 320).toLowerCase();
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function toBool(value: unknown) {
  return value === true || value === "true" || value === "on" || value === "yes" || value === "1";
}

function optionalBool(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  return toBool(value);
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70) || "family";
}

function parentName(body: IntakePayload) {
  const combined = clean(body.parent_guardian_name);
  if (combined) return combined;
  return [body.first_name, body.last_name].map((part) => clean(part)).filter(Boolean).join(" ");
}

function buildRecord(body: IntakePayload, req: Request): IntakeRecord {
  const createdAt = new Date().toISOString();
  const type = clean(body.intake_type, 80) || "general_inquiry";
  const name = parentName(body) || (type === "newsletter_signup" ? "Newsletter Subscriber" : "");
  const signed = Boolean(clean(body.electronic_signature));

  return {
    intake_id: `${createdAt.replace(/[:.]/g, "-")}-${type}-${slugify(name || cleanEmail(body.email))}`,
    intake_type: type,
    status: "new",
    parent_guardian_name: name,
    child_names: clean(body.child_names, 2000),
    child_ages: clean(body.child_ages, 1000),
    phone: clean(body.phone, 80),
    email: cleanEmail(body.email),
    emergency_contact_name: clean(body.emergency_contact_name, 500),
    emergency_contact_relationship: clean(body.emergency_contact_relationship, 300),
    emergency_contact_phone: clean(body.emergency_contact_phone, 80),
    requested_service: clean(body.requested_service, 1000),
    preferred_date: clean(body.preferred_date, 100),
    preferred_time: clean(body.preferred_time, 100),
    party_package: clean(body.party_package, 200),
    guest_count: clean(body.guest_count, 100),
    membership_interest: clean(body.membership_interest, 300),
    message: clean(body.message, 5000),
    health_notes: clean(body.health_notes, 5000),
    photo_video_consent: optionalBool(body.photo_video_consent),
    assumption_of_risk: toBool(body.assumption_of_risk),
    parent_supervision: toBool(body.parent_supervision),
    release_of_liability: toBool(body.release_of_liability),
    medical_authorization: toBool(body.medical_authorization),
    health_safety_acknowledgment: toBool(body.health_safety_acknowledgment),
    facility_rules_agreement: toBool(body.facility_rules_agreement),
    electronic_signature: clean(body.electronic_signature, 500),
    signed_at: signed ? createdAt : null,
    waiver_version: clean(body.waiver_version, 200),
    source_page: clean(body.source_page, 1000),
    user_agent: clean(req.headers.get("user-agent"), 1000),
    referrer: clean(req.headers.get("referer"), 1000),
    raw_payload: body,
  };
}

async function saveRecord(record: IntakeRecord) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return { ok: false, status: "supabase_not_configured" };
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/sr_family_intake_submissions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": serviceRoleKey,
      "Authorization": `Bearer ${serviceRoleKey}`,
      "Prefer": "return=representation",
    },
    body: JSON.stringify(record),
  });

  const text = await response.text();
  if (!response.ok) {
    return { ok: false, status: "database_insert_failed", error: text };
  }

  return { ok: true, status: "database_inserted", record: JSON.parse(text || "[]")[0] || null };
}

function emailSubject(record: IntakeRecord) {
  if (record.intake_type === "waiver") return `New SR Sensory Gym waiver: ${record.parent_guardian_name}`;
  if (record.intake_type === "open_play_booking") return `New SR open play booking request: ${record.parent_guardian_name}`;
  if (record.intake_type === "party_booking") return `New SR party booking request: ${record.parent_guardian_name}`;
  if (record.intake_type === "newsletter_signup") return `New SR newsletter subscriber: ${record.email}`;
  return `New SR family inquiry: ${record.parent_guardian_name}`;
}

function emailHeading(record: IntakeRecord) {
  if (record.intake_type === "waiver") return "SR Sensory Gym Waiver";
  if (record.intake_type === "open_play_booking") return "SR Sensory Gym Open Play Booking";
  if (record.intake_type === "party_booking") return "SR Sensory Gym Party Booking";
  if (record.intake_type === "newsletter_signup") return "New SR Sensory Gym Newsletter Subscriber";
  return "SR Sensory Gym Family Intake";
}

function emailHtml(record: IntakeRecord) {
  const consent = record.photo_video_consent === null ? "Not answered" : record.photo_video_consent ? "Yes" : "No";
  const rows = [
    ["Submission type", record.intake_type],
    ["Parent/guardian", record.parent_guardian_name],
    ["Email", record.email],
    ["Phone", record.phone || "Not provided"],
    ["Child name(s)", record.child_names || "Not provided"],
    ["Child age(s)", record.child_ages || "Not provided"],
    ["Requested service", record.requested_service || "Not provided"],
    ["Party package", record.party_package || "Not provided"],
    ["Preferred date", record.preferred_date || "Not provided"],
    ["Preferred time", record.preferred_time || "Not provided"],
    ["Guest count", record.guest_count || "Not provided"],
    ["Membership interest", record.membership_interest || "Not provided"],
    ["Emergency contact", record.emergency_contact_name || "Not provided"],
    ["Emergency relationship", record.emergency_contact_relationship || "Not provided"],
    ["Emergency phone", record.emergency_contact_phone || "Not provided"],
    ["Photo/video consent", consent],
    ["Health notes", record.health_notes || "Not provided"],
    ["Message", record.message || "Not provided"],
    ["Electronic signature", record.electronic_signature || "Not provided"],
    ["Signed at", record.signed_at || "Not signed"],
    ["Intake ID", record.intake_id],
  ];

  return `
    <div style="font-family:Arial,sans-serif;color:#1f1f1f;line-height:1.55">
      <h2 style="margin:0 0 12px">${escapeHtml(emailHeading(record))}</h2>
      <p style="margin:0 0 18px">A family submitted information through the SR Sensory Gym website.</p>
      <table style="border-collapse:collapse;width:100%;max-width:760px">
        ${rows.map(([label, value]) => `
          <tr>
            <td style="border:1px solid #ddd;padding:10px;font-weight:700;background:#f7f7f7;width:220px">${escapeHtml(label)}</td>
            <td style="border:1px solid #ddd;padding:10px">${escapeHtml(value)}</td>
          </tr>
        `).join("")}
      </table>
    </div>
  `;
}

async function sendEmail(record: IntakeRecord) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const to = Deno.env.get("SR_INTAKE_EMAIL_TO") || "info@srchildrenslounge.com";
  const from = Deno.env.get("SR_INTAKE_EMAIL_FROM") || Deno.env.get("CLIENT_PROJECT_EMAIL_FROM") || "OwnYourWeb <updates@ownyourweb.xyz>";

  if (!apiKey) {
    return { sent: false, status: "resend_not_configured" };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from,
      to: [to],
      reply_to: record.email,
      subject: emailSubject(record),
      html: emailHtml(record),
    }),
  });

  const data = await response.json().catch(() => ({}));
  return { sent: response.ok, status: response.ok ? "sent" : "failed", response: data };
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

  const record = buildRecord(body, req);
  if (!record.parent_guardian_name) {
    return jsonResponse({ ok: false, error: "Parent/guardian name is required" }, 400);
  }
  if (!isValidEmail(record.email)) {
    return jsonResponse({ ok: false, error: "A valid email is required" }, 400);
  }

  if (record.intake_type === "waiver") {
    const requiredWaiverChecks = [
      record.assumption_of_risk,
      record.parent_supervision,
      record.release_of_liability,
      record.medical_authorization,
      record.health_safety_acknowledgment,
      record.facility_rules_agreement,
      Boolean(record.electronic_signature),
    ];
    if (requiredWaiverChecks.some((checked) => !checked)) {
      return jsonResponse({ ok: false, error: "All waiver acknowledgments and signature are required" }, 400);
    }
  }

  const database = await saveRecord(record);
  const email = await sendEmail(record);
  const ok = Boolean(database.ok);

  return jsonResponse({ ok, intake_id: record.intake_id, database, email }, ok ? 200 : 502);
});
