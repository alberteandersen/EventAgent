-- Which "Kom godt i gang" tasks the couple has turned off.
--
-- Not every wedding needs a website, a registry or save-the-dates, and a
-- checklist that keeps asking for them reads as a list of failures. Stored on
-- the event rather than in localStorage so the choice follows the couple to
-- their other device, and to their partner.
--
-- Task ids, not journey stages: journey_overrides answers "is this stage
-- done", this answers "does this couple want this row at all".
alter table public.events
  add column checklist_hidden text[] not null default '{}'::text[];
