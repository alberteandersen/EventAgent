-- A read-only link to the wedding day's programme, for the people who run it:
-- the photographer, the toastmaster, the caterer, a parent. They need the
-- times, not an account.
--
-- The token is the whole of the access control, the same as a partner invite
-- (0024): 32 characters of base64url, unguessable, and replaced rather than
-- reused when the couple makes a new link, which is how an old one is revoked.
-- Null means the programme is not shared. The public page reads it with the
-- service role, so no policy changes are needed.
alter table public.events
  add column program_share_token text unique;
