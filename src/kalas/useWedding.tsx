"use client";

/* The real data layer for the Kalas app. Loads the signed-in couple's actual
   wedding (event + venues + outreach + replies + proposals + invites) via the
   browser Supabase client and exposes it, plus a `couple` adapter shaped like
   the old mock `data.ts` so screens can read real data with minimal changes.
   Screens that have no backend yet keep reading data.ts. */

import * as React from "react";
import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { computeJourney, type JourneyStage } from "@/lib/journey";
import { resolveWeddingDate } from "@/lib/wedding-date";
import type {
  BudgetItemRow,
  BudgetSubItemRow,
  DayProgramItemRow,
  EmailAttachmentRow,
  EmailDraftRow,
  EmailReplyRow,
  EventRow,
  GuestRow,
  HoneymoonSaveKind,
  HoneymoonSaveRow,
  InvitationRow,
  InviteDesignRow,
  InviteOrderRow,
  MoodboardItemRow,
  OutboundEmailRow,
  ProfileRow,
  RegistryClaimRow,
  ThankYouRow,
  ThankMethod,
  RegistryItemRow,
  ReplyProposalRow,
  SeatingPlanRow,
  TimelineTaskRow,
  TaskKind,
  VendorCategory,
  VenueRow,
  WeddingSiteRow,
  WebsiteDesignRow,
  SitePhotoRow,
  WebsiteOrderRow,
} from "@/lib/db/types";

/** Adapter shaped like the old mock `couple` so screens swap in easily. */
export interface Couple {
  a: string;
  b: string;
  dateISO: string | null;
  dateLabel: string;
  guests: number;
  budgetTotal: number;
  region: string;
  style: string;
  email: string;
}

export interface WeddingData {
  loading: boolean;
  hasWedding: boolean;
  event: EventRow | null;
  profile: ProfileRow | null;
  couple: Couple;
  venues: VenueRow[];
  drafts: EmailDraftRow[];
  outbound: OutboundEmailRow[];
  replies: EmailReplyRow[];
  attachments: EmailAttachmentRow[];
  proposals: ReplyProposalRow[];
  inviteOrders: InviteOrderRow[];
  inviteDesigns: InviteDesignRow[];
  invitations: InvitationRow[];
  journey: JourneyStage[];

  // Planning tables (migration 0007) — the couple's own editable data.
  budgetItems: BudgetItemRow[];
  /** Priced lines nested under one budget category (migration 0028) — a
   *  tent, chairs, tables, each possibly from a different vendor. */
  budgetSubItems: BudgetSubItemRow[];
  /** The wedding day itself, minute by minute (migration 0029). */
  dayProgramItems: DayProgramItemRow[];
  guests: GuestRow[];
  timelineTasks: TimelineTaskRow[];
  moodboardItems: MoodboardItemRow[];
  weddingSite: WeddingSiteRow | null;
  seatingPlan: SeatingPlanRow | null;
  registryItems: RegistryItemRow[];
  registryClaims: RegistryClaimRow[];
  thankYous: ThankYouRow[];
  /** The couple's own rating of a vendor they booked. */
  saveVenueReview: (
    venueId: string,
    patch: { own_rating?: number | null; own_review?: string | null; own_recommend?: boolean | null }
  ) => Promise<void>;
  /** Upserts the couple's annotation for one person on the thank-you list. */
  saveThankYou: (
    subjectKey: string,
    patch: { label: string; gift?: string | null; thanked_at?: string | null; method?: ThankMethod | null; note?: string | null }
  ) => Promise<void>;
  /** The couple's favourited honeymoon destinations, hotels and ideas. */
  honeymoonSaves: HoneymoonSaveRow[];
  /** All generations, newest first; the active one drives the live site. */
  websiteDesigns: WebsiteDesignRow[];
  websiteDesign: WebsiteDesignRow | null;
  sitePhotos: SitePhotoRow[];
  websiteOrders: WebsiteOrderRow[];
  websitePaid: boolean;

  refresh: () => Promise<void>;
  updateEvent: (patch: Partial<EventRow>) => Promise<void>;

  saveBudgetItem: (item: {
    category: string; label: string;
    planned_amount?: number; paid_amount?: number; actual_cost?: number;
    notes?: string | null; reminder_at?: string | null;
    icon?: string | null; color?: string | null; sort?: number;
    sub_items_seeded?: boolean;
  }) => Promise<void>;
  deleteBudgetItem: (category: string) => Promise<void>;

  addBudgetSubItem: (item: { category: string; label: string; vendor?: string | null; amount: number; sort?: number }) => Promise<BudgetSubItemRow | null>;
  updateBudgetSubItem: (id: string, patch: Partial<Pick<BudgetSubItemRow, 'label' | 'vendor' | 'amount' | 'sort' | 'paid'>>) => Promise<void>;
  deleteBudgetSubItem: (id: string) => Promise<void>;
  /** Adds many posts in one round-trip — a category's usual posts at 0 kr. */
  seedBudgetSubItems: (items: { category: string; label: string; amount: number; sort: number }[]) => Promise<boolean>;

  addDayProgramItem: (item: {
    time: string; title: string; subtitle?: string | null;
    duration_min?: number; owner?: string | null; notes?: string | null; sort?: number;
  }) => Promise<DayProgramItemRow | null>;
  updateDayProgramItem: (id: string, patch: Partial<Pick<DayProgramItemRow, 'time' | 'title' | 'subtitle' | 'duration_min' | 'owner' | 'notes' | 'sort'>>) => Promise<void>;
  deleteDayProgramItem: (id: string) => Promise<void>;
  /** Seeds a whole day in one round-trip — the classic-day template. */
  seedDayProgram: (items: { time: string; title: string; subtitle?: string | null; duration_min?: number; owner?: string | null }[]) => Promise<void>;

  addGuest: (guest: Partial<GuestRow> & { name: string }) => Promise<GuestRow | null>;
  updateGuest: (id: string, patch: Partial<GuestRow>) => Promise<void>;
  deleteGuest: (id: string) => Promise<void>;

  addTask: (task: { title: string; due_date?: string | null; category?: string | null; kind?: TaskKind; sort?: number; done?: boolean }) => Promise<TimelineTaskRow | null>;
  updateTask: (id: string, patch: Partial<TimelineTaskRow>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  /** Resolves to null on success, or the error message when the write failed. */
  seedTasks: (tasks: { title: string; due_date?: string | null; category?: string | null; kind?: TaskKind; done?: boolean; sort?: number }[]) => Promise<string | null>;
  /** Delete every task of one kind in a single round-trip (used by Nulstil).
   *  Resolves to null on success, or the error message when the delete failed. */
  clearTasks: (kind: TaskKind) => Promise<string | null>;

  addMoodboardItem: (item: { image_key?: string | null; image_url?: string | null; note?: string | null }) => Promise<MoodboardItemRow | null>;
  removeMoodboardItem: (id: string) => Promise<void>;

  saveSite: (patch: { config?: Record<string, unknown>; domain?: string | null; published?: boolean }) => Promise<void>;
  saveSeating: (data: Record<string, unknown>) => Promise<void>;

  addRegistryItem: (item: Partial<RegistryItemRow> & { title: string }) => Promise<RegistryItemRow | null>;
  updateRegistryItem: (id: string, patch: Partial<RegistryItemRow>) => Promise<void>;
  deleteRegistryItem: (id: string) => Promise<void>;

  addHoneymoonSave: (item: {
    kind: HoneymoonSaveKind;
    name: string;
    location?: string | null;
    blurb?: string | null;
    image_url?: string | null;
    place_id?: string | null;
    rating?: number | null;
    meta?: Record<string, unknown>;
  }) => Promise<HoneymoonSaveRow | null>;
  removeHoneymoonSave: (id: string) => Promise<void>;
  /** Mark a saved destination/hotel/idea as booked (or un-book it). */
  setHoneymoonBooked: (id: string, booked: boolean) => Promise<void>;

  /** Create/update a digital invitation via /api/invitations (assigns a unique
      share slug server-side). Returns the saved row. */
  saveInvitation: (input: {
    id?: string;
    templateId: string;
    data: Record<string, unknown>;
    publish?: boolean;
  }) => Promise<InvitationRow | null>;
}

const FALLBACK_COUPLE: Couple = {
  a: "",
  b: "",
  dateISO: null,
  dateLabel: "",
  guests: 0,
  budgetTotal: 0,
  region: "",
  style: "",
  email: "",
};

const Ctx = createContext<WeddingData | null>(null);

function upsertById<T extends { id: string }>(rows: T[], row: T): T[] {
  const i = rows.findIndex((x) => x.id === row.id);
  if (i === -1) return [...rows, row];
  const next = rows.slice();
  next[i] = row;
  return next;
}

function removeById<T extends { id: string }>(rows: T[], id: string): T[] {
  return rows.filter((x) => x.id !== id);
}

function parseBudget(text: string | null): number {
  if (!text) return 0;
  const digits = text.replace(/[^\d]/g, "");
  return digits ? Number.parseInt(digits, 10) : 0;
}

function toCouple(
  event: EventRow | null,
  profile: ProfileRow | null,
  email: string
): Couple {
  if (!event) return { ...FALLBACK_COUPLE, email };
  const a = (profile?.display_name ?? event.title).split(/\s+/)[0] || "";
  const b = profile?.partner_name?.split(/\s+/)[0] ?? "";
  const dateISO = event.event_date ?? resolveWeddingDate(event).iso;
  const dateLabel = event.event_date
    ? new Date(event.event_date).toLocaleDateString("da-DK", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : event.date_hint ?? "Dato ikke fastsat";
  const style =
    (typeof event.requirements?.description === "string"
      ? (event.requirements.description as string)
      : Array.isArray(event.requirements?.vibes)
        ? (event.requirements.vibes as string[]).join(", ")
        : "") || "";
  return {
    a,
    b,
    dateISO,
    dateLabel,
    guests: event.guest_count ?? 0,
    budgetTotal: parseBudget(event.budget),
    region: event.location ?? "",
    style,
    email,
  };
}

export function WeddingProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [event, setEvent] = useState<EventRow | null>(null);
  const [email, setEmail] = useState("");
  const [venues, setVenues] = useState<VenueRow[]>([]);
  const [drafts, setDrafts] = useState<EmailDraftRow[]>([]);
  const [outbound, setOutbound] = useState<OutboundEmailRow[]>([]);
  const [replies, setReplies] = useState<EmailReplyRow[]>([]);
  const [attachments, setAttachments] = useState<EmailAttachmentRow[]>([]);
  const [proposals, setProposals] = useState<ReplyProposalRow[]>([]);
  const [inviteOrders, setInviteOrders] = useState<InviteOrderRow[]>([]);
  const [inviteDesigns, setInviteDesigns] = useState<InviteDesignRow[]>([]);
  const [invitations, setInvitations] = useState<InvitationRow[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [budgetItems, setBudgetItems] = useState<BudgetItemRow[]>([]);
  const [budgetSubItems, setBudgetSubItems] = useState<BudgetSubItemRow[]>([]);
  const [dayProgramItems, setDayProgramItems] = useState<DayProgramItemRow[]>([]);
  const [guests, setGuests] = useState<GuestRow[]>([]);
  const [timelineTasks, setTimelineTasks] = useState<TimelineTaskRow[]>([]);
  const [moodboardItems, setMoodboardItems] = useState<MoodboardItemRow[]>([]);
  const [weddingSite, setWeddingSite] = useState<WeddingSiteRow | null>(null);
  const [seatingPlan, setSeatingPlan] = useState<SeatingPlanRow | null>(null);
  const [registryItems, setRegistryItems] = useState<RegistryItemRow[]>([]);
  const [registryClaims, setRegistryClaims] = useState<RegistryClaimRow[]>([]);
  const [thankYous, setThankYous] = useState<ThankYouRow[]>([]);
  const [honeymoonSaves, setHoneymoonSaves] = useState<HoneymoonSaveRow[]>([]);
  const [websiteDesigns, setWebsiteDesigns] = useState<WebsiteDesignRow[]>([]);
  const [sitePhotos, setSitePhotos] = useState<SitePhotoRow[]>([]);
  const [websiteOrders, setWebsiteOrders] = useState<WebsiteOrderRow[]>([]);

  const load = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    setEmail(user.email ?? "");
    setUserId(user.id);

    const { data: profileRow } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    setProfile((profileRow as ProfileRow | null) ?? null);

    // The active wedding: profile pointer, else the most recent event.
    let ev: EventRow | null = null;
    const activeId = (profileRow as ProfileRow | null)?.active_event_id;
    if (activeId) {
      const { data } = await supabase.from("events").select("*").eq("id", activeId).maybeSingle();
      ev = (data as EventRow | null) ?? null;
    }
    if (!ev) {
      const { data } = await supabase
        .from("events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      ev = (data as EventRow | null) ?? null;
    }
    setEvent(ev);

    if (ev) {
      const [v, d, o, r, at, p, io, idz, bi, bsi, dpi, g, tt, mb, ws, sp, ri, rc, wd, sph, wo, inv, hs, ty] = await Promise.all([
        supabase.from("venues").select("*").eq("event_id", ev.id).order("created_at"),
        supabase.from("email_drafts").select("*").eq("event_id", ev.id),
        supabase.from("outbound_emails").select("*").eq("event_id", ev.id).order("created_at"),
        supabase.from("email_replies").select("*").eq("event_id", ev.id).order("created_at"),
        supabase.from("email_attachments").select("*").eq("event_id", ev.id).order("created_at"),
        supabase.from("reply_proposals").select("*").eq("event_id", ev.id).order("created_at"),
        supabase.from("invite_orders").select("*").eq("event_id", ev.id).order("created_at", { ascending: false }),
        supabase.from("invite_designs").select("*").eq("event_id", ev.id).order("created_at", { ascending: false }),
        supabase.from("budget_items").select("*").eq("event_id", ev.id).order("sort"),
        supabase.from("budget_sub_items").select("*").eq("event_id", ev.id).order("sort").order("created_at"),
        supabase.from("day_program_items").select("*").eq("event_id", ev.id).order("time"),
        supabase.from("guests").select("*").eq("event_id", ev.id).order("created_at"),
        supabase.from("timeline_tasks").select("*").eq("event_id", ev.id).order("sort").order("due_date"),
        supabase.from("moodboard_items").select("*").eq("event_id", ev.id).order("created_at", { ascending: false }),
        supabase.from("wedding_sites").select("*").eq("event_id", ev.id).maybeSingle(),
        supabase.from("seating_plans").select("*").eq("event_id", ev.id).maybeSingle(),
        supabase.from("registry_items").select("*").eq("event_id", ev.id).order("sort"),
        supabase.from("registry_claims").select("*").eq("event_id", ev.id).order("created_at"),
        supabase.from("website_designs").select("*").eq("event_id", ev.id).order("created_at", { ascending: false }),
        supabase.from("site_photos").select("*").eq("event_id", ev.id).order("sort").order("created_at"),
        supabase.from("website_orders").select("*").eq("event_id", ev.id).order("created_at", { ascending: false }),
        supabase.from("invitations").select("*").eq("event_id", ev.id).order("created_at", { ascending: false }),
        supabase.from("honeymoon_saves").select("*").eq("event_id", ev.id).order("created_at", { ascending: false }),
        supabase.from("thank_yous").select("*").eq("event_id", ev.id).order("created_at"),
      ]);
      setVenues((v.data ?? []) as VenueRow[]);
      setDrafts((d.data ?? []) as EmailDraftRow[]);
      setOutbound((o.data ?? []) as OutboundEmailRow[]);
      setReplies((r.data ?? []) as EmailReplyRow[]);
      setAttachments((at.data ?? []) as EmailAttachmentRow[]);
      setProposals((p.data ?? []) as ReplyProposalRow[]);
      setInviteOrders((io.data ?? []) as InviteOrderRow[]);
      setInviteDesigns((idz.data ?? []) as InviteDesignRow[]);
      setBudgetItems((bi.data ?? []) as BudgetItemRow[]);
      setBudgetSubItems((bsi.data ?? []) as BudgetSubItemRow[]);
      setDayProgramItems((dpi.data ?? []) as DayProgramItemRow[]);
      setGuests((g.data ?? []) as GuestRow[]);
      setTimelineTasks((tt.data ?? []) as TimelineTaskRow[]);
      setMoodboardItems((mb.data ?? []) as MoodboardItemRow[]);
      setWeddingSite((ws.data as WeddingSiteRow | null) ?? null);
      setSeatingPlan((sp.data as SeatingPlanRow | null) ?? null);
      setRegistryItems((ri.data ?? []) as RegistryItemRow[]);
      setRegistryClaims((rc.data ?? []) as RegistryClaimRow[]);
      setThankYous((ty.data ?? []) as ThankYouRow[]);
      setWebsiteDesigns((wd.data ?? []) as WebsiteDesignRow[]);
      setSitePhotos((sph.data ?? []) as SitePhotoRow[]);
      setWebsiteOrders((wo.data ?? []) as WebsiteOrderRow[]);
      setInvitations((inv.data ?? []) as InvitationRow[]);
      setHoneymoonSaves((hs.data ?? []) as HoneymoonSaveRow[]);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  // ── Mutators ────────────────────────────────────────────────────────────
  // Simple user-owned CRUD writes straight through the browser client (RLS
  // scopes every row to auth.uid()); local state updates optimistically from
  // the returned row, and realtime reconciles other tabs.
  const eventId = event?.id ?? null;

  const updateEvent = useCallback(
    async (patch: Partial<EventRow>) => {
      if (!eventId) return;
      const { data } = await supabase.from("events").update(patch).eq("id", eventId).select().single();
      if (data) setEvent(data as EventRow);
    },
    [supabase, eventId]
  );

  const saveBudgetItem = useCallback(
    async (item: {
      category: string; label: string;
      planned_amount?: number; paid_amount?: number; actual_cost?: number;
      notes?: string | null; reminder_at?: string | null;
      icon?: string | null; color?: string | null; sort?: number;
      sub_items_seeded?: boolean;
    }) => {
      if (!eventId || !userId) return;
      const existing = budgetItems.find((b) => b.category === item.category);
      if (existing) {
        const { data } = await supabase
          .from("budget_items")
          .update({
            label: item.label,
            planned_amount: item.planned_amount ?? existing.planned_amount,
            paid_amount: item.paid_amount ?? existing.paid_amount,
            actual_cost: item.actual_cost ?? existing.actual_cost,
            notes: item.notes !== undefined ? item.notes : existing.notes,
            reminder_at: item.reminder_at !== undefined ? item.reminder_at : existing.reminder_at,
            icon: item.icon !== undefined ? item.icon : existing.icon,
            color: item.color !== undefined ? item.color : existing.color,
            sort: item.sort ?? existing.sort,
            // Only sent when set: a database older than 0037 has no such column.
            ...(item.sub_items_seeded !== undefined ? { sub_items_seeded: item.sub_items_seeded } : {}),
          })
          .eq("id", existing.id)
          .select()
          .single();
        if (data) setBudgetItems((rows) => upsertById(rows, data as BudgetItemRow));
      } else {
        const { data } = await supabase
          .from("budget_items")
          .insert({
            event_id: eventId,
            user_id: userId,
            category: item.category,
            label: item.label,
            planned_amount: item.planned_amount ?? 0,
            paid_amount: item.paid_amount ?? 0,
            actual_cost: item.actual_cost ?? 0,
            notes: item.notes ?? null,
            reminder_at: item.reminder_at ?? null,
            icon: item.icon ?? null,
            color: item.color ?? null,
            sort: item.sort ?? 0,
            ...(item.sub_items_seeded !== undefined ? { sub_items_seeded: item.sub_items_seeded } : {}),
          })
          .select()
          .single();
        if (data) setBudgetItems((rows) => upsertById(rows, data as BudgetItemRow));
      }
    },
    [supabase, eventId, userId, budgetItems]
  );

  const deleteBudgetItem = useCallback(
    async (category: string) => {
      const existing = budgetItems.find((b) => b.category === category);
      if (!existing) return;
      await supabase.from("budget_items").delete().eq("id", existing.id);
      setBudgetItems((rows) => removeById(rows, existing.id));
    },
    [supabase, budgetItems]
  );

  const addBudgetSubItem = useCallback(
    async (item: { category: string; label: string; vendor?: string | null; amount: number; sort?: number }) => {
      if (!eventId || !userId) return null;
      const { data } = await supabase
        .from("budget_sub_items")
        .insert({
          event_id: eventId,
          user_id: userId,
          category: item.category,
          label: item.label,
          vendor: item.vendor ?? null,
          amount: item.amount,
          sort: item.sort ?? 0,
        })
        .select()
        .single();
      if (data) setBudgetSubItems((rows) => upsertById(rows, data as BudgetSubItemRow));
      return (data as BudgetSubItemRow) ?? null;
    },
    [supabase, eventId, userId]
  );

  const updateBudgetSubItem = useCallback(
    async (id: string, patch: Partial<Pick<BudgetSubItemRow, 'label' | 'vendor' | 'amount' | 'sort' | 'paid'>>) => {
      // Optimistic: a tick should land the moment it is pressed.
      setBudgetSubItems((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
      const { data } = await supabase.from("budget_sub_items").update(patch).eq("id", id).select().single();
      if (data) setBudgetSubItems((rows) => upsertById(rows, data as BudgetSubItemRow));
    },
    [supabase]
  );

  const seedBudgetSubItems = useCallback(
    async (items: { category: string; label: string; amount: number; sort: number }[]) => {
      if (!eventId || !userId) return false;
      if (items.length === 0) return true;
      const { data, error } = await supabase
        .from("budget_sub_items")
        .insert(items.map((item) => ({ event_id: eventId, user_id: userId, vendor: null, ...item })))
        .select();
      if (error) {
        console.error("seedBudgetSubItems failed:", error.message);
        return false;
      }
      if (data) setBudgetSubItems((rows) => (data as BudgetSubItemRow[]).reduce((acc, r) => upsertById(acc, r), rows));
      return true;
    },
    [supabase, eventId, userId]
  );

  const deleteBudgetSubItem = useCallback(
    async (id: string) => {
      await supabase.from("budget_sub_items").delete().eq("id", id);
      setBudgetSubItems((rows) => removeById(rows, id));
    },
    [supabase]
  );

  const addDayProgramItem = useCallback(
    async (item: {
      time: string; title: string; subtitle?: string | null;
      duration_min?: number; owner?: string | null; notes?: string | null; sort?: number;
    }) => {
      if (!eventId || !userId) {
        console.error("addDayProgramItem: no wedding loaded yet", { eventId, userId });
        return null;
      }
      const { data, error } = await supabase
        .from("day_program_items")
        .insert({
          event_id: eventId,
          user_id: userId,
          time: item.time,
          title: item.title,
          subtitle: item.subtitle ?? null,
          duration_min: item.duration_min ?? 0,
          owner: item.owner ?? null,
          notes: item.notes ?? null,
          sort: item.sort ?? 0,
        })
        .select()
        .single();
      if (error) console.error("addDayProgramItem failed:", error.message);
      if (data) setDayProgramItems((rows) => upsertById(rows, data as DayProgramItemRow));
      return (data as DayProgramItemRow) ?? null;
    },
    [supabase, eventId, userId]
  );

  const seedDayProgram = useCallback(
    async (items: { time: string; title: string; subtitle?: string | null; duration_min?: number; owner?: string | null }[]) => {
      if (!eventId || !userId || items.length === 0) return;
      const { data } = await supabase
        .from("day_program_items")
        .insert(items.map((item, i) => ({
          event_id: eventId,
          user_id: userId,
          time: item.time,
          title: item.title,
          subtitle: item.subtitle ?? null,
          duration_min: item.duration_min ?? 0,
          owner: item.owner ?? null,
          sort: i,
        })))
        .select();
      if (data) setDayProgramItems((rows) => (data as DayProgramItemRow[]).reduce((acc, r) => upsertById(acc, r), rows));
    },
    [supabase, eventId, userId]
  );

  const updateDayProgramItem = useCallback(
    async (id: string, patch: Partial<Pick<DayProgramItemRow, 'time' | 'title' | 'subtitle' | 'duration_min' | 'owner' | 'notes' | 'sort'>>) => {
      const { data } = await supabase.from("day_program_items").update(patch).eq("id", id).select().single();
      if (data) setDayProgramItems((rows) => upsertById(rows, data as DayProgramItemRow));
    },
    [supabase]
  );

  const deleteDayProgramItem = useCallback(
    async (id: string) => {
      await supabase.from("day_program_items").delete().eq("id", id);
      setDayProgramItems((rows) => removeById(rows, id));
    },
    [supabase]
  );

  const addGuest = useCallback(
    async (guest: Partial<GuestRow> & { name: string }) => {
      if (!eventId || !userId) return null;
      const { data } = await supabase
        .from("guests")
        .insert({
          event_id: eventId,
          user_id: userId,
          name: guest.name,
          side: guest.side ?? "Fælles",
          email: guest.email ?? null,
          phone: guest.phone ?? null,
          rsvp: guest.rsvp ?? "afventer",
          meal: guest.meal ?? null,
          plus_one: guest.plus_one ?? false,
          notes: guest.notes ?? null,
          // Previously dropped on the floor even when passed, which lost
          // anything the add form captured beyond the four basics.
          dietary: guest.dietary ?? null,
          dietary_tags: guest.dietary_tags ?? [],
          plus_one_name: guest.plus_one_name ?? null,
          relation: guest.relation ?? null,
          overnight: guest.overnight ?? false,
          no_alcohol: guest.no_alcohol ?? false,
          age_group: guest.age_group ?? "adult",
          household_head: guest.household_head ?? null,
        })
        .select()
        .single();
      if (data) setGuests((rows) => upsertById(rows, data as GuestRow));
      return (data as GuestRow) ?? null;
    },
    [supabase, eventId, userId]
  );

  const updateGuest = useCallback(
    async (id: string, patch: Partial<GuestRow>) => {
      const { data } = await supabase.from("guests").update(patch).eq("id", id).select().single();
      if (data) setGuests((rows) => upsertById(rows, data as GuestRow));
    },
    [supabase]
  );

  const deleteGuest = useCallback(
    async (id: string) => {
      await supabase.from("guests").delete().eq("id", id);
      setGuests((rows) => removeById(rows, id));
    },
    [supabase]
  );

  const addTask = useCallback(
    async (task: { title: string; due_date?: string | null; category?: string | null; kind?: TaskKind; sort?: number; done?: boolean }) => {
      if (!eventId || !userId) return null;
      const { data } = await supabase
        .from("timeline_tasks")
        .insert({
          event_id: eventId,
          user_id: userId,
          title: task.title,
          due_date: task.due_date ?? null,
          category: task.category ?? null,
          kind: task.kind ?? "milestone",
          sort: task.sort ?? 0,
          done: task.done ?? false,
        })
        .select()
        .single();
      if (data) setTimelineTasks((rows) => upsertById(rows, data as TimelineTaskRow));
      return (data as TimelineTaskRow) ?? null;
    },
    [supabase, eventId, userId]
  );

  const updateTask = useCallback(
    async (id: string, patch: Partial<TimelineTaskRow>) => {
      const { data } = await supabase.from("timeline_tasks").update(patch).eq("id", id).select().single();
      if (data) setTimelineTasks((rows) => upsertById(rows, data as TimelineTaskRow));
    },
    [supabase]
  );

  const deleteTask = useCallback(
    async (id: string) => {
      await supabase.from("timeline_tasks").delete().eq("id", id);
      setTimelineTasks((rows) => removeById(rows, id));
    },
    [supabase]
  );

  /**
   * Returns null on success, else the error message. The checklist seeds ~200
   * rows in one go and used to fail silently — an empty list and a failed
   * insert looked identical, so the caller needs to be able to tell them apart.
   */
  const seedTasks = useCallback(
    async (tasks: { title: string; due_date?: string | null; category?: string | null; kind?: TaskKind; done?: boolean; sort?: number }[]) => {
      if (!eventId || !userId) return "Brylluppet er ikke indlæst endnu.";
      if (tasks.length === 0) return null;
      const rows = tasks.map((t, i) => ({
        event_id: eventId,
        user_id: userId,
        title: t.title,
        due_date: t.due_date ?? null,
        category: t.category ?? null,
        kind: t.kind ?? "milestone",
        done: t.done ?? false,
        sort: t.sort ?? i,
      }));
      const { data, error } = await supabase.from("timeline_tasks").insert(rows).select();
      if (error) return error.message;
      if (data) setTimelineTasks((prev) => (data as TimelineTaskRow[]).reduce((acc, r) => upsertById(acc, r), prev));
      return null;
    },
    [supabase, eventId, userId]
  );

  /**
   * Writes straight to `venues` through the RLS client — deliberately NOT via
   * /api/venues/[venueId], whose PATCH only accepts { booked } and carries
   * venue-exclusivity side effects we do not want here.
   */
  const saveVenueReview = useCallback(
    async (
      venueId: string,
      patch: { own_rating?: number | null; own_review?: string | null; own_recommend?: boolean | null }
    ) => {
      const { data } = await supabase
        .from("venues")
        .update({ ...patch, own_reviewed_at: new Date().toISOString() })
        .eq("id", venueId)
        .select()
        .single();
      if (data) setVenues((rows) => upsertById(rows, data as VenueRow));
    },
    [supabase]
  );

  /**
   * The thank-you list is derived from guests + registry_claims; this stores
   * only the couple's own annotations, keyed by subject_key so a row is
   * created the first time they touch someone and updated after that.
   */
  const saveThankYou = useCallback(
    async (
      subjectKey: string,
      patch: { label: string; gift?: string | null; thanked_at?: string | null; method?: ThankMethod | null; note?: string | null }
    ) => {
      if (!eventId || !userId) return;
      const { data } = await supabase
        .from("thank_yous")
        .upsert(
          { event_id: eventId, user_id: userId, subject_key: subjectKey, ...patch },
          { onConflict: "event_id,subject_key" }
        )
        .select()
        .single();
      if (data) setThankYous((rows) => upsertById(rows, data as ThankYouRow));
    },
    [supabase, eventId, userId]
  );

  /** Returns null on success, else the error message — see `seedTasks`. */
  const clearTasks = useCallback(
    async (kind: TaskKind) => {
      if (!eventId) return "Brylluppet er ikke indlæst endnu.";
      const { error } = await supabase.from("timeline_tasks").delete().eq("event_id", eventId).eq("kind", kind);
      if (error) return error.message;
      setTimelineTasks((rows) => rows.filter((r) => (r.kind === "check" ? "check" : "milestone") !== kind));
      return null;
    },
    [supabase, eventId]
  );

  const addMoodboardItem = useCallback(
    async (item: { image_key?: string | null; image_url?: string | null; note?: string | null }) => {
      if (!eventId || !userId) return null;
      const { data } = await supabase
        .from("moodboard_items")
        .insert({
          event_id: eventId,
          user_id: userId,
          image_key: item.image_key ?? null,
          image_url: item.image_url ?? null,
          note: item.note ?? null,
        })
        .select()
        .single();
      if (data) setMoodboardItems((rows) => upsertById(rows, data as MoodboardItemRow));
      return (data as MoodboardItemRow) ?? null;
    },
    [supabase, eventId, userId]
  );

  const removeMoodboardItem = useCallback(
    async (id: string) => {
      await supabase.from("moodboard_items").delete().eq("id", id);
      setMoodboardItems((rows) => removeById(rows, id));
    },
    [supabase]
  );

  // Read the latest site via a ref so saveSite keeps a stable identity — it is
  // called from a debounced autosave effect, and depending on `weddingSite`
  // here would re-fire that effect on every save (an infinite save loop).
  const weddingSiteRef = React.useRef(weddingSite);
  weddingSiteRef.current = weddingSite;
  const saveSite = useCallback(
    async (patch: { config?: Record<string, unknown>; domain?: string | null; published?: boolean }) => {
      if (!eventId || !userId) return;
      const current = weddingSiteRef.current;
      const row = {
        event_id: eventId,
        user_id: userId,
        config: patch.config ?? current?.config ?? {},
        domain: patch.domain !== undefined ? patch.domain : current?.domain ?? null,
        published: patch.published !== undefined ? patch.published : current?.published ?? false,
        updated_at: new Date().toISOString(),
      };
      const { data } = await supabase
        .from("wedding_sites")
        .upsert(row, { onConflict: "event_id" })
        .select()
        .single();
      if (data) setWeddingSite(data as WeddingSiteRow);
    },
    [supabase, eventId, userId]
  );

  const saveSeating = useCallback(
    async (data: Record<string, unknown>) => {
      if (!eventId || !userId) return;
      const { data: row } = await supabase
        .from("seating_plans")
        .upsert(
          { event_id: eventId, user_id: userId, data, updated_at: new Date().toISOString() },
          { onConflict: "event_id" }
        )
        .select()
        .single();
      if (row) setSeatingPlan(row as SeatingPlanRow);
    },
    [supabase, eventId, userId]
  );

  const addRegistryItem = useCallback(
    async (item: Partial<RegistryItemRow> & { title: string }) => {
      if (!eventId || !userId) return null;
      const { data } = await supabase
        .from("registry_items")
        .insert({
          event_id: eventId,
          user_id: userId,
          title: item.title,
          description: item.description ?? null,
          image_url: item.image_url ?? null,
          product_url: item.product_url ?? null,
          store_name: item.store_name ?? null,
          price_cents: item.price_cents ?? null,
          currency: item.currency ?? "DKK",
          quantity: item.quantity ?? 1,
          sort: item.sort ?? 0,
        })
        .select()
        .single();
      if (data) setRegistryItems((rows) => upsertById(rows, data as RegistryItemRow));
      return (data as RegistryItemRow) ?? null;
    },
    [supabase, eventId, userId]
  );

  const updateRegistryItem = useCallback(
    async (id: string, patch: Partial<RegistryItemRow>) => {
      const { data } = await supabase.from("registry_items").update(patch).eq("id", id).select().single();
      if (data) setRegistryItems((rows) => upsertById(rows, data as RegistryItemRow));
    },
    [supabase]
  );

  const deleteRegistryItem = useCallback(
    async (id: string) => {
      await supabase.from("registry_items").delete().eq("id", id);
      setRegistryItems((rows) => removeById(rows, id));
    },
    [supabase]
  );

  const addHoneymoonSave = useCallback(
    async (item: {
      kind: HoneymoonSaveKind;
      name: string;
      location?: string | null;
      blurb?: string | null;
      image_url?: string | null;
      place_id?: string | null;
      rating?: number | null;
      meta?: Record<string, unknown>;
    }) => {
      if (!eventId || !userId) return null;
      // De-dupe on place_id (when known) so saving the same place twice is a no-op.
      if (item.place_id) {
        const existing = honeymoonSaves.find(
          (h) => h.kind === item.kind && h.place_id === item.place_id
        );
        if (existing) return existing;
      }
      const { data } = await supabase
        .from("honeymoon_saves")
        .insert({
          event_id: eventId,
          user_id: userId,
          kind: item.kind,
          name: item.name,
          location: item.location ?? null,
          blurb: item.blurb ?? null,
          image_url: item.image_url ?? null,
          place_id: item.place_id ?? null,
          rating: item.rating ?? null,
          meta: item.meta ?? {},
        })
        .select()
        .single();
      if (data) setHoneymoonSaves((rows) => upsertById(rows, data as HoneymoonSaveRow));
      return (data as HoneymoonSaveRow) ?? null;
    },
    [supabase, eventId, userId, honeymoonSaves]
  );

  const removeHoneymoonSave = useCallback(
    async (id: string) => {
      await supabase.from("honeymoon_saves").delete().eq("id", id);
      setHoneymoonSaves((rows) => removeById(rows, id));
    },
    [supabase]
  );

  const setHoneymoonBooked = useCallback(
    async (id: string, booked: boolean) => {
      const current = honeymoonSaves.find((h) => h.id === id);
      if (!current) return;
      const meta = { ...current.meta, booked };
      // Optimistic — mirror the flag locally, then persist.
      setHoneymoonSaves((rows) =>
        rows.map((h) => (h.id === id ? { ...h, meta } : h))
      );
      const { data } = await supabase
        .from("honeymoon_saves")
        .update({ meta })
        .eq("id", id)
        .select()
        .single();
      if (data) setHoneymoonSaves((rows) => upsertById(rows, data as HoneymoonSaveRow));
    },
    [supabase, honeymoonSaves]
  );

  const saveInvitation = useCallback(
    async (input: { id?: string; templateId: string; data: Record<string, unknown>; publish?: boolean }) => {
      const res = await fetch("/api/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) return null;
      const row = (await res.json()) as InvitationRow;
      setInvitations((rows) => upsertById(rows, row));
      return row;
    },
    []
  );

  // Realtime: keep the wedding fresh as the agent/cron writes rows.
  useEffect(() => {
    if (!event?.id) return;
    const eventId = event.id;
    const channel = supabase
      .channel(`wedding-${eventId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "venues", filter: `event_id=eq.${eventId}` },
        (p) => setVenues((rows) => upsertById(rows, p.new as VenueRow))
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "email_replies", filter: `event_id=eq.${eventId}` },
        (p) => setReplies((rows) => upsertById(rows, p.new as EmailReplyRow))
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reply_proposals", filter: `event_id=eq.${eventId}` },
        (p) => setProposals((rows) => upsertById(rows, p.new as ReplyProposalRow))
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "email_attachments", filter: `event_id=eq.${eventId}` },
        (p) => setAttachments((rows) => upsertById(rows, p.new as EmailAttachmentRow))
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "outbound_emails", filter: `event_id=eq.${eventId}` },
        (p) => setOutbound((rows) => upsertById(rows, p.new as OutboundEmailRow))
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "budget_items", filter: `event_id=eq.${eventId}` },
        (p) =>
          p.eventType === "DELETE"
            ? setBudgetItems((rows) => removeById(rows, (p.old as { id: string }).id))
            : setBudgetItems((rows) => upsertById(rows, p.new as BudgetItemRow))
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "budget_sub_items", filter: `event_id=eq.${eventId}` },
        (p) =>
          p.eventType === "DELETE"
            ? setBudgetSubItems((rows) => removeById(rows, (p.old as { id: string }).id))
            : setBudgetSubItems((rows) => upsertById(rows, p.new as BudgetSubItemRow))
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "day_program_items", filter: `event_id=eq.${eventId}` },
        (p) =>
          p.eventType === "DELETE"
            ? setDayProgramItems((rows) => removeById(rows, (p.old as { id: string }).id))
            : setDayProgramItems((rows) => upsertById(rows, p.new as DayProgramItemRow))
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "guests", filter: `event_id=eq.${eventId}` },
        (p) =>
          p.eventType === "DELETE"
            ? setGuests((rows) => removeById(rows, (p.old as { id: string }).id))
            : setGuests((rows) => upsertById(rows, p.new as GuestRow))
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "timeline_tasks", filter: `event_id=eq.${eventId}` },
        (p) =>
          p.eventType === "DELETE"
            ? setTimelineTasks((rows) => removeById(rows, (p.old as { id: string }).id))
            : setTimelineTasks((rows) => upsertById(rows, p.new as TimelineTaskRow))
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "thank_yous", filter: `event_id=eq.${eventId}` },
        (p) =>
          p.eventType === "DELETE"
            ? setThankYous((rows) => removeById(rows, (p.old as { id: string }).id))
            : setThankYous((rows) => upsertById(rows, p.new as ThankYouRow))
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "moodboard_items", filter: `event_id=eq.${eventId}` },
        (p) =>
          p.eventType === "DELETE"
            ? setMoodboardItems((rows) => removeById(rows, (p.old as { id: string }).id))
            : setMoodboardItems((rows) => upsertById(rows, p.new as MoodboardItemRow))
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "wedding_sites", filter: `event_id=eq.${eventId}` },
        (p) => p.eventType !== "DELETE" && setWeddingSite(p.new as WeddingSiteRow)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "website_designs", filter: `event_id=eq.${eventId}` },
        (p) =>
          p.eventType === "DELETE"
            ? setWebsiteDesigns((rows) => removeById(rows, (p.old as { id: string }).id))
            : setWebsiteDesigns((rows) => upsertById(rows, p.new as WebsiteDesignRow))
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "site_photos", filter: `event_id=eq.${eventId}` },
        (p) =>
          p.eventType === "DELETE"
            ? setSitePhotos((rows) => removeById(rows, (p.old as { id: string }).id))
            : setSitePhotos((rows) => upsertById(rows, p.new as SitePhotoRow))
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "seating_plans", filter: `event_id=eq.${eventId}` },
        (p) => p.eventType !== "DELETE" && setSeatingPlan(p.new as SeatingPlanRow)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "registry_items", filter: `event_id=eq.${eventId}` },
        (p) =>
          p.eventType === "DELETE"
            ? setRegistryItems((rows) => removeById(rows, (p.old as { id: string }).id))
            : setRegistryItems((rows) => upsertById(rows, p.new as RegistryItemRow))
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "registry_claims", filter: `event_id=eq.${eventId}` },
        (p) =>
          p.eventType === "DELETE"
            ? setRegistryClaims((rows) => removeById(rows, (p.old as { id: string }).id))
            : setRegistryClaims((rows) => upsertById(rows, p.new as RegistryClaimRow))
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "invitations", filter: `event_id=eq.${eventId}` },
        (p) =>
          p.eventType === "DELETE"
            ? setInvitations((rows) => removeById(rows, (p.old as { id: string }).id))
            : setInvitations((rows) => upsertById(rows, p.new as InvitationRow))
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "honeymoon_saves", filter: `event_id=eq.${eventId}` },
        (p) =>
          p.eventType === "DELETE"
            ? setHoneymoonSaves((rows) => removeById(rows, (p.old as { id: string }).id))
            : setHoneymoonSaves((rows) => upsertById(rows, p.new as HoneymoonSaveRow))
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, event?.id]);

  const journey = useMemo(() => {
    if (!event) return [];
    const likedVenues = venues.filter((v) => v.swipe_status === "liked").length;
    const quotesIn = replies.filter((r) => r.quote_status === "quoted").length;
    const bookedByCategory: Partial<Record<VendorCategory, number>> = {};
    const contactedByCategory: Partial<Record<VendorCategory, number>> = {};
    const contacted = new Set(outbound.map((o) => o.venue_id));
    for (const v of venues) {
      if (v.booked_at) bookedByCategory[v.category] = (bookedByCategory[v.category] ?? 0) + 1;
      if (contacted.has(v.id)) contactedByCategory[v.category] = (contactedByCategory[v.category] ?? 0) + 1;
    }
    return computeJourney(event, {
      likedVenues,
      quotesIn,
      inviteOrderStatus: inviteOrders[0]?.status ?? null,
      bookedByCategory,
      contactedByCategory,
      unreadReplies: replies.filter((r) => !r.read_at).length,
    });
  }, [event, venues, replies, outbound, inviteOrders]);

  const value = useMemo<WeddingData>(
    () => ({
      loading,
      hasWedding: Boolean(event),
      event,
      profile,
      couple: toCouple(event, profile, email),
      venues,
      drafts,
      outbound,
      replies,
      attachments,
      proposals,
      inviteOrders,
      inviteDesigns,
      invitations,
      journey,
      budgetItems,
      budgetSubItems,
      dayProgramItems,
      guests,
      timelineTasks,
      moodboardItems,
      weddingSite,
      seatingPlan,
      registryItems,
      registryClaims,
      thankYous,
      saveThankYou,
      saveVenueReview,
      honeymoonSaves,
      websiteDesigns,
      websiteDesign: websiteDesigns.find((d) => d.active) ?? null,
      sitePhotos,
      websiteOrders,
      websitePaid: websiteOrders.some((o) => o.status === "paid"),
      refresh: load,
      updateEvent,
      saveBudgetItem,
      deleteBudgetItem,
      addBudgetSubItem,
      updateBudgetSubItem,
      deleteBudgetSubItem,
      seedBudgetSubItems,
      addDayProgramItem,
      updateDayProgramItem,
      deleteDayProgramItem,
      seedDayProgram,
      addGuest,
      updateGuest,
      deleteGuest,
      addTask,
      updateTask,
      deleteTask,
      seedTasks,
      clearTasks,
      addMoodboardItem,
      removeMoodboardItem,
      saveSite,
      saveSeating,
      addRegistryItem,
      updateRegistryItem,
      deleteRegistryItem,
      addHoneymoonSave,
      removeHoneymoonSave,
      setHoneymoonBooked,
      saveInvitation,
    }),
    [
      loading, event, profile, email, venues, drafts, outbound, replies, attachments, proposals,
      inviteOrders, inviteDesigns, invitations, journey, budgetItems, budgetSubItems, dayProgramItems, guests, timelineTasks,
      moodboardItems, weddingSite, seatingPlan, registryItems, registryClaims, honeymoonSaves,
      thankYous, saveThankYou, saveVenueReview,
      websiteDesigns, sitePhotos, websiteOrders, load, updateEvent, saveBudgetItem,
      deleteBudgetItem, addBudgetSubItem, updateBudgetSubItem, deleteBudgetSubItem, seedBudgetSubItems,
      addDayProgramItem, updateDayProgramItem, deleteDayProgramItem, seedDayProgram,
      addGuest, updateGuest, deleteGuest, addTask, updateTask, deleteTask, seedTasks, clearTasks,
      addMoodboardItem, removeMoodboardItem, saveSite, saveSeating,
      addRegistryItem, updateRegistryItem, deleteRegistryItem,
      addHoneymoonSave, removeHoneymoonSave, setHoneymoonBooked, saveInvitation,
    ]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** For /dev harnesses only: render a real screen against a fixture wedding
 *  instead of a Supabase session. See src/app/dev/_fixture/wedding.tsx. */
export const WeddingFixtureProvider = Ctx.Provider;

export function useWedding(): WeddingData {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWedding must be used inside <WeddingProvider>");
  return ctx;
}
