-- Budget sub-items: individually-priced line items nested under one budget
-- category (e.g. "Telt" 15.000 kr, "Stole" 3.000 kr under "venue"). Linked by
-- (event_id, category) — the same free-text category key budget_items and
-- budget_contracts use — NOT a FK to a specific budget_items row id, since
-- that row can be recreated/reseeded (see seedAll in Budget.tsx).

create table public.budget_sub_items (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null,
  label text not null,
  vendor text,
  amount int not null default 0,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index budget_sub_items_event_idx on public.budget_sub_items(event_id);
create index budget_sub_items_cat_idx on public.budget_sub_items(event_id, category);

alter table public.budget_sub_items enable row level security;
create policy "own budget_sub_items" on public.budget_sub_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter publication supabase_realtime add table public.budget_sub_items;
