# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Couples planning their own wedding, usually 6 to 18 months ahead, in the evening after work, on a laptop or a phone. Two situations weigh equally (confirmed 2026-10-11): a wedding in Denmark, and a wedding abroad where the venues do not write Danish. A partner can be invited to plan in the same wedding.

Secondary readers of what the couple makes: guests (the wedding website), and the photographer, toastmaster and family (the shared programme for the day).

## Product Purpose

Kalas plans a wedding with the couple. Juno, the coordinator inside it, does the legwork a wedding planner would: she finds real venues and vendors, writes to them for quotes, reads the replies, and keeps guests, budget, programme and seating in one place. The couple decides; Juno carries it out.

## Positioning

Danish competitors (bryllup.dk, bryllupsklar.dk) are catalogues and static checklists. Kalas' difference is that Juno does the work: real venues found on request, complete inquiries sent in the venue's own language, replies turned into comparable quotes. Nothing is sent before the couple has approved it.

## Operating Context

- Juno's panel sits beside every page of the app; the couple talks to her and she acts on the wedding's data.
- Mail to vendors goes from Juno's own Kalas mailbox, never from the couple's. Replies are collected every few minutes and land under Henvendelser; the couple gets a mail when a vendor answers.
- Guests answer on the couple's wedding site (`<navne>.kalas.dk`), and the answers land in the guest list.

## Capabilities and Constraints

What works today (checked against the code 2026-10-11):

- **Find:** real venues and vendors near a place, anywhere in the world, in ten categories (venue, overnatning, foto, video, blomster, catering, bar, bryllupskage, musik, beauty). Save favourites, compare, mark as booked.
- **Write:** Juno drafts an inquiry; the couple approves; it is sent in the venue's language (25 languages, from the venue's address).
- **Read:** from each reply Juno pulls price, what the price covers, availability and conditions, shows quotes side by side, and drafts an answer for approval.
- **Plan:** a phased plan with dates, and a programme for the day that can be shared by link with photographer, toastmaster and family.
- **Budget:** categories and posts, Juno's suggestion for how to spread the budget, and a read-through of a vendor contract. Quotes do not enter the budget by themselves; the couple or Juno (when asked) enters them.
- **Guests:** list, answers, dietary needs, overnight stays, and the counts the kitchen needs.
- **Wedding website:** built by Juno from the couple's photos and details; RSVP, programme, wish list, guest book, "find my seat", optional password.
- **Invitation:** a printed card designed with Juno, exported as PNG or PPTX for a printer or Canva. No digital invitation and no order-and-ship.
- **Seating:** a seating chart on a canvas, printable.
- **Wish list:** items added by link; guests reserve on the website.
- **After the day:** thank-you list and card, and an album guests upload their photos to.

Not in the product: automatic reminders or chasing of vendors, payment or deposits to vendors, picking a "best" quote for the couple, a swipe board.

Price: planning with Juno is free. A one-time 499 kr unlocks the designed wedding website and invitation (confirmed 2026-10-11 to state on the marketing page).

Languages: Danish first, English kept as a switchable translation in the app. The marketing page is Danish.

## Brand Commitments

- Name: Kalas. The coordinator is **Juno** (chosen 2026-10-11, after the Roman goddess of marriage), referred to as "hun". She was called Ava until then: the database table `ava_memories` and the browser setting `kalas_ava_open` keep that name on purpose, and the migrations are left as written.
- Juno is a character and the centre of the marketing: the couple's wedding coordinator, drawn as a little cupid (a round peach body, two small wings, a gold halo, a bow with a heart-tipped arrow). `src/components/juno/Juno.tsx`; preview at `/dev/juno`. The character is on the landing page, and in the app she gives the guided tour and sits in her own chat panel.
- She is cute, and she moves (she flies and hovers), but the motion must not distract from reading. The product must not read as an "AI product".
- Two earlier shapes were rejected and must not come back: a pointed droplet (read as a game slime) and a dollop with a curled tip (read as something worse).
- Voice: the couple is addressed as "I / jer / jeres". Plain Danish, no English words where a Danish one exists.

## Evidence on Hand

- Photography: `public/landing/*.jpg` (seven wedding scenes).
- Product miniatures drawn in code: `src/components/landing/CapabilityMockups.tsx`. The venues named in them are invented on purpose, and each name was checked against a web search.
- Market research: `docs/research/markedsundersoegelse.md`.
- No testimonials, customer counts, press or ratings exist. Do not invent any.

## Product Principles

1. Juno does the work; the couple decides. Every surface shows who acts and who approves.
2. Say only what works today.
3. Real places, real replies, real numbers: the wedding's own data over decoration.
4. One wedding, one place: nothing the couple enters should have to be entered twice.

## Accessibility & Inclusion

WCAG 2 AA, checked with axe on every page (2026-09-30). Motion respects `prefers-reduced-motion`.
