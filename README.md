# Kalas

*From Swedish "kalas", a celebration.*

A wedding planner for Danish couples, with an agent, Juno, that does the
work: she finds real venues and vendors, writes to them from the shared
Kalas mailbox, reads their replies, pulls out the quotes and drafts the
answers. The couple approves; Juno sends.

## What's in the app

The signed-in app lives at `/home` (`src/kalas`, one client-side app):

| Page | What it does |
|---|---|
| Hjem | The overview and a getting-started checklist |
| Planlægning | The plan by phase, and the wedding day as a calendar you can share |
| Henvendelser | Vendor replies, extracted quotes, Juno's proposed answers |
| Venue & leverandører | Find, save, compare, contact and book venues and vendors |
| Budget | The split by category, posts, contract review |
| Gæster | Guest list, RSVPs, an overview for the caterer |
| Hjemmeside | The couple's public site at `/w/[slug]`, built by Juno |
| Invitationer | A printed invitation card designed with Juno, exported for print |
| Bordplan | The seating plan; guests look up their table on the site |
| Ønskeliste | A wishlist from pasted links; guests reserve on the site |
| Nygift | After the wedding: thank-yous, the guest album, a recap |
| Guides | The Danish guide and FAQ, also public at `/guide` |

Juno's chat sits beside every page. Her tools are in `src/lib/gemini`
(`tools.ts`, `planningTools.ts`, `websiteTools.ts`, `memory.ts`).

## Stack

- **Next.js 16** (App Router, TypeScript, Tailwind 4)
- **Supabase**: Postgres with row-level security, Auth (Google), Realtime,
  Storage
- **Gemini**: the agent and extraction (`gemini-3.1-flash-lite`), grounded
  search for venues, the website and card builds, images
- **Google Places**: verifies every venue and vendor Juno suggests
- **Gmail API**: one shared outreach mailbox, connected by an admin
- **Stripe**: one purchase unlocks Juno's website and invitation designers
- **Netlify**: the app, plus a background function for long AI jobs
- **GitHub Actions**: polls the mailbox for vendor replies every 5 minutes

## How outreach works

1. Juno drafts one inquiry from the wedding's facts; the couple approves it.
2. Each saved vendor gets its own version, sent from the platform mailbox
   with `Reply-To: mailbox+<event-tag>@domain`, so one mailbox serves every
   wedding.
3. The poller (`worker/poll.ts`) matches replies by Gmail thread, falling
   back to the plus-address tag and then a uniquely known sender.
   Unattributable mail is labelled `kalas/unmatched`.
4. Gemini extracts price and availability, and drafts a reply the couple
   can send from Henvendelser or the chat. The couple gets an email when a
   vendor answers.

## Setup

1. **Supabase.** Create a project and run `supabase/migrations/` in order
   (`0001` to `0041`). Enable the Google auth provider and add your site
   URLs under Authentication → URL Configuration.
2. **Google Cloud, two projects.**
   - *Sign-in*: backs Supabase's Google login. External consent screen.
     Redirect URI `https://<project-ref>.supabase.co/auth/v1/callback`.
   - *Mailbox*: in the Workspace org that owns the outreach mailbox
     (`juno@kalas-weddings.com`). Enable the Gmail API, set the consent
     screen to Internal, and create a web OAuth client with redirect URIs
     `http://localhost:3000/api/admin/gmail/callback` and
     `https://<your-domain>/api/admin/gmail/callback`. Its id and secret go
     in `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.
   - Enable **Places API (New)** and create a key for `GOOGLE_PLACES_API_KEY`.
   - Optional: enable **Maps JavaScript API** and create a second, separate
     key for `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, restricted to that API and to
     your site's addresses. It turns on the map beside the venue list.
3. **Keys.** Gemini (aistudio.google.com), Jina Reader (jina.ai), Stripe.
4. **Environment.** `cp .env.local.example .env.local` and fill it in. The
   example explains every variable.

```bash
npm install
npm run dev
```

Sign in with an account listed in `PLATFORM_ADMIN_EMAILS` and connect the
outreach mailbox in Settings; then everyone can plan.

```bash
npm test
```

Screens can be built against fixture data at `/dev/*` (development only;
every `/dev` page is a 404 in a production build).

## Deploy

- **Netlify** (`netlify.toml`): set the variables from `.env.local.example`,
  with `GOOGLE_REDIRECT_URI` on the production callback and
  `JOBS_BACKGROUND=netlify` so long builds run in the background function.
- **Reply polling** (`.github/workflows/poll-replies.yml`): add the six
  repository secrets the workflow lists. One pass locally:
  `npx tsx --env-file=.env worker/poll.ts`.
- **Stripe**: point a webhook at `/api/webhooks/stripe` for
  `checkout.session.completed`, `checkout.session.expired`,
  `checkout.session.async_payment_succeeded` and
  `checkout.session.async_payment_failed`. Every purchase also gets a paid
  invoice from Stripe (`invoice_creation` in the checkout route).
- **Stripe is required in production.** Without `STRIPE_SECRET_KEY` the AI
  designers stay locked there (development runs them unlocked).
- **Privacy policy** (`/privatliv`): fill in `src/lib/legal.ts` (the company,
  contact, data region, retention, and the lawyer's answers) and set
  `reviewed: true`. Until then the page is a 404 in production and nothing
  links to it; `next dev` shows it with the gaps marked.
