"use client";

/* A wedding that lives in memory, for /dev harnesses that render a real screen
   (Bordplan, Gæster, Budget) without a Supabase session. The tables a screen
   edits are real state and its writes update them; everything else is empty,
   and every other write is a no-op that resolves. `_fixture` is a private
   folder, so this is never a route. */

import { useMemo, useState } from 'react';
import { WeddingFixtureProvider, type Couple, type WeddingData } from '@/kalas/useWedding';
import type { BudgetItemRow, BudgetSubItemRow, EventRow, GuestRow, SeatingPlanRow } from '@/lib/db/types';

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

export function FixtureWedding({
  children, guests: initialGuests = [], seating = null, budgetItems: initialItems = [], budgetSubItems: initialSubs = [],
}: {
  children: React.ReactNode;
  guests?: GuestRow[];
  seating?: Record<string, unknown> | null;
  budgetItems?: BudgetItemRow[];
  budgetSubItems?: BudgetSubItemRow[];
}) {
  const [guests, setGuests] = useState(initialGuests);
  const [seatingPlan, setSeatingPlan] = useState<SeatingPlanRow | null>(
    seating ? { id: 'sp', event_id: 'dev', user_id: 'dev', data: seating, updated_at: now } as SeatingPlanRow : null,
  );
  const [budgetItems, setBudgetItems] = useState(initialItems);
  const [budgetSubItems, setBudgetSubItems] = useState(initialSubs);

  const value = useMemo(() => {
    const noop = async () => undefined;
    const event = { id: 'dev', user_id: 'dev', title: "Emma & Frederik's wedding" } as EventRow;
    const base = {
      loading: false, hasWedding: true, event, profile: null, couple: FIXTURE_COUPLE,
      venues: [], drafts: [], outbound: [], replies: [], attachments: [], proposals: [],
      inviteOrders: [], inviteDesigns: [], invitations: [], journey: [],
      dayProgramItems: [], timelineTasks: [], moodboardItems: [], weddingSite: null,
      registryItems: [], registryClaims: [], thankYous: [], honeymoonSaves: [],
      websiteDesigns: [], websiteDesign: null, sitePhotos: [], websiteOrders: [], websitePaid: false,
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
  }, [guests, seatingPlan, budgetItems, budgetSubItems]);

  return <WeddingFixtureProvider value={value}>{children}</WeddingFixtureProvider>;
}
