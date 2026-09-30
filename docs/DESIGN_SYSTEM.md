# Kalas design system

The couple-facing app (everything under `.theme-kalas`: the app at `/home`,
onboarding, settings, the guide) is built from one palette and one set of
primitives. The public wedding site (`src/kalas/site`, `/w/[slug]`), the gift
card it embeds and the invitation card paint in the couple's own colours and
are out of scope here.

`src/kalas/design-guard.test.ts` keeps the rules below from drifting: it
fails on raw hex colour utilities, on `window.confirm/prompt/alert`, and on a
page title written by hand.

## Colour tokens

Defined in `src/app/globals.css` (`@theme`, overridden per subtree by
`.theme-kalas` for `ink` and `ink-soft`). Use the utility (`bg-card`,
`text-muted`, `border-line`, with opacity as `bg-ink/8`), never a hex value.

| Role | Tokens |
|---|---|
| Surfaces | `canvas` #f4f5f3 page · `chrome` #f0f1ec sidebar/header · `card` #ffffff · `paper` #f8f9f8 quiet panel, and text on forest · `shell` #eceeeb inset tile · `blush` #e6e9e6 |
| Ink | `ink` #24413a · `ink-soft` #46574f · `ink-deep` #12332b · `muted` #5f6b66 · `faint` #8a9992 |
| Sage | `sage` #7d938a · `sage-strong` #5f7d70 · `sage-tint` #dbe5e0 · `sage-wash` #e8f0ec |
| Lines | `line` #dcdfdb · `line-soft` #e6e9e5 · `line-strong` #c6cbc6 (and the `.rule*` hairlines at 0.5px) |
| Accent | `terracotta` #b34e37, the one accent: links, arrows, errors · `amber` #e6a34e |
| Status | positive `success` on `success-tint` · waiting `clay-ink` on `clay-tint` · late or wrong `terracotta` on `terracotta-wash` / `terracotta-tint` |

## Type

Cormorant (`font-serif`) for headings and big numbers, Hanken (`font-sans`)
for everything else. The scale: `text-micro` 11px (badges, tracked labels),
`text-xs` 12px, `text-meta` 13px (subtitles, meta, buttons), `text-sm` 14px,
`text-base` 16px, `text-title` (serif card and dialog titles) and `text-page`
(the page heading, set by `PageHeader`).

Buttons and chips that do something are sentence case. Tracked capitals
belong to eyebrows (`.eyebrow`) and status chips (`Chip`).

## Primitives (`src/kalas/ui`)

| Primitive | Use |
|---|---|
| `Page` | Every screen's frame: gutters and a 24px rhythm. `narrow` for reading width. |
| `PageHeader` | Title, one line on what the page is for, its guide, its actions; `Tabs` go inside it. |
| `SectionTitle` | A serif heading inside a page. |
| `Tabs` | The one tab bar: icon, label, badge, alert dot, arrow keys. |
| `Button`, `IconButton` | `primary` (one per view), `secondary`, `ghost`, `danger`; `sm` and `md`; `icon`, `iconEnd`, `href`. |
| `Dialog` | Every modal: a bottom sheet on a phone, a card from `sm` up, focus kept inside, `eyebrow`, `title`, `description`, `footer`. |
| `useConfirm` | `await confirm({ title, body, danger })` instead of `window.confirm`. |
| `EmptyState`, `ErrorState`, `Loader`, `PageLoader`, `Skeleton` | Nothing yet, failed, and waiting. A screen shows `PageLoader` until the wedding has loaded. |
| `Field`, `inputClass`, `textareaClass` | A labelled input, the label a real `<label>`. |
| `Card`, `Stat` | The surface (22px radius, one hairline, no shadow at rest) and one number with its label. |
| `Eyebrow`, `Chip`, `SelectPill`, `Toggle`, `CheckDot` | Small parts: tracked label, status chip, toggleable chip, switch, check. |

`/dev/ui` shows every primitive on one page; `/dev/app?screen=…` renders any
screen inside the real shell against a fixture wedding (development only).
