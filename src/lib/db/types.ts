// Hand-written row types mirroring supabase/migrations/0001_init.sql.
// Replace with `supabase gen types typescript` output once a project is linked.

import type { VenueResearchProfile } from "@/lib/venue/research";
import type {
  Accommodation, Catering, Ceremony, Exclusivity, Outdoor, OwnDrinks, PriceUnit, VenueSetting,
} from "@/lib/venue/facts";
import type { Parking } from "@/lib/venue/amenities";

export type EventStatus =
  | "gathering"
  | "searching"
  | "swiping"
  | "drafting"
  | "sending"
  | "awaiting_replies"
  | "done";

export type DatePrecision = "exact" | "month" | "season" | "undecided";

export interface EventRow {
  id: string;
  user_id: string;
  title: string;
  event_type: string | null;
  location: string | null;
  guest_count: number | null;
  event_date: string | null;
  date_precision: DatePrecision;
  date_hint: string | null;
  budget: string | null;
  requirements: Record<string, unknown>;
  status: EventStatus;
  chosen_venue_id: string | null;
  journey_overrides: Record<string, string>;
  /** Task ids the couple turned off on the home checklist. */
  checklist_hidden: string[];
  reply_tag: string | null;
  created_at: string;
}

export type MessageRole = "user" | "assistant" | "system" | "tool";

// ── Agent-driven client navigation ──────────────────────────────────────

/** Pages the agent can pull up on the user's screen via the show_page tool. */
export const AGENT_PAGES = [
  "home",
  "vendors",
  "inbox",
  "planning",
  "budget",
  "guests",
  "website",
  "registry",
  "invites",
  "seating",
  "honeymoon",
  "nygift",
] as const;
export type AgentPage = (typeof AGENT_PAGES)[number];

export function isAgentPage(value: unknown): value is AgentPage {
  return typeof value === "string" && (AGENT_PAGES as readonly string[]).includes(value);
}

/**
 * A client-side action the agent fires mid-turn. Streamed to the app as an
 * SSE `ui` frame from /api/chat; the client applies it (navigates the stage
 * in chat mode, or the main area behind the Ava drawer in classic mode).
 */
export interface AgentUiAction {
  kind: "navigate";
  page: AgentPage;
  /** Deep-link into the vendor hub when page is "vendors". */
  vendor_category?: VendorCategory;
  hub_tab?: "explore" | "shortlist" | "booked";
}

/** Rich-block payloads rendered inline in the chat. */
export type MessagePayload =
  | { kind: "venue_batch"; venue_ids: string[]; category?: VendorCategory }
  | { kind: "draft"; draft_id: string }
  | { kind: "send_report"; sent: number; failed: number; skipped: number }
  | { kind: "invite_brief"; wording: string; style: string | null }
  | { kind: "reply_proposal"; proposal_id: string };

export interface ChatMessageRow {
  id: string;
  event_id: string;
  user_id: string;
  role: MessageRole;
  content: string;
  payload: MessagePayload | null;
  created_at: string;
}

export type SwipeStatus = "pending" | "liked" | "rejected";

export type VendorCategory =
  | "venue"
  | "florist"
  | "photographer"
  | "musician"
  | "caterer"
  | "planner"
  | "accommodation"
  | "other";

export interface VenueReview {
  author: string | null;
  rating: number | null;
  text: string | null;
  relative_time: string | null;
}

export interface VenueRow {
  id: string;
  event_id: string;
  user_id: string;
  name: string;
  description: string | null;
  address: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  capacity: string | null;
  price_hint: string | null;
  image_url: string | null;
  source_urls: string[];
  swipe_status: SwipeStatus;
  email_lookup_status: "not_needed" | "pending" | "found" | "not_found";
  place_id: string | null;
  rating: number | null;
  review_count: number | null;
  reviews: VenueReview[];
  photo_urls: string[];
  lat: number | null;
  lng: number | null;
  price_level: string | null;
  business_status: string | null;
  why_fit: string | null;
  contact_verified: boolean;
  category: VendorCategory;
  booked_at: string | null;
  venue_research: VenueResearchProfile | null;
  /** Structured facts the venue search filters on — see lib/venue/facts.ts.
   *  Null throughout for non-venue vendors and for rows saved before 0025. */
  capacity_seated: number | null;
  capacity_standing: number | null;
  price_from: number | null;
  price_unit: PriceUnit | null;
  catering: Catering | null;
  accommodation: Accommodation | null;
  rooms: number | null;
  setting: VenueSetting | null;
  /** The area the venue was found in, e.g. "Helsingør". */
  region: string | null;
  /** Inferred from the venue's own pages — see 0026. Often null. */
  ceremony: Ceremony | null;
  outdoor: Outdoor | null;
  rain_plan: boolean | null;
  own_drinks: OwnDrinks | null;
  exclusive: Exclusivity | null;
  /** Hour the party must end, 24h clock: 1 = 01:00. */
  curfew_hour: number | null;
  /** Google-reported. Null means Google said nothing, never "no". */
  wheelchair: boolean | null;
  parking: Parking | null;
  good_for_children: boolean | null;
  allows_dogs: boolean | null;
  /** The couple's own rating, 1–5. `reviews` above is read-only Google data. */
  own_rating: number | null;
  own_review: string | null;
  own_reviewed_at: string | null;
  own_recommend: boolean | null;
  created_at: string;
}

export interface EmailDraftRow {
  id: string;
  event_id: string;
  user_id: string;
  subject: string;
  body_template: string;
  status: "proposed" | "approved" | "sent";
  version: number;
  category: VendorCategory;
  created_at: string;
}

export interface OutboundEmailRow {
  id: string;
  event_id: string;
  venue_id: string;
  draft_id: string | null;
  user_id: string;
  to_email: string;
  subject: string;
  body: string;
  gmail_message_id: string | null;
  gmail_thread_id: string | null;
  status: "queued" | "sent" | "failed" | "replied";
  error: string | null;
  sent_at: string | null;
  kind: "outreach" | "reply";
  in_reply_to_reply_id: string | null;
  created_at: string;
}

export interface QuoteExtraction {
  has_quote: boolean;
  price_amount: number | null;
  currency: string | null;
  price_basis: string | null;
  availability: "available" | "unavailable" | "unclear";
  conditions: string | null;
  summary: string;
}

export interface EmailReplyRow {
  id: string;
  outbound_email_id: string | null;
  venue_id: string;
  event_id: string;
  user_id: string;
  gmail_message_id: string;
  from_email: string | null;
  snippet: string | null;
  body: string | null;
  received_at: string | null;
  quote: QuoteExtraction | null;
  quote_status: "quoted" | "no_availability" | "needs_info" | "unclear" | null;
  rfc822_message_id: string | null;
  read_at: string | null;
  matched_via: "thread" | "tag" | "sender";
  created_at: string;
}

export interface EmailAttachmentRow {
  id: string;
  email_reply_id: string;
  venue_id: string;
  event_id: string;
  user_id: string;
  filename: string;
  mime_type: string | null;
  size_bytes: number | null;
  storage_path: string;
  created_at: string;
}

export type ReplyProposalStatus = "proposed" | "sent" | "dismissed" | "superseded";

export interface ReplyProposalRow {
  id: string;
  email_reply_id: string;
  outbound_email_id: string;
  venue_id: string;
  event_id: string;
  user_id: string;
  body: string;
  status: ReplyProposalStatus;
  sent_outbound_id: string | null;
  created_at: string;
}

export interface InviteDesignRow {
  id: string;
  event_id: string;
  user_id: string;
  style: string | null;
  palette: string | null;
  storage_path: string;
  selected: boolean;
  created_at: string;
}

export interface PlatformGmailTokensRow {
  id: number;
  google_email: string;
  refresh_token_enc: string;
  access_token: string | null;
  access_token_expires_at: string | null;
  scopes: string[];
  last_history_id: string | null;
  last_polled_at: string | null;
  updated_at: string;
}

export interface ProfileRow {
  user_id: string;
  display_name: string | null;
  partner_name: string | null;
  home_city: string | null;
  event_interests: string[];
  accent: string;
  onboarded: boolean;
  active_event_id: string | null;
  language: AppLanguage;
  created_at: string;
  updated_at: string;
}

// Supported UI languages. Danish is the source language (its dictionary is
// the source strings themselves). To add a language: add its code here, then
// register a dictionary + label in src/kalas/i18n.tsx — nothing else changes.
export const APP_LANGUAGES = ["da", "en"] as const;
export type AppLanguage = (typeof APP_LANGUAGES)[number];

export function isAppLanguage(value: unknown): value is AppLanguage {
  return typeof value === "string" && (APP_LANGUAGES as readonly string[]).includes(value);
}

export type InviteOrderStatus =
  | "draft"
  | "pending_payment"
  | "paid"
  | "submitted_to_print"
  | "shipped"
  | "canceled";

export interface InviteOrderRow {
  id: string;
  event_id: string;
  user_id: string;
  style: string | null;
  palette: string | null;
  wording: string | null;
  quantity: number;
  design_file_url: string | null;
  amount_cents: number | null;
  currency: string;
  stripe_session_id: string | null;
  stripe_payment_intent: string | null;
  status: InviteOrderStatus;
  created_at: string;
}

export type InvitationStatus = "draft" | "published";

/** A digital invitation: chosen template + the content (InvitationData) it
    renders, addressable publicly by slug. RSVPs land in the `guests` table. */
export interface InvitationRow {
  id: string;
  event_id: string;
  user_id: string;
  template_id: string;
  data: Record<string, unknown>;
  slug: string | null;
  status: InvitationStatus;
  created_at: string;
  updated_at: string;
}

export interface GoogleTokensRow {
  user_id: string;
  google_email: string | null;
  refresh_token_enc: string;
  access_token: string | null;
  access_token_expires_at: string | null;
  scopes: string[];
  updated_at: string;
}

// ── Planning tables (migration 0007) ────────────────────────────────────

export interface BudgetItemRow {
  id: string;
  event_id: string;
  user_id: string;
  category: string;
  label: string;
  planned_amount: number;
  paid_amount: number;
  actual_cost: number;
  notes: string | null;
  reminder_at: string | null;
  icon: string | null;
  color: string | null;
  sort: number;
  created_at: string;
}

/** One priced line within a budget category — a tent, chairs, tables, each
 *  possibly from a different vendor — linked by (event_id, category), not a
 *  FK to a specific budget_items row (see budget_sub_items migration). */
export interface BudgetSubItemRow {
  id: string;
  event_id: string;
  user_id: string;
  category: string;
  label: string;
  vendor: string | null;
  amount: number;
  sort: number;
  created_at: string;
}

/** One moment in the wedding day itself — a private, ordered schedule,
 *  distinct from wedding_sites.config.program (public, no status) and
 *  timeline_tasks (date-only milestones months out). */
export interface DayProgramItemRow {
  id: string;
  event_id: string;
  user_id: string;
  time: string;
  title: string;
  subtitle: string | null;
  /** Minutes the moment lasts. 0 = a point in time, not a block. */
  duration_min: number;
  /** Who is responsible — "Fotograf", "Toastmaster", the couple themselves. */
  owner: string | null;
  notes: string | null;
  sort: number;
  created_at: string;
}

/** Ava's structured contract review (Gemini output), stored on budget_contracts.review. */
export interface ContractReview {
  vendorName?: string;
  totalPrice?: number;
  currency?: string;
  depositAmount?: number;
  paymentSchedule?: { label: string; amount: number; dueDate: string }[];
  cancellationPolicy?: string;
  summary: string;
  redFlags?: string[];
  suggestedActualCost?: number;
  suggestedReminderDate?: string;
  language?: string;
}

export interface BudgetContractRow {
  id: string;
  event_id: string;
  user_id: string;
  category: string;
  filename: string;
  mime_type: string | null;
  size_bytes: number | null;
  storage_path: string;
  review: ContractReview | null;
  created_at: string;
}

export type RsvpStatus = "afventer" | "ja" | "nej";

export interface GuestRow {
  id: string;
  event_id: string;
  user_id: string;
  name: string;
  side: string;
  email: string | null;
  phone: string | null;
  rsvp: RsvpStatus;
  meal: string | null;
  plus_one: boolean;
  notes: string | null;
  /** Free text — what the public RSVP form writes, and the "anything else"
   *  box next to the structured tags below. */
  dietary: string | null;
  /** Stable ascii ids, never Danish labels — see screens/guests/dietary.ts. */
  dietary_tags: string[];
  /** Who the guest is to the couple. Deliberately not folded into `side`,
   *  which Seating groups tables by. */
  relation: string | null;
  overnight: boolean;
  no_alcohol: boolean;
  plus_one_name: string | null;
  responded_at: string | null;
  rsvp_token: string;
  created_at: string;
}

/** Two levels of detail in the same table — see 0020_task_kind.sql. */
export type TaskKind = "milestone" | "check";

/** See 0032_task_detail.sql. */
export type TaskPriority = "low" | "medium" | "high";
/** 'a' and 'b' are the two halves of the couple, in the order the app shows them. */
export type TaskAssignee = "a" | "b" | "both";

export interface TimelineTaskRow {
  id: string;
  event_id: string;
  user_id: string;
  title: string;
  due_date: string | null;
  done: boolean;
  /** Milestones: the 'wedding_day' sentinel. Checks: the area id. */
  category: string | null;
  /** Optional so a client running ahead of the migration still parses rows. */
  kind?: TaskKind | null;
  /** Optional for the same reason as `kind`: migration 0032. */
  notes?: string | null;
  priority?: TaskPriority | null;
  assignee?: TaskAssignee | null;
  sort: number;
  created_at: string;
}

export interface MoodboardItemRow {
  id: string;
  event_id: string;
  user_id: string;
  image_key: string | null;
  image_url: string | null;
  storage_path: string | null;
  note: string | null;
  created_at: string;
}

export type HoneymoonSaveKind = "destination" | "hotel" | "idea";

export interface HoneymoonSaveRow {
  id: string;
  event_id: string;
  user_id: string;
  kind: HoneymoonSaveKind;
  name: string;
  location: string | null;
  blurb: string | null;
  image_url: string | null;
  place_id: string | null;
  rating: number | null;
  meta: Record<string, unknown>;
  created_at: string;
}

export interface WeddingSiteRow {
  id: string;
  event_id: string;
  user_id: string;
  config: Record<string, unknown>;
  domain: string | null;
  published: boolean;
  updated_at: string;
}

// ── AI website tables (migration 0012) ──────────────────────────────────

export interface WebsiteDesignRow {
  id: string;
  event_id: string;
  user_id: string;
  brief: Record<string, unknown>;
  design: Record<string, unknown>;
  /** Sanitized model-built site markup; null → token-renderer fallback. */
  html: string | null;
  active: boolean;
  created_at: string;
}

export type SitePhotoKind = "upload" | "generated";
export type SitePhotoRole = "hero" | "gallery" | "section";

export interface SitePhotoRow {
  id: string;
  event_id: string;
  user_id: string;
  storage_path: string;
  kind: SitePhotoKind;
  role: SitePhotoRole;
  /** For role='section': which site section this generated image belongs to. */
  section: string | null;
  sort: number;
  created_at: string;
}

export type WebsiteOrderStatus = "pending_payment" | "paid" | "canceled";

export interface WebsiteOrderRow {
  id: string;
  event_id: string;
  user_id: string;
  amount_cents: number | null;
  currency: string;
  stripe_session_id: string | null;
  stripe_payment_intent: string | null;
  status: WebsiteOrderStatus;
  created_at: string;
}

export interface SeatingPlanRow {
  id: string;
  event_id: string;
  user_id: string;
  data: Record<string, unknown>;
  updated_at: string;
}

export interface RegistryItemRow {
  id: string;
  event_id: string;
  user_id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  product_url: string | null;
  store_name: string | null;
  price_cents: number | null;
  currency: string;
  quantity: number;
  /** "Ønskes mest" — sorts to the top on both surfaces. Optional so a client
   *  running ahead of migration 0022 still parses rows. */
  favourite?: boolean | null;
  sort: number;
  created_at: string;
}

export interface RegistryClaimRow {
  id: string;
  item_id: string;
  event_id: string;
  user_id: string;
  guest_name: string;
  guest_email: string | null;
  message: string | null;
  quantity: number;
  created_at: string;
}

// ── Nygift: after the wedding ───────────────────────────────────────────

export type ThankMethod = "kort" | "besked" | "personligt" | "ringet";

/**
 * The couple's annotations on the thank-you list. Sparse — a row exists only
 * once they touch an entry. The list itself is derived from guests +
 * registry_claims; see src/kalas/screens/nygift/thanks.ts.
 */
export interface ThankYouRow {
  id: string;
  event_id: string;
  user_id: string;
  /** 'guest:<uuid>' | 'claim:<uuid>' | 'manual:<uuid>' */
  subject_key: string;
  /** Denormalized display name, so the row survives the guest being deleted. */
  label: string;
  gift: string | null;
  thanked_at: string | null;
  method: ThankMethod | null;
  note: string | null;
  created_at: string;
}

export type AlbumPhotoStatus = "visible" | "hidden";

/** A photo a guest uploaded after the wedding. Couple-private. */
export interface AlbumPhotoRow {
  id: string;
  event_id: string;
  /** The couple, for RLS — guests have no auth.users id. */
  user_id: string;
  storage_path: string;
  uploader_name: string | null;
  guest_id: string | null;
  caption: string | null;
  status: AlbumPhotoStatus;
  favorite: boolean;
  bytes: number | null;
  width: number | null;
  height: number | null;
  uploader_hash: string | null;
  created_at: string;
}
