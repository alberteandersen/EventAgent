-- The budget as a list of posts under each category, the way a couple thinks
-- about it: the dress, the shoes, the DJ, each ticked off when it is paid.
--
-- `paid` is that tick. It says nothing about amounts: the category's own
-- "Betalt" figure stays the couple's number, since a post can be part-paid by
-- a deposit, and a tick is a statement they make, not a sum we infer.
--
-- `sub_items_seeded` records that a category has been given its usual posts
-- once. It lives on the row rather than in the browser so that a post the
-- couple deleted never comes back, whichever device they open next. Existing
-- categories start false and get their posts on the next visit; that is the
-- point of the change.
alter table public.budget_sub_items
  add column paid boolean not null default false;

alter table public.budget_items
  add column sub_items_seeded boolean not null default false;
