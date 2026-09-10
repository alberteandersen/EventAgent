-- The wedding day itself, minute by minute: a private, ordered schedule
-- separate from wedding_sites.config.program (public marketing content with
-- no status) and from timeline_tasks (date-only milestones months out).
create table public.day_program_items (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  time text not null,          -- "HH:MM", same free-text shape as ProgramEvent.time
  title text not null,
  subtitle text,                -- "Havens indgang · Velkomstdrinks"
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index day_program_items_event_idx on public.day_program_items(event_id);

alter table public.day_program_items enable row level security;
create policy "own day_program_items" on public.day_program_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter publication supabase_realtime add table public.day_program_items;
