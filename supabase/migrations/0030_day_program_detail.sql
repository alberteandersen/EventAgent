-- More than a time and a title: how long a moment lasts (so the day's gaps and
-- overlaps become visible), who is responsible for it (so the schedule can be
-- handed to a photographer or a toastmaster and still mean something), and
-- room for the longer instruction that does not fit on one line.
alter table public.day_program_items
  add column duration_min int not null default 0,   -- 0 = a point in time, not a block
  add column owner text,                            -- "Fotograf", "Toastmaster", …
  add column notes text;
