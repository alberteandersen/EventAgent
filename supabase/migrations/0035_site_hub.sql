-- The guest hub: how many times the site has been opened, and a guestbook.
--
-- view_count is bumped by the public page through increment_site_view, one
-- statement, so two guests opening the link at once both count. The function
-- is security definer only so the page's service-role client can call it
-- without a policy; it is revoked from anon and authenticated, since a guest
-- must not be able to inflate the number from the browser.
alter table public.wedding_sites
  add column view_count integer not null default 0;

create or replace function public.increment_site_view(site_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.wedding_sites set view_count = view_count + 1 where id = site_id;
$$;

revoke execute on function public.increment_site_view(uuid) from public, anon, authenticated;

-- Messages guests leave on the site. Written by the public route with the
-- service role (a guest has no account), so there is no insert policy; the
-- couple reads and hides their own. `hidden` rather than delete, so a message
-- hidden by mistake can come back.
create table public.guestbook_entries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  message text not null check (char_length(message) between 1 and 500),
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index guestbook_entries_event_idx on public.guestbook_entries(event_id, created_at desc);

alter table public.guestbook_entries enable row level security;
create policy "own guestbook_entries read" on public.guestbook_entries
  for select using (auth.uid() = user_id);
create policy "own guestbook_entries update" on public.guestbook_entries
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own guestbook_entries delete" on public.guestbook_entries
  for delete using (auth.uid() = user_id);
