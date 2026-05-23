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

const url = new URL(`${SUPABASE_URL}/rest/v1/project_requests`);
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
  console.error(`Supabase request failed: ${response.status} ${response.statusText}`);
  console.error(text);
  process.exit(1);
}

const requests = JSON.parse(text);
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify({ requests }, null, 2)}\n`, 'utf8');
console.log(`Wrote ${requests.length} requests to ${outputPath}`);
