-- A guest is more than a name and an address: catering needs to know who eats
-- what and who is not drinking, and the venue needs to know who is staying the
-- night. Relation is kept separate from `side` on purpose — Seating groups
-- tables by `side`, so folding "brudens moster" into it would fragment those
-- groups.
--
-- dietary_tags sits alongside the existing free-text `dietary` rather than
-- replacing it: the public RSVP form and the seating plan both read `dietary`
-- as prose, so it stays the "anything else" field while the tags carry the
-- structured choices.
alter table public.guests
  add column relation text,                                     -- "Brudens moster", "Kollega", …
  add column dietary_tags text[] not null default '{}'::text[],  -- stable ascii ids, see guests/dietary.ts
  add column overnight boolean not null default false,
  add column no_alcohol boolean not null default false;
