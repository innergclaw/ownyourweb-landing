# Client Trackers

Every form lead gets a folder here, even before payment.

## Sources

- `ownyourweb.xyz` main form: saved to Supabase `project_requests`.
- `shopnasgfx.com` Name Your Price and Paid Already forms: saved to Supabase `project_requests`.
- `innergclaw.github.io/owner-stack/for-hire.html`: saved to Supabase `owner_stack_leads`, then imported into the same tracker flow.

## Sync Flow

The GitHub Action runs `npm run sync:queue-and-trackers`.

That command:

1. Pulls `project_requests`.
2. Pulls `owner_stack_leads`.
3. Combines the rows into `agent-store/admin-queue.json`.
4. Creates or updates one local folder per lead in `client-trackers/`.

## Folder Rule

Each lead folder starts as a prospect workspace with:

- `lead-packet.md`
- `assets/`
- `deliverables/`
- `notes/`
- `previews/`

When someone pays, update the same folder instead of creating a second one.
