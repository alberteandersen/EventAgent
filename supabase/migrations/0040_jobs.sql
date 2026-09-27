-- 0040_jobs.sql — work too slow for a request. Netlify ends a request at 60
-- seconds, and an Ava build or a round of vendor emails can take minutes.
-- In production the route records the work here and hands it to a Netlify
-- background function (netlify/functions/run-job-background.mts, up to 15
-- minutes); the browser polls /api/jobs/<id> until it is done. Locally the
-- route runs the work inline and never touches this table.

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,                 -- see JOB_KINDS in src/lib/jobs/run.ts
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'done', 'failed')),
  result jsonb,
  error text,                         -- what the couple is told, never a stack
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

create index if not exists jobs_event_idx on public.jobs(event_id, created_at desc);

-- The wedding's members read their jobs; only the server (service role)
-- creates and runs them, so there is no write policy.
alter table public.jobs enable row level security;
create policy "members read jobs" on public.jobs
  for select using (public.is_event_member(event_id));
