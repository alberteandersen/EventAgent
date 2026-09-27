-- 0039_invitation_designs.sql — the invitation is designed the way the
-- website is: a vibe (preset tokens, free and instant), the couple's photos
-- and a few words, then Ava builds the card as sanitized HTML. Every vibe,
-- build and change request is a version; exactly one is active per wedding.
--
-- The `invitations` row stays what it was: the share record (slug, status)
-- and the facts on the card (names, date, venue) in `data`. Photos are the
-- wedding's own site_photos, shared with the website.

create table if not exists public.invitation_designs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  brief jsonb not null default '{}'::jsonb,  -- preset, styleDirection, instruction, imageAliases
  design jsonb not null,                     -- the vibe's SiteDesign tokens (parseSiteDesign)
  html text,                                 -- sanitized model-built card; null = token card
  active boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists invitation_designs_event_idx on public.invitation_designs(event_id);
create unique index if not exists invitation_designs_one_active
  on public.invitation_designs(event_id) where active;

-- Same rule as every other wedding table since 0036: members of the wedding.
alter table public.invitation_designs enable row level security;
create policy "members invitation_designs" on public.invitation_designs
  for all using (public.is_event_member(event_id)) with check (public.is_event_member(event_id));

-- The builder live-updates when a build lands.
alter publication supabase_realtime add table public.invitation_designs;
