-- Orders are the paywall: a paid website_orders row unlocks the AI designers.
-- 0036 gave every wedding table one "for all" member policy, which let a
-- signed-in member insert or update an order as 'paid' straight from the
-- browser. Members now only read their orders; the checkout route and the
-- Stripe webhook write them with the service-role client.

drop policy if exists "members website_orders" on public.website_orders;
create policy "members read website_orders" on public.website_orders
  for select using (public.is_event_member(event_id));

-- invite_orders is no longer written by the app (the website purchase unlocks
-- the invitation designer too), but it carries the same policy.
drop policy if exists "members invite_orders" on public.invite_orders;
create policy "members read invite_orders" on public.invite_orders
  for select using (public.is_event_member(event_id));
