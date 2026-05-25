import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import process from 'node:process';

const SUPABASE_URL = process.env.OWNYOURWEB_SUPABASE_URL || 'https://zkyhhoxcrjkhywblzehr.supabase.co';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const outputPath = resolve(process.cwd(), 'agent-store/admin-queue.json');
const limit = process.env.OWNYOURWEB_QUEUE_LIMIT || '100';

if (!key) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY in the environment.');
  process.exit(1);
}

function clean(value, fallback = '') {
  return String(value ?? fallback).trim();
}

function splitName(name) {
  const parts = clean(name).split(/\s+/).filter(Boolean);
  return {
    first: parts[0] || '',
    last: parts.slice(1).join(' '),
  };
}

async function fetchRows(table, { required = false } = {}) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  url.searchParams.set('select', '*');
  url.searchParams.set('order', 'created_at.desc');
  url.searchParams.set('limit', limit);

  const response = await fetch(url, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: 'application/json',
    },
  });

  const text = await response.text();
  if (!response.ok) {
    const message = `Supabase ${table} request failed: ${response.status} ${response.statusText}\n${text}`;
    if (required) {
      console.error(message);
      process.exit(1);
    }
    console.warn(message);
    return [];
  }

  return JSON.parse(text);
}

function normalizeOwnerStackLead(lead) {
  const raw = lead.raw_payload && typeof lead.raw_payload === 'object' ? lead.raw_payload : {};
  const name = splitName(lead.name || raw.name || '');
  const email = clean(lead.email || raw.email).toLowerCase();
  const projectType = clean(raw.projectType || raw.project_type || 'For Hire / Owner Stack Inquiry');
  const businessName = clean(
    raw.business_name ||
      raw.businessName ||
      raw.company ||
      raw.brand ||
      lead.name ||
      email ||
      'Owner Stack Lead'
  );
  const details = clean(raw.projectDetails || raw.project_details || raw.message || raw.request);
  const pageUrl = clean(lead.page_url || raw.pageUrl || raw.page_url);
  const source = clean(lead.source || raw.source || 'Owner Stack / For Hire Form');

  return {
    store_agent: 'ownyourweb',
    intent: 'owner_stack_for_hire_lead',
    request_id: `owner-stack-lead-${lead.id}`,
    created_at: lead.created_at,
    business_name: businessName,
    customer_first_name: name.first,
    customer_last_name: name.last,
    customer_email: email,
    industry: 'Creative Services / Owner Stack',
    package: projectType,
    budget_range: clean(raw.budgetRange || raw.budget_range || 'Not provided'),
    timeline: clean(raw.timeline || raw.deadline || 'Not provided'),
    buyer_agent_or_contact: clean([lead.name || raw.name, email].filter(Boolean).join(' / ')),
    request: details || 'Owner Stack / For Hire lead submitted. Review raw payload for full context.',
    assets_available: [
      pageUrl ? `Page URL: ${pageUrl}` : '',
      lead.referrer ? `Referrer: ${lead.referrer}` : '',
      'Submitted through Owner Stack lead form.',
    ].filter(Boolean).join('\n'),
    current_website: clean(raw.current_website || raw.website_url || pageUrl),
    source_page: source,
    admin_lane: 'ownyourweb',
    pack_type: 'lead',
    status: 'pending_owner_approval',
    next_steps: [
      'Review the inquiry and qualify the project fit.',
      'Reply with scope, starting price, and next-step payment or booking link.',
      'If the lead pays, update this tracker folder into an active project.',
    ],
    payment_status: 'not_paid_lead',
    notification_status: lead.telegram_notified ? 'telegram_sent' : 'lead_imported',
    raw_payload: raw,
  };
}

const projectRequests = await fetchRows('project_requests', { required: true });
const ownerStackLeads = await fetchRows('owner_stack_leads').then((rows) =>
  rows.filter((lead) => clean(lead.email || lead.raw_payload?.email)).map(normalizeOwnerStackLead)
);
const requests = [...projectRequests, ...ownerStackLeads].sort((a, b) =>
  clean(b.created_at).localeCompare(clean(a.created_at))
);

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify({ requests }, null, 2)}\n`, 'utf8');
console.log(
  `Wrote ${requests.length} requests to ${outputPath} ` +
    `(${projectRequests.length} project_requests + ${ownerStackLeads.length} owner_stack_leads)`
);
