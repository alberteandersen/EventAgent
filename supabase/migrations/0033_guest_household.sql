-- Two things a guest list has to know that a name cannot tell it.
--
-- How old: catering prices a child's cover differently, a baby needs a high
-- chair rather than a seat, and the venue's headcount is usually "adults and
-- children". Every existing guest reads as an adult, which is what the list
-- assumed until now.
--
-- Who they come with: a household is one invitation, one envelope, often one
-- RSVP. It is modelled as a pointer to the guest who heads it rather than a
-- separate table, because a household has no properties of its own, only
-- members. `on delete set null` means removing the head leaves the others on
-- the list as guests in their own right, never deletes them.
alter table public.guests
  add column age_group text not null default 'adult'
    check (age_group in ('adult', 'child', 'baby')),
  add column household_head uuid references public.guests(id) on delete set null;

create index guests_household_head_idx on public.guests(household_head)
  where household_head is not null;
