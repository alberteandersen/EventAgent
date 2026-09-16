-- Planning as a couple. Until now every row answered to one account
-- (`auth.uid() = user_id`), so the partner Ava invited got an account of their
-- own and an empty wedding. This makes a wedding a thing two people belong to.
--
-- event_members says who belongs to which wedding. Every existing event gets
-- its creator as owner, and a trigger does the same for new ones. A partner is
-- added only by the server, when they open their invitation (0024's token is
-- still the whole of that access), so there is no insert policy for clients.
--
-- Every wedding table then answers to membership instead of authorship.
-- `user_id` stays on each row as who wrote it, and is no longer what decides
-- who may read it. Written defensively over a list of tables, because not
-- every environment has every table (0014 and 0016 are not applied
-- everywhere): a missing table is skipped rather than failing the migration.

create table if not exists public.event_members (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'partner' check (role in ('owner', 'partner')),
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
create index if not exists event_members_user_idx on public.event_members(user_id);

insert into public.event_members (event_id, user_id, role)
select id, user_id, 'owner' from public.events
on conflict do nothing;

create or replace function public.add_event_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.event_members (event_id, user_id, role)
  values (new.id, new.user_id, 'owner')
  on conflict do nothing;
  return new;
end;
$$;
revoke execute on function public.add_event_owner() from public, anon, authenticated;

drop trigger if exists events_add_owner on public.events;
create trigger events_add_owner after insert on public.events
  for each row execute function public.add_event_owner();

-- Security definer so a policy on event_members itself can call it without
-- recursing into its own RLS. It only ever answers about the caller.
create or replace function public.is_event_member(eid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.event_members where event_id = eid and user_id = auth.uid());
$$;
revoke execute on function public.is_event_member(uuid) from public, anon;
grant execute on function public.is_event_member(uuid) to authenticated;

-- Whether the caller shares a wedding with `other`. Storage paths start with
-- the uploader's user id, so this is how a partner reads files the other half
-- of the couple uploaded.
create or replace function public.shares_event_with(other text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select other = auth.uid()::text or exists (
    select 1
    from public.event_members mine
    join public.event_members theirs on theirs.event_id = mine.event_id
    where mine.user_id = auth.uid() and theirs.user_id::text = other
  );
$$;
revoke execute on function public.shares_event_with(text) from public, anon;
grant execute on function public.shares_event_with(text) to authenticated;

alter table public.event_members enable row level security;
drop policy if exists "members see their wedding's members" on public.event_members;
create policy "members see their wedding's members" on public.event_members
  for select using (user_id = auth.uid() or public.is_event_member(event_id));

-- ── events ────────────────────────────────────────────────────────────────
drop policy if exists "own events" on public.events;
create policy "members read events" on public.events
  for select using (auth.uid() = user_id or public.is_event_member(id));
create policy "members update events" on public.events
  for update using (public.is_event_member(id)) with check (public.is_event_member(id));
create policy "owners create events" on public.events
  for insert with check (auth.uid() = user_id);
create policy "owners delete events" on public.events
  for delete using (auth.uid() = user_id);

-- ── every table that belongs to a wedding ───────────────────────────────
do $$
declare
  t text;
  p record;
begin
  foreach t in array array[
    'album_photos', 'budget_items', 'budget_sub_items', 'budget_contracts', 'chat_messages',
    'day_program_items', 'email_attachments', 'email_drafts', 'email_replies', 'guests',
    'honeymoon_saves', 'invite_designs', 'invite_orders', 'invitations', 'moodboard_items',
    'outbound_emails', 'registry_items', 'reply_proposals', 'seating_plans', 'site_photos',
    'thank_yous', 'timeline_tasks', 'venues', 'website_designs', 'website_orders',
    'wedding_sites', 'guestbook_entries'
  ] loop
    if to_regclass('public.' || t) is null then
      raise notice 'event_members: % does not exist here, skipped', t;
      continue;
    end if;
    -- Whatever the owner-only policies were called, they go.
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;
    execute format(
      'create policy %I on public.%I for all using (public.is_event_member(event_id)) with check (public.is_event_member(event_id))',
      'members ' || t, t
    );
  end loop;

  -- Claims are made by guests through the server; the couple only reads them.
  if to_regclass('public.registry_claims') is not null then
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'registry_claims' loop
      execute format('drop policy %I on public.registry_claims', p.policyname);
    end loop;
    create policy "members read registry_claims" on public.registry_claims
      for select using (public.is_event_member(event_id));
  end if;
end $$;

-- ── storage: files either half of the couple uploaded ───────────────────
drop policy if exists "own invite designs" on storage.objects;
drop policy if exists "own moodboard files" on storage.objects;
drop policy if exists "own site photos" on storage.objects;
drop policy if exists "own vendor files" on storage.objects;
drop policy if exists "own budget contracts" on storage.objects;
create policy "couple reads wedding files" on storage.objects
  for select using (
    bucket_id in ('invite-designs', 'moodboard', 'site-photos', 'vendor-files', 'budget-contracts')
    and public.shares_event_with((storage.foldername(name))[1])
  );
