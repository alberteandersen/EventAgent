"use client";

/* A wedding that lives in memory, for /dev harnesses that render a real screen
   (Bordplan, Gæster, Budget) without a Supabase session. The tables a screen
   edits are real state and its writes update them; everything else is empty,
   and every other write is a no-op that resolves. `_fixture` is a private
   folder, so this is never a route. */

import { useMemo, useState } from 'react';
import { WeddingFixtureProvider, type Couple, type WeddingData } from '@/kalas/useWedding';
import { UndoProvider } from '@/kalas/undo';
import type {
  BudgetItemRow, BudgetSubItemRow, DayProgramItemRow, EmailReplyRow, EventRow, GuestRow,
  OutboundEmailRow, RegistryClaimRow, RegistryItemRow, ReplyProposalRow, SeatingPlanRow, TaskKind, ThankMethod, ThankYouRow, TimelineTaskRow, VenueRow, WebsiteDesignRow,
  WeddingSiteRow, InvitationDesignRow
} from '@/lib/db/types';
import type { JourneyStage } from '@/lib/journey';

const now = new Date().toISOString();
let seq = 0;
const id = (prefix: string) => `${prefix}${++seq}`;

export const FIXTURE_COUPLE: Couple = {
  a: 'Emma', b: 'Frederik', dateISO: '2027-09-11', dateLabel: '11. september 2027',
  guests: 80, budgetTotal: 225000, region: 'Fyn', style: 'Rustik elegance', email: 'emma@eksempel.dk',
};

export function guest(name: string, extra: Partial<GuestRow> = {}): GuestRow {
  return {
    id: id('g'), event_id: 'dev', user_id: 'dev', name, side: 'Fælles', email: null, phone: null,
    rsvp: 'ja', meal: null, plus_one: false, notes: null, dietary: null, dietary_tags: [],
    relation: null, overnight: false, no_alcohol: false, plus_one_name: null,
    age_group: 'adult', household_head: null, responded_at: null, rsvp_token: id('tok'), created_at: now,
    ...extra,
  };
}

export function task(title: string, extra: Partial<TimelineTaskRow> = {}): TimelineTaskRow {
  return {
    id: id('t'), event_id: 'dev', user_id: 'dev', title, due_date: null, done: false, category: null,
    kind: 'milestone', notes: null, priority: null, assignee: null, sort: seq, created_at: now,
    ...extra,
  };
}

type TaskDraft = { title: string; due_date?: string | null; category?: string | null; kind?: TaskKind; done?: boolean; sort?: number };

export function FixtureWedding({
  children, guests: initialGuests = [], seating = null, budgetItems: initialItems = [], budgetSubItems: initialSubs = [],
  tasks: initialTasks = [], couple: coupleOverride, event: eventOverride, venues: initialVenues = [], journey = [],
  thankYous: initialThanks = [], registryItems = [], registryClaims = [],
  weddingSite: initialSite = null, dayProgram = [], websiteDesigns = [], invitationDesigns = [],
  outbound = [], replies = [], proposals = [], loading = false, loadError = false,
}: {
  children: React.ReactNode;
  /** The wedding has not arrived yet: what a screen shows before its data. */
  loading?: boolean;
  /** The wedding could not be loaded: the shell's error page. */
  loadError?: boolean;
  guests?: GuestRow[];
  seating?: Record<string, unknown> | null;
  budgetItems?: BudgetItemRow[];
  budgetSubItems?: BudgetSubItemRow[];
  /** Timeline and checklist rows (Planlægning). */
  tasks?: TimelineTaskRow[];
  couple?: Partial<Couple>;
  event?: Partial<EventRow>;
  venues?: VenueRow[];
  journey?: JourneyStage[];
  /** Bryllupsrejse and Nygift. */
  thankYous?: ThankYouRow[];
  registryItems?: RegistryItemRow[];
  registryClaims?: RegistryClaimRow[];
  weddingSite?: Partial<WeddingSiteRow> | null;
  /** Bryllupsdagen. */
  dayProgram?: DayProgramItemRow[];
  /** Newest first; the active one is the site. */
  websiteDesigns?: WebsiteDesignRow[];
  /** Invitationer: versions of the card, one active. */
  invitationDesigns?: InvitationDesignRow[];
  /** Inbox: what Ava sent, what came back, and her proposed answers. */
  outbound?: OutboundEmailRow[];
  replies?: EmailReplyRow[];
  proposals?: ReplyProposalRow[];
}) {
  const [timelineTasks, setTimelineTasks] = useState(initialTasks);
  const [dayProgramItems, setDayProgramItems] = useState<DayProgramItemRow[]>(dayProgram);
  const [guests, setGuests] = useState(initialGuests);
  const [seatingPlan, setSeatingPlan] = useState<SeatingPlanRow | null>(
    seating ? { id: 'sp', event_id: 'dev', user_id: 'dev', data: seating, updated_at: now } as SeatingPlanRow : null,
  );
  const [budgetItems, setBudgetItems] = useState(initialItems);
  const [budgetSubItems, setBudgetSubItems] = useState(initialSubs);
  const [venues] = useState(initialVenues);
  const [thankYous, setThankYous] = useState(initialThanks);
  const [weddingSite, setWeddingSite] = useState(initialSite);

  const value = useMemo(() => {
    const noop = async () => undefined;
    const event = { id: 'dev', user_id: 'dev', title: "Emma & Frederik's wedding", ...eventOverride } as EventRow;
    const base = {
      loading, loadError, event, profile: null, couple: { ...FIXTURE_COUPLE, ...coupleOverride },
      venues, drafts: [], outbound, replies, attachments: [], proposals,
      invitations: [], journey,
      dayProgramItems, timelineTasks, weddingSite,
      registryItems, registryClaims, thankYous,
      websiteDesigns, websiteDesign: websiteDesigns.find((d) => d.active) ?? null, sitePhotos: [], websitePaid: false,
      invitationDesigns, invitationDesign: invitationDesigns.find((d) => d.active) ?? null,
      guests, seatingPlan, budgetItems, budgetSubItems,

      saveSeating: async (data: Record<string, unknown>) => {
        setSeatingPlan({ id: 'sp', event_id: 'dev', user_id: 'dev', data, updated_at: new Date().toISOString() } as SeatingPlanRow);
      },
      addGuest: async (g: Partial<GuestRow> & { name: string }) => {
        const row = guest(g.name, g);
        setGuests((rows) => [...rows, row]);
        return row;
      },
      updateGuest: async (gid: string, patch: Partial<GuestRow>) => {
        setGuests((rows) => rows.map((r) => (r.id === gid ? { ...r, ...patch } : r)));
      },
      deleteGuest: async (gid: string) => setGuests((rows) => rows.filter((r) => r.id !== gid)),

      saveBudgetItem: async (item: Partial<BudgetItemRow> & { category: string; label: string }) => {
        setBudgetItems((rows) => {
          const existing = rows.find((r) => r.category === item.category);
          if (existing) return rows.map((r) => (r === existing ? { ...r, ...item } : r));
          return [...rows, {
            id: id('b'), event_id: 'dev', user_id: 'dev', planned_amount: 0, paid_amount: 0, actual_cost: 0,
            notes: null, reminder_at: null, icon: null, color: null, sort: rows.length, created_at: now, ...item,
          } as BudgetItemRow];
        });
      },
      deleteBudgetItem: async (category: string) => setBudgetItems((rows) => rows.filter((r) => r.category !== category)),
      addBudgetSubItem: async (item: Partial<BudgetSubItemRow> & { category: string; label: string; amount: number }) => {
        const row = { id: id('s'), event_id: 'dev', user_id: 'dev', vendor: null, sort: 0, created_at: now, ...item } as BudgetSubItemRow;
        setBudgetSubItems((rows) => [...rows, row]);
        return row;
      },
      updateBudgetSubItem: async (sid: string, patch: Partial<BudgetSubItemRow>) => {
        setBudgetSubItems((rows) => rows.map((r) => (r.id === sid ? { ...r, ...patch } : r)));
      },
      deleteBudgetSubItem: async (sid: string) => setBudgetSubItems((rows) => rows.filter((r) => r.id !== sid)),

      addDayProgramItem: async (item: Partial<DayProgramItemRow> & { time: string; title: string }) => {
        const row = {
          id: id('d'), event_id: 'dev', user_id: 'dev', subtitle: null, duration_min: 0, owner: null, notes: null,
          sort: seq, created_at: now, ...item,
        } as DayProgramItemRow;
        setDayProgramItems((rows) => [...rows, row]);
        return row;
      },
      updateDayProgramItem: async (did: string, patch: Partial<DayProgramItemRow>) => {
        setDayProgramItems((rows) => rows.map((r) => (r.id === did ? { ...r, ...patch } : r)));
      },
      deleteDayProgramItem: async (did: string) => setDayProgramItems((rows) => rows.filter((r) => r.id !== did)),
      seedDayProgram: async (items: (Partial<DayProgramItemRow> & { time: string; title: string })[]) => {
        setDayProgramItems((rows) => [...rows, ...items.map((item, i) => ({
          id: id('d'), event_id: 'dev', user_id: 'dev', subtitle: null, duration_min: 0, owner: null, notes: null,
          sort: i, created_at: now, ...item,
        } as DayProgramItemRow))]);
      },

      addTask: async (draft: TaskDraft) => {
        const row = task(draft.title, { ...draft, kind: draft.kind ?? 'milestone' });
        setTimelineTasks((rows) => [...rows, row]);
        return row;
      },
      updateTask: async (tid: string, patch: Partial<TimelineTaskRow>) => {
        setTimelineTasks((rows) => rows.map((r) => (r.id === tid ? { ...r, ...patch } : r)));
      },
      deleteTask: async (tid: string) => setTimelineTasks((rows) => rows.filter((r) => r.id !== tid)),
      seedTasks: async (drafts: TaskDraft[]) => {
        setTimelineTasks((rows) => [...rows, ...drafts.map((d, i) => task(d.title, { ...d, kind: d.kind ?? 'milestone', sort: d.sort ?? i }))]);
        return null;
      },
      clearTasks: async (kind: TaskKind) => {
        setTimelineTasks((rows) => rows.filter((r) => (r.kind === 'check' ? 'check' : 'milestone') !== kind));
        return null;
      },
      saveThankYou: async (
        subject_key: string,
        patch: { label: string; gift?: string | null; thanked_at?: string | null; method?: ThankMethod | null; note?: string | null },
      ) => {
        setThankYous((rows) => {
          const existing = rows.find((r) => r.subject_key === subject_key);
          if (existing) return rows.map((r) => (r === existing ? { ...r, ...patch } : r));
          return [...rows, {
            id: id('ty'), event_id: 'dev', user_id: 'dev', subject_key, gift: null, thanked_at: null,
            method: null, note: null, created_at: now, ...patch,
          } as ThankYouRow];
        });
      },
      saveSite: async (patch: Partial<WeddingSiteRow>) => setWeddingSite((site) => ({ ...site, ...patch })),
      seedBudgetSubItems: async (items: { category: string; label: string; amount: number; sort: number }[]) => {
        setBudgetSubItems((rows) => [...rows, ...items.map((item) => ({
          id: id('s'), event_id: 'dev', user_id: 'dev', vendor: null, paid: false, created_at: now, ...item,
        } as BudgetSubItemRow))]);
        return true;
      },
    };
    // Every write a harness does not model resolves and does nothing.
    return new Proxy(base, {
      get: (target, key) => (key in target ? target[key as keyof typeof target] : noop),
    }) as unknown as WeddingData;
  }, [
    guests, seatingPlan, budgetItems, budgetSubItems, timelineTasks, dayProgramItems, coupleOverride, eventOverride,
    venues, journey, thankYous, registryItems, registryClaims, weddingSite, websiteDesigns,
    outbound, replies, proposals, loading, loadError,
  ]);

  return (
    <WeddingFixtureProvider value={value}>
      <UndoProvider>{children}</UndoProvider>
    </WeddingFixtureProvider>
  );
}
