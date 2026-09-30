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
import { useLang } from "./i18n";
import { showError } from "./notice";
import type {
  BudgetItemRow,
  BudgetSubItemRow,
  DayProgramItemRow,
  EmailAttachmentRow,
  EmailDraftRow,
  EmailReplyRow,
  EventRow,
  GuestRow,
  InvitationDesignRow,
  InvitationRow,
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
  /** The wedding could not be loaded (network, session, or a core table
   *  failing) and there is nothing to show yet. The shell shows it instead of
   *  an empty wedding, which screens would otherwise start seeding. */
  loadError: boolean;
  event: EventRow | null;
  profile: ProfileRow | null;
  couple: Couple;
  venues: VenueRow[];
  drafts: EmailDraftRow[];
  outbound: OutboundEmailRow[];
  replies: EmailReplyRow[];
  attachments: EmailAttachmentRow[];
  proposals: ReplyProposalRow[];
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
  weddingSite: WeddingSiteRow | null;
  seatingPlan: SeatingPlanRow | null;
  registryItems: RegistryItemRow[];
  registryClaims: RegistryClaimRow[];
  thankYous: ThankYouRow[];
  /** Upserts the couple's annotation for one person on the thank-you list. */
  saveThankYou: (
    subjectKey: string,
    patch: { label: string; gift?: string | null; thanked_at?: string | null; method?: ThankMethod | null; note?: string | null }
  ) => Promise<void>;
  /** All generations, newest first; the active one drives the live site. */
  websiteDesigns: WebsiteDesignRow[];
  websiteDesign: WebsiteDesignRow | null;
  sitePhotos: SitePhotoRow[];
  websitePaid: boolean;
  /** Every version of the invitation's look, newest first; one is active. */
  invitationDesigns: InvitationDesignRow[];
  invitationDesign: InvitationDesignRow | null;

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

  saveSite: (patch: { config?: Record<string, unknown>; domain?: string | null; published?: boolean }) => Promise<void>;
  saveSeating: (data: Record<string, unknown>) => Promise<void>;

  addRegistryItem: (item: Partial<RegistryItemRow> & { title: string }) => Promise<RegistryItemRow | null>;
  updateRegistryItem: (id: string, patch: Partial<RegistryItemRow>) => Promise<void>;
  deleteRegistryItem: (id: string) => Promise<void>;

  /** Create/update a digital invitation via /api/invitations (assigns a unique
      share slug server-side). Returns the saved row. */
  saveInvitation: (input: {
    id?: string;
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
  const [loadError, setLoadError] = useState(false);
  const loadedOnce = React.useRef(false);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [event, setEvent] = useState<EventRow | null>(null);
  const [email, setEmail] = useState("");
  const [venues, setVenues] = useState<VenueRow[]>([]);
  const [drafts, setDrafts] = useState<EmailDraftRow[]>([]);
  const [outbound, setOutbound] = useState<OutboundEmailRow[]>([]);
  const [replies, setReplies] = useState<EmailReplyRow[]>([]);
  const [attachments, setAttachments] = useState<EmailAttachmentRow[]>([]);
  const [proposals, setProposals] = useState<ReplyProposalRow[]>([]);
  const [invitations, setInvitations] = useState<InvitationRow[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [budgetItems, setBudgetItems] = useState<BudgetItemRow[]>([]);
  const [budgetSubItems, setBudgetSubItems] = useState<BudgetSubItemRow[]>([]);
  const [dayProgramItems, setDayProgramItems] = useState<DayProgramItemRow[]>([]);
  const [guests, setGuests] = useState<GuestRow[]>([]);
  const [timelineTasks, setTimelineTasks] = useState<TimelineTaskRow[]>([]);
  const [weddingSite, setWeddingSite] = useState<WeddingSiteRow | null>(null);
  const [seatingPlan, setSeatingPlan] = useState<SeatingPlanRow | null>(null);
  const [registryItems, setRegistryItems] = useState<RegistryItemRow[]>([]);
  const [registryClaims, setRegistryClaims] = useState<RegistryClaimRow[]>([]);
  const [thankYous, setThankYous] = useState<ThankYouRow[]>([]);
  const [websiteDesigns, setWebsiteDesigns] = useState<WebsiteDesignRow[]>([]);
  const [sitePhotos, setSitePhotos] = useState<SitePhotoRow[]>([]);
  const [websiteOrders, setWebsiteOrders] = useState<WebsiteOrderRow[]>([]);
  const [invitationDesigns, setInvitationDesigns] = useState<InvitationDesignRow[]>([]);

  const load = useCallback(async () => {
    /* Throws when the wedding cannot be trusted: no network, no session, or
       one of the queries failing. A table that does not exist yet (a migration
       not run on this database) is not a failure; it loads empty, as before. */
    const loadWedding = async () => {
      const check = (result: { error: { code?: string; message: string } | null }, what: string) => {
        const err = result.error;
        if (!err) return;
        if (err.code === "42P01" || err.code === "PGRST205") {
          console.warn(`[useWedding] ${what}: table missing, loading empty`, err.message);
          return;
        }
        throw new Error(`${what}: ${err.message}`);
      };

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setEmail(user.email ?? "");
      setUserId(user.id);

      const profileResult = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      check(profileResult, "profiles");
      const profileRow = profileResult.data;
      setProfile((profileRow as ProfileRow | null) ?? null);

      // The active wedding: profile pointer, else the most recent event.
      let ev: EventRow | null = null;
      const activeId = (profileRow as ProfileRow | null)?.active_event_id;
      if (activeId) {
        const result = await supabase.from("events").select("*").eq("id", activeId).maybeSingle();
        check(result, "events");
        ev = (result.data as EventRow | null) ?? null;
      }
      if (!ev) {
        const result = await supabase
          .from("events")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        check(result, "events");
        ev = (result.data as EventRow | null) ?? null;
      }
      setEvent(ev);

      if (ev) {
        const [v, d, o, r, at, p, bi, bsi, dpi, g, tt, ws, sp, ri, rc, wd, sph, wo, inv, ty, ivd] = await Promise.all([
          supabase.from("venues").select("*").eq("event_id", ev.id).order("created_at"),
          supabase.from("email_drafts").select("*").eq("event_id", ev.id),
          supabase.from("outbound_emails").select("*").eq("event_id", ev.id).order("created_at"),
          supabase.from("email_replies").select("*").eq("event_id", ev.id).order("created_at"),
          supabase.from("email_attachments").select("*").eq("event_id", ev.id).order("created_at"),
          supabase.from("reply_proposals").select("*").eq("event_id", ev.id).order("created_at"),
          supabase.from("budget_items").select("*").eq("event_id", ev.id).order("sort"),
          supabase.from("budget_sub_items").select("*").eq("event_id", ev.id).order("sort").order("created_at"),
          supabase.from("day_program_items").select("*").eq("event_id", ev.id).order("time"),
          supabase.from("guests").select("*").eq("event_id", ev.id).order("created_at"),
          supabase.from("timeline_tasks").select("*").eq("event_id", ev.id).order("sort").order("due_date"),
          supabase.from("wedding_sites").select("*").eq("event_id", ev.id).maybeSingle(),
          supabase.from("seating_plans").select("*").eq("event_id", ev.id).maybeSingle(),
          supabase.from("registry_items").select("*").eq("event_id", ev.id).order("sort"),
          supabase.from("registry_claims").select("*").eq("event_id", ev.id).order("created_at"),
          supabase.from("website_designs").select("*").eq("event_id", ev.id).order("created_at", { ascending: false }),
          supabase.from("site_photos").select("*").eq("event_id", ev.id).order("sort").order("created_at"),
          supabase.from("website_orders").select("*").eq("event_id", ev.id).order("created_at", { ascending: false }),
          supabase.from("invitations").select("*").eq("event_id", ev.id).order("created_at", { ascending: false }),
          supabase.from("thank_yous").select("*").eq("event_id", ev.id).order("created_at"),
          supabase.from("invitation_designs").select("*").eq("event_id", ev.id).order("created_at", { ascending: false }),
        ]);
        const names = ["venues", "email_drafts", "outbound_emails", "email_replies", "email_attachments", "reply_proposals",
          "budget_items", "budget_sub_items", "day_program_items", "guests", "timeline_tasks", "wedding_sites", "seating_plans",
          "registry_items", "registry_claims", "website_designs", "site_photos", "website_orders", "invitations", "thank_yous",
          "invitation_designs"];
        [v, d, o, r, at, p, bi, bsi, dpi, g, tt, ws, sp, ri, rc, wd, sph, wo, inv, ty, ivd].forEach((result, i) => check(result, names[i]));
        setVenues((v.data ?? []) as VenueRow[]);
        setDrafts((d.data ?? []) as EmailDraftRow[]);
        setOutbound((o.data ?? []) as OutboundEmailRow[]);
        setReplies((r.data ?? []) as EmailReplyRow[]);
        setAttachments((at.data ?? []) as EmailAttachmentRow[]);
        setProposals((p.data ?? []) as ReplyProposalRow[]);
        setBudgetItems((bi.data ?? []) as BudgetItemRow[]);
        setBudgetSubItems((bsi.data ?? []) as BudgetSubItemRow[]);
        setDayProgramItems((dpi.data ?? []) as DayProgramItemRow[]);
        setGuests((g.data ?? []) as GuestRow[]);
        setTimelineTasks((tt.data ?? []) as TimelineTaskRow[]);
        setWeddingSite((ws.data as WeddingSiteRow | null) ?? null);
        setSeatingPlan((sp.data as SeatingPlanRow | null) ?? null);
        setRegistryItems((ri.data ?? []) as RegistryItemRow[]);
        setRegistryClaims((rc.data ?? []) as RegistryClaimRow[]);
        setThankYous((ty.data ?? []) as ThankYouRow[]);
        setWebsiteDesigns((wd.data ?? []) as WebsiteDesignRow[]);
        setSitePhotos((sph.data ?? []) as SitePhotoRow[]);
        setWebsiteOrders((wo.data ?? []) as WebsiteOrderRow[]);
        setInvitations((inv.data ?? []) as InvitationRow[]);
        setInvitationDesigns((ivd.data ?? []) as InvitationDesignRow[]);
      }
    };

    try {
      await loadWedding();
      loadedOnce.current = true;
      setLoadError(false);
    } catch (err) {
      console.error("[useWedding] load failed", err);
      // A failed refresh keeps the wedding already on screen; only a first
      // load with nothing to show becomes the error page.
      if (!loadedOnce.current) setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetching the wedding is what this effect is for
    void load();
  }, [load]);

  // ── Mutators ────────────────────────────────────────────────────────────
  // Simple user-owned CRUD writes straight through the browser client (RLS
  // scopes every row to auth.uid()); local state updates optimistically from
  // the returned row, and realtime reconciles other tabs.
  const eventId = event?.id ?? null;

  // A write that fails says so, once, instead of the change quietly not
  // sticking (or, for a delete, vanishing until the next reload).
  const { t } = useLang();
  const tRef = React.useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);
  const writeFailed = useCallback((what: string, error: { message: string } | null): boolean => {
    if (!error) return false;
    console.error(`[useWedding] ${what} failed:`, error.message);
    showError(tRef.current("Det blev ikke gemt"), tRef.current("Tjek forbindelsen, og prøv igen."));
    return true;
  }, []);

  const updateEvent = useCallback(
    async (patch: Partial<EventRow>) => {
      if (!eventId) return;
      const { data, error } = await supabase.from("events").update(patch).eq("id", eventId).select().single();
      writeFailed("events update", error);
      if (data) setEvent(data as EventRow);
    },
    [supabase, eventId, writeFailed]
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
        const { data, error } = await supabase
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
        writeFailed("budget_items update", error);
        if (data) setBudgetItems((rows) => upsertById(rows, data as BudgetItemRow));
      } else {
        const { data, error } = await supabase
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
        writeFailed("budget_items insert", error);
        if (data) setBudgetItems((rows) => upsertById(rows, data as BudgetItemRow));
      }
    },
    [supabase, eventId, userId, budgetItems, writeFailed]
  );

  const deleteBudgetItem = useCallback(
    async (category: string) => {
      const existing = budgetItems.find((b) => b.category === category);
      if (!existing) return;
      const { error } = await supabase.from("budget_items").delete().eq("id", existing.id);
      if (writeFailed("budget_items delete", error)) return;
      setBudgetItems((rows) => removeById(rows, existing.id));
    },
    [supabase, budgetItems, writeFailed]
  );

  const addBudgetSubItem = useCallback(
    async (item: { category: string; label: string; vendor?: string | null; amount: number; sort?: number }) => {
      if (!eventId || !userId) return null;
      const { data, error } = await supabase
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
      writeFailed("budget_sub_items insert", error);
      if (data) setBudgetSubItems((rows) => upsertById(rows, data as BudgetSubItemRow));
      return (data as BudgetSubItemRow) ?? null;
    },
    [supabase, eventId, userId, writeFailed]
  );

  const updateBudgetSubItem = useCallback(
    async (id: string, patch: Partial<Pick<BudgetSubItemRow, 'label' | 'vendor' | 'amount' | 'sort' | 'paid'>>) => {
      // Optimistic: a tick should land the moment it is pressed.
      setBudgetSubItems((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
      const { data, error } = await supabase.from("budget_sub_items").update(patch).eq("id", id).select().single();
      writeFailed("budget_sub_items update", error);
      if (data) setBudgetSubItems((rows) => upsertById(rows, data as BudgetSubItemRow));
    },
    [supabase, writeFailed]
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
      const { error } = await supabase.from("budget_sub_items").delete().eq("id", id);
      if (writeFailed("budget_sub_items delete", error)) return;
      setBudgetSubItems((rows) => removeById(rows, id));
    },
    [supabase, writeFailed]
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
      writeFailed("day_program_items insert", error);
      if (data) setDayProgramItems((rows) => upsertById(rows, data as DayProgramItemRow));
      return (data as DayProgramItemRow) ?? null;
    },
    [supabase, eventId, userId, writeFailed]
  );

  const seedDayProgram = useCallback(
    async (items: { time: string; title: string; subtitle?: string | null; duration_min?: number; owner?: string | null }[]) => {
      if (!eventId || !userId || items.length === 0) return;
      const { data, error } = await supabase
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
      writeFailed("day_program_items insert", error);
      if (data) setDayProgramItems((rows) => (data as DayProgramItemRow[]).reduce((acc, r) => upsertById(acc, r), rows));
    },
    [supabase, eventId, userId, writeFailed]
  );

  const updateDayProgramItem = useCallback(
    async (id: string, patch: Partial<Pick<DayProgramItemRow, 'time' | 'title' | 'subtitle' | 'duration_min' | 'owner' | 'notes' | 'sort'>>) => {
      const { data, error } = await supabase.from("day_program_items").update(patch).eq("id", id).select().single();
      writeFailed("day_program_items update", error);
      if (data) setDayProgramItems((rows) => upsertById(rows, data as DayProgramItemRow));
    },
    [supabase, writeFailed]
  );

  const deleteDayProgramItem = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("day_program_items").delete().eq("id", id);
      if (writeFailed("day_program_items delete", error)) return;
      setDayProgramItems((rows) => removeById(rows, id));
    },
    [supabase, writeFailed]
  );

  const addGuest = useCallback(
    async (guest: Partial<GuestRow> & { name: string }) => {
      if (!eventId || !userId) return null;
      const { data, error } = await supabase
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
      writeFailed("guests insert", error);
      if (data) setGuests((rows) => upsertById(rows, data as GuestRow));
      return (data as GuestRow) ?? null;
    },
    [supabase, eventId, userId, writeFailed]
  );

  const updateGuest = useCallback(
    async (id: string, patch: Partial<GuestRow>) => {
      const { data, error } = await supabase.from("guests").update(patch).eq("id", id).select().single();
      writeFailed("guests update", error);
      if (data) setGuests((rows) => upsertById(rows, data as GuestRow));
    },
    [supabase, writeFailed]
  );

  const deleteGuest = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("guests").delete().eq("id", id);
      if (writeFailed("guests delete", error)) return;
      setGuests((rows) => removeById(rows, id));
    },
    [supabase, writeFailed]
  );

  const addTask = useCallback(
    async (task: { title: string; due_date?: string | null; category?: string | null; kind?: TaskKind; sort?: number; done?: boolean }) => {
      if (!eventId || !userId) return null;
      const { data, error } = await supabase
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
      writeFailed("timeline_tasks insert", error);
      if (data) setTimelineTasks((rows) => upsertById(rows, data as TimelineTaskRow));
      return (data as TimelineTaskRow) ?? null;
    },
    [supabase, eventId, userId, writeFailed]
  );

  const updateTask = useCallback(
    async (id: string, patch: Partial<TimelineTaskRow>) => {
      const { data, error } = await supabase.from("timeline_tasks").update(patch).eq("id", id).select().single();
      writeFailed("timeline_tasks update", error);
      if (data) setTimelineTasks((rows) => upsertById(rows, data as TimelineTaskRow));
    },
    [supabase, writeFailed]
  );

  const deleteTask = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("timeline_tasks").delete().eq("id", id);
      if (writeFailed("timeline_tasks delete", error)) return;
      setTimelineTasks((rows) => removeById(rows, id));
    },
    [supabase, writeFailed]
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
      const { data, error } = await supabase
        .from("thank_yous")
        .upsert(
          { event_id: eventId, user_id: userId, subject_key: subjectKey, ...patch },
          { onConflict: "event_id,subject_key" }
        )
        .select()
        .single();
      writeFailed("thank_yous upsert", error);
      if (data) setThankYous((rows) => upsertById(rows, data as ThankYouRow));
    },
    [supabase, eventId, userId, writeFailed]
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

  // Read the latest site via a ref so saveSite keeps a stable identity — it is
  // called from a debounced autosave effect, and depending on `weddingSite`
  // here would re-fire that effect on every save (an infinite save loop).
  const weddingSiteRef = React.useRef(weddingSite);
  useEffect(() => {
    weddingSiteRef.current = weddingSite;
  }, [weddingSite]);
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
      const { data, error } = await supabase
        .from("wedding_sites")
        .upsert(row, { onConflict: "event_id" })
        .select()
        .single();
      writeFailed("wedding_sites upsert", error);
      if (data) setWeddingSite(data as WeddingSiteRow);
    },
    [supabase, eventId, userId, writeFailed]
  );

  const saveSeating = useCallback(
    async (data: Record<string, unknown>) => {
      if (!eventId || !userId) return;
      const { data: row, error } = await supabase
        .from("seating_plans")
        .upsert(
          { event_id: eventId, user_id: userId, data, updated_at: new Date().toISOString() },
          { onConflict: "event_id" }
        )
        .select()
        .single();
      writeFailed("seating_plans upsert", error);
      if (row) setSeatingPlan(row as SeatingPlanRow);
    },
    [supabase, eventId, userId, writeFailed]
  );

  const addRegistryItem = useCallback(
    async (item: Partial<RegistryItemRow> & { title: string }) => {
      if (!eventId || !userId) return null;
      const { data, error } = await supabase
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
      writeFailed("registry_items insert", error);
      if (data) setRegistryItems((rows) => upsertById(rows, data as RegistryItemRow));
      return (data as RegistryItemRow) ?? null;
    },
    [supabase, eventId, userId, writeFailed]
  );

  const updateRegistryItem = useCallback(
    async (id: string, patch: Partial<RegistryItemRow>) => {
      const { data, error } = await supabase.from("registry_items").update(patch).eq("id", id).select().single();
      writeFailed("registry_items update", error);
      if (data) setRegistryItems((rows) => upsertById(rows, data as RegistryItemRow));
    },
    [supabase, writeFailed]
  );

  const deleteRegistryItem = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("registry_items").delete().eq("id", id);
      if (writeFailed("registry_items delete", error)) return;
      setRegistryItems((rows) => removeById(rows, id));
    },
    [supabase, writeFailed]
  );

  const saveInvitation = useCallback(
    async (input: { id?: string; data: Record<string, unknown>; publish?: boolean }) => {
      const res = await fetch("/api/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }).catch(() => null);
      if (!res?.ok) {
        writeFailed("invitations save", { message: res ? `HTTP ${res.status}` : "network" });
        return null;
      }
      const row = (await res.json()) as InvitationRow;
      setInvitations((rows) => upsertById(rows, row));
      return row;
    },
    [writeFailed]
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
        { event: "*", schema: "public", table: "invitation_designs", filter: `event_id=eq.${eventId}` },
        (p) =>
          p.eventType === "DELETE"
            ? setInvitationDesigns((rows) => removeById(rows, (p.old as { id: string }).id))
            : setInvitationDesigns((rows) => upsertById(rows, p.new as InvitationDesignRow))
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
      invitationExported: invitations.some((i) => i.status === "published"),
      bookedByCategory,
      contactedByCategory,
      unreadReplies: replies.filter((r) => !r.read_at).length,
    });
  }, [event, venues, replies, outbound, invitations]);

  const value = useMemo<WeddingData>(
    () => ({
      loading,
      loadError,
      event,
      profile,
      couple: toCouple(event, profile, email),
      venues,
      drafts,
      outbound,
      replies,
      attachments,
      proposals,
      invitations,
      journey,
      budgetItems,
      budgetSubItems,
      dayProgramItems,
      guests,
      timelineTasks,
      weddingSite,
      seatingPlan,
      registryItems,
      registryClaims,
      thankYous,
      saveThankYou,
      websiteDesigns,
      websiteDesign: websiteDesigns.find((d) => d.active) ?? null,
      sitePhotos,
      websitePaid: websiteOrders.some((o) => o.status === "paid"),
      invitationDesigns,
      invitationDesign: invitationDesigns.find((d) => d.active) ?? null,
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
      saveSite,
      saveSeating,
      addRegistryItem,
      updateRegistryItem,
      deleteRegistryItem,
      saveInvitation,
    }),
    [
      loading, loadError, event, profile, email, venues, drafts, outbound, replies, attachments, proposals,
      invitations, journey, budgetItems, budgetSubItems, dayProgramItems, guests, timelineTasks,
      weddingSite, seatingPlan, registryItems, registryClaims,
      thankYous, saveThankYou,
      websiteDesigns, sitePhotos, websiteOrders, invitationDesigns, load, updateEvent, saveBudgetItem,
      deleteBudgetItem, addBudgetSubItem, updateBudgetSubItem, deleteBudgetSubItem, seedBudgetSubItems,
      addDayProgramItem, updateDayProgramItem, deleteDayProgramItem, seedDayProgram,
      addGuest, updateGuest, deleteGuest, addTask, updateTask, deleteTask, seedTasks, clearTasks,
      saveSite, saveSeating,
      addRegistryItem, updateRegistryItem, deleteRegistryItem,
      saveInvitation,
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
