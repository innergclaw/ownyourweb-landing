drop policy if exists "ai app audit events private" on public.ai_app_audit_events;

create policy "ai app audit events private"
  on public.ai_app_audit_events
  for all
  to anon, authenticated
  using (false)
  with check (false);
