-- A task is more than a title and a date. The couple needs to say how much it
-- matters, which of them has it, and the details that do not fit on one line:
-- the florist's number, what was agreed, the link to the dress.
--
-- All three are optional and nullable, so every existing row reads as "no
-- priority, nobody, no notes" and nothing needs a backfill. `assignee` stores
-- who, not a name: 'a' and 'b' are the two halves of the couple in the order
-- the app shows them, so renaming either one in Settings does not orphan it.
alter table public.timeline_tasks
  add column notes text,
  add column priority text check (priority in ('low', 'medium', 'high')),
  add column assignee text check (assignee in ('a', 'b', 'both'));
