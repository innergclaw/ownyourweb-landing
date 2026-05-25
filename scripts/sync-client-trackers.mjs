import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import process from 'node:process';

const queuePath = resolve(process.cwd(), process.env.OWNYOURWEB_QUEUE_PATH || 'agent-store/admin-queue.json');
const trackersRoot = resolve(process.cwd(), process.env.OWNYOURWEB_CLIENT_TRACKERS_DIR || 'client-trackers');

const folderAliases = new Map([
  ['brinx entertainment', 'BRINX'],
]);

function clean(value) {
  return String(value || '').trim();
}

function slugify(value) {
  return clean(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toUpperCase();
}

function clientFolderName(packet) {
  const businessName = clean(packet.business_name);
  const customerName = clean([packet.customer_first_name, packet.customer_last_name].filter(Boolean).join(' '));
  const alias = folderAliases.get(businessName.toLowerCase());

  return alias || slugify(businessName || customerName || packet.request_id || 'UNKNOWN-CLIENT');
}

function stageFor(packet) {
  const status = clean(packet.status).toLowerCase();
  const payment = clean(packet.payment_status).toLowerCase();

  if (status.includes('complete') || status.includes('approved') || status.includes('delivered')) return 'Won';
  if (payment.includes('received')) return 'Active Project';
  if (status.includes('pending')) return 'Lead';
  return 'In Review';
}

function priorityFor(packet) {
  const timeline = clean(packet.timeline).toLowerCase();
  const status = clean(packet.status).toLowerCase();
  const payment = clean(packet.payment_status).toLowerCase();

  if (timeline.includes('rush') || status.includes('rush')) return 'High';
  if (payment.includes('received') && !status.includes('complete')) return 'Medium';
  return 'Low';
}

function nextAction(packet) {
  const steps = Array.isArray(packet.next_steps) ? packet.next_steps.filter(Boolean) : [];
  if (steps.length > 0) return steps[0];
  if (clean(packet.project_update)) return packet.project_update;
  return 'Review the intake packet and set the next action.';
}

function markdownFor(packet, folderName) {
  const clientName = clean([packet.customer_first_name, packet.customer_last_name].filter(Boolean).join(' ')) || clean(packet.buyer_agent_or_contact) || 'Unknown client';
  const lines = [
    `# ${folderName} Client Tracker`,
    '',
    `Request ID: ${clean(packet.request_id) || 'n/a'}`,
    `Created: ${clean(packet.created_at) || 'n/a'}`,
    `Client: ${clientName}`,
    `Contact: ${clean(packet.customer_email) || 'n/a'}`,
    `Business: ${clean(packet.business_name) || 'n/a'}`,
    `Industry: ${clean(packet.industry) || 'n/a'}`,
    `Package: ${clean(packet.package) || 'n/a'}`,
    `Budget: ${clean(packet.budget_range) || 'n/a'}`,
    `Payment status: ${clean(packet.payment_status) || 'n/a'}`,
    `Project status: ${clean(packet.status) || 'n/a'}`,
    `Stage: ${stageFor(packet)}`,
    `Priority: ${priorityFor(packet)}`,
    `Source: ${clean(packet.source_page) || 'n/a'}`,
    '',
    '## Links',
    '',
    `Current website: ${clean(packet.current_website) || 'n/a'}`,
    `Checkout URL: ${clean(packet.checkout_url) || 'n/a'}`,
    '',
    '## Request',
    '',
    clean(packet.request) || 'n/a',
    '',
    '## Assets Available',
    '',
    clean(packet.assets_available) || 'n/a',
    '',
    '## Next Steps',
    '',
  ];

  const steps = Array.isArray(packet.next_steps) ? packet.next_steps.filter(Boolean) : [];
  if (steps.length > 0) {
    lines.push(...steps.map((step) => `- ${step}`));
  } else {
    lines.push(`- ${nextAction(packet)}`);
  }

  lines.push('', '## Latest Update', '', clean(packet.project_update) || 'n/a', '');
  return `${lines.join('\n')}\n`;
}

async function ensureTracker(packet) {
  const folderName = clientFolderName(packet);
  const folderPath = join(trackersRoot, folderName);
  const dirs = ['assets', 'deliverables', 'notes', 'previews'];

  await mkdir(folderPath, { recursive: true });
  await Promise.all(dirs.map(async (dir) => {
    const dirPath = join(folderPath, dir);
    await mkdir(dirPath, { recursive: true });
    const keepPath = join(dirPath, '.gitkeep');
    if (!existsSync(keepPath)) {
      await writeFile(keepPath, '', 'utf8');
    }
  }));

  await writeFile(join(folderPath, 'lead-packet.md'), markdownFor(packet, folderName), 'utf8');
  return folderPath;
}

const queue = JSON.parse(await readFile(queuePath, 'utf8'));
const requests = Array.isArray(queue.requests) ? queue.requests : [];

await mkdir(trackersRoot, { recursive: true });
const created = [];

for (const packet of requests) {
  created.push(await ensureTracker(packet));
}

console.log(`Synced ${created.length} client tracker folder${created.length === 1 ? '' : 's'} into ${trackersRoot}`);
