-- Add the tables the app subscribes to via Supabase Realtime (postgres_changes)
-- to the supabase_realtime publication. Without this, INSERTs never broadcast,
-- so live chat / alerts / labels won't update without a refresh.
-- Idempotent: only adds a table if it isn't already published.
do $$
declare
  t text;
begin
  foreach t in array array['messages', 'events', 'labels', 'eeg_segments'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
