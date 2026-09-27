-- 0041_reply_notifications.sql — tell the couple when a vendor writes back.
-- The poller (src/lib/gmail/poll.ts) ingests vendor replies every five
-- minutes; after each pass Ava emails every member of the wedding a short
-- digest of what came in (src/lib/notifications/replies.ts).
--
-- email_replies.notified_at is the claim: a reply is notified once, by
-- whichever poll sets it first. Every reply already in the table is marked
-- as notified here, so turning this on does not mail the couple their whole
-- history.

alter table public.email_replies
  add column if not exists notified_at timestamptz;

update public.email_replies
  set notified_at = coalesce(received_at, created_at)
  where notified_at is null;

create index if not exists email_replies_unnotified_idx
  on public.email_replies(created_at)
  where notified_at is null;

-- Per person, not per wedding: one half of the couple may want the mails and
-- the other not. On by default: a reply the couple does not see is a vendor
-- left waiting.
alter table public.profiles
  add column if not exists email_notifications boolean not null default true;
