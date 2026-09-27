-- Ava's chat as separate conversations, with what she did in each one, and a
-- memory that outlives any single conversation.
--
-- chat_threads: until now a wedding had one endless chat. A thread is one
-- conversation; "+ Ny" starts another. Every existing message is moved into
-- one thread per wedding, so nothing disappears.
--
-- chat_messages.thread_id: the server routes (onboarding welcome, outreach
-- reports, the reply poller) insert messages without knowing about threads.
-- A trigger files those into the wedding's most recent conversation, creating
-- one when there is none, and bumps the thread so it sorts first.
--
-- chat_messages.tool_calls: the tools Ava ran to produce an assistant reply,
-- so the couple can see what she actually did, also after a reload.
--
-- ava_memories: what Ava knows about the couple across conversations —
-- preferences, decisions, things to follow up on. She writes them with a
-- tool and reads all of them on every turn.

create table if not exists public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists chat_threads_event_idx on public.chat_threads(event_id, updated_at desc);

-- Access follows the wedding: whoever may read the event row may use its
-- threads and memories. Going through events rather than is_event_member()
-- keeps this working where 0036 is not applied yet (owner only there), and
-- lets partners in wherever it is.
alter table public.chat_threads enable row level security;
create policy "wedding chat_threads" on public.chat_threads
  for all
  using (exists (select 1 from public.events e where e.id = event_id))
  with check (exists (select 1 from public.events e where e.id = event_id));

alter table public.chat_messages
  add column if not exists thread_id uuid references public.chat_threads(id) on delete cascade,
  add column if not exists tool_calls jsonb;
create index if not exists chat_messages_thread_idx on public.chat_messages(thread_id, created_at);

-- One thread per wedding for the history that already exists, titled by the
-- first thing the couple wrote.
insert into public.chat_threads (event_id, user_id, title, created_at, updated_at)
select
  m.event_id,
  (array_agg(m.user_id order by m.created_at))[1],
  left((array_agg(m.content order by m.created_at) filter (where m.role = 'user'))[1], 80),
  min(m.created_at),
  max(m.created_at)
from public.chat_messages m
where m.thread_id is null
group by m.event_id;

update public.chat_messages m
set thread_id = t.id
from public.chat_threads t
where t.event_id = m.event_id and m.thread_id is null;

-- Security definer: it reads and bumps threads regardless of RLS, but only for
-- the row's own wedding, and the insert policy on chat_messages still decides
-- whether the row (and so this whole statement) is allowed.
create or replace function public.chat_message_thread()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.thread_id is null then
    select id into new.thread_id
    from chat_threads
    where event_id = new.event_id
    order by updated_at desc
    limit 1;
    if new.thread_id is null then
      insert into chat_threads (event_id, user_id)
      values (new.event_id, new.user_id)
      returning id into new.thread_id;
    end if;
  elsif not exists (select 1 from chat_threads where id = new.thread_id and event_id = new.event_id) then
    raise exception 'chat thread % does not belong to event %', new.thread_id, new.event_id;
  end if;
  update chat_threads set updated_at = now() where id = new.thread_id;
  return new;
end;
$$;
revoke execute on function public.chat_message_thread() from public, anon, authenticated;

drop trigger if exists chat_messages_thread on public.chat_messages;
create trigger chat_messages_thread before insert on public.chat_messages
  for each row execute function public.chat_message_thread();

create table if not exists public.ava_memories (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null default 'fact'
    check (category in ('preference', 'decision', 'fact', 'followup')),
  content text not null check (length(content) between 1 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ava_memories_event_idx on public.ava_memories(event_id, created_at);

alter table public.ava_memories enable row level security;
create policy "wedding ava_memories" on public.ava_memories
  for all
  using (exists (select 1 from public.events e where e.id = event_id))
  with check (exists (select 1 from public.events e where e.id = event_id));
