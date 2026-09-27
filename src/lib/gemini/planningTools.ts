import type { SupabaseClient } from "@supabase/supabase-js";
import { Type, type FunctionDeclaration } from "@google/genai";
import type {
  BudgetItemRow,
  EventRow,
  GuestRow,
  RegistryItemRow,
  TimelineTaskRow,
  VenueRow,
} from "@/lib/db/types";

/*
 * The agent's read/write surface over the couple's planning data in Supabase
 * (budget, guests, timeline tasks, registry, vendor board, website state).
 * Every executor writes through the caller's RLS-scoped client, so the agent
 * can only ever touch the signed-in couple's own rows — and the app's
 * realtime subscriptions pick the changes up live on whatever screen is open.
 */

export const planningFunctionDeclarations: FunctionDeclaration[] = [
  {
    name: "get_planning_overview",
    description:
      "Live snapshot of the whole wedding: budget totals, guest/RSVP counts, vendor board by category, tasks, registry, website and inbox state. Call this before answering questions about status, progress, money or 'what's missing', never guess numbers.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: "list_vendors",
    description:
      "List the venues/vendors on the couple's board with ids, swipe status, booking state and quotes. Use it to find the venue_id for mark_venue_chosen, mark_vendor_booked, swipe_vendor or outreach tools.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        category: {
          type: Type.STRING,
          enum: ["venue", "florist", "photographer", "musician", "caterer", "planner", "other"],
          description: "Only this category. Omit for all.",
        },
        status: {
          type: Type.STRING,
          enum: ["pending", "liked", "rejected", "booked"],
          description: "Only this swipe/booking status. Omit for all.",
        },
      },
    },
  },
  {
    name: "swipe_vendor",
    description:
      "Shortlist or pass on a vendor/venue card on the couple's behalf when they decide in chat ('shortlist the first two', 'drop the castle one'). liked = shortlist, rejected = pass, pending = back to undecided.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        venue_id: { type: Type.STRING },
        decision: { type: Type.STRING, enum: ["liked", "rejected", "pending"] },
      },
      required: ["venue_id", "decision"],
    },
  },
  {
    name: "list_budget",
    description: "The couple's budget: total plus every category with planned and paid amounts (DKK).",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: "set_budget_entry",
    description:
      "Create or update one budget category. Amounts are plain DKK integers. Standard category ids: venue, catering, photo, florals, music, attire, misc, reuse them when the meaning matches so the Budget page groups correctly; invent a short slug for new categories. Only pass the amounts you intend to change.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        category: { type: Type.STRING, description: "Stable category id/slug, e.g. 'venue' or 'transport'" },
        label: { type: Type.STRING, description: "Display name, e.g. 'Transport & shuttle'" },
        planned_amount: { type: Type.INTEGER, description: "Planned/budgeted amount in DKK" },
        paid_amount: { type: Type.INTEGER, description: "Amount already paid in DKK" },
      },
      required: ["category"],
    },
  },
  {
    name: "delete_budget_entry",
    description: "Remove a budget category the couple no longer wants tracked.",
    parameters: {
      type: Type.OBJECT,
      properties: { category: { type: Type.STRING, description: "The category id/slug to remove" } },
      required: ["category"],
    },
  },
  {
    name: "list_guests",
    description: "The guest list with ids, RSVP status, sides and plus-ones.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        rsvp: {
          type: Type.STRING,
          enum: ["ja", "nej", "afventer"],
          description: "Only guests with this RSVP status. Omit for all.",
        },
      },
    },
  },
  {
    name: "add_guests",
    description:
      "Add one or many guests in a single call ('add my parents Bo and Lise'). rsvp values: 'ja' (yes), 'nej' (no), 'afventer' (awaiting, default). side is free text, 'Fælles' (shared, default) or one partner's name.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        guests: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              side: { type: Type.STRING },
              email: { type: Type.STRING },
              phone: { type: Type.STRING },
              rsvp: { type: Type.STRING, enum: ["ja", "nej", "afventer"] },
              plus_one: { type: Type.BOOLEAN },
              meal: { type: Type.STRING, description: "Meal/dietary choice if known" },
              notes: { type: Type.STRING },
            },
            required: ["name"],
          },
        },
      },
      required: ["guests"],
    },
  },
  {
    name: "update_guest",
    description:
      "Update one guest, record an RSVP ('Anna said yes' → rsvp 'ja'), fix contact info, toggle a plus-one. Pass guest_id from list_guests, or just the guest's name and I'll match it.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        guest_id: { type: Type.STRING },
        name: { type: Type.STRING, description: "Guest name to match when guest_id is unknown" },
        new_name: { type: Type.STRING, description: "Corrected name, when renaming" },
        side: { type: Type.STRING },
        email: { type: Type.STRING },
        phone: { type: Type.STRING },
        rsvp: { type: Type.STRING, enum: ["ja", "nej", "afventer"] },
        plus_one: { type: Type.BOOLEAN },
        plus_one_name: { type: Type.STRING },
        meal: { type: Type.STRING },
        notes: { type: Type.STRING },
      },
    },
  },
  {
    name: "remove_guest",
    description: "Remove a guest from the list. Pass guest_id, or the name and I'll match it.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        guest_id: { type: Type.STRING },
        name: { type: Type.STRING },
      },
    },
  },
  {
    name: "list_tasks",
    description:
      "The couple's planning tasks with ids, due dates and done state. Defaults to the big dated milestones; pass kind='check' for the granular checklist (~205 items, grouped by area). A check that has been given a due date also shows on the couple's timeline.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        kind: {
          type: Type.STRING,
          description: "'milestone' (default) or 'check'",
        },
      },
    },
  },
  {
    name: "add_tasks",
    description:
      "Add one or many timeline/to-do tasks in a single call. Use for concrete follow-ups the couple agrees to ('book prøvesmagning i maj').",
    parameters: {
      type: Type.OBJECT,
      properties: {
        tasks: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              due_date: { type: Type.STRING, description: "ISO date YYYY-MM-DD" },
              category: { type: Type.STRING, description: "Short grouping label, e.g. 'venue', 'catering'" },
            },
            required: ["title"],
          },
        },
      },
      required: ["tasks"],
    },
  },
  {
    name: "update_task",
    description:
      "Update a task, mark it done when the couple says they finished something, or move its due date. Pass task_id from list_tasks, or the title and I'll match it.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        task_id: { type: Type.STRING },
        title: { type: Type.STRING, description: "Task title to match when task_id is unknown" },
        new_title: { type: Type.STRING },
        due_date: { type: Type.STRING, description: "ISO date YYYY-MM-DD" },
        done: { type: Type.BOOLEAN },
      },
    },
  },
  {
    name: "delete_task",
    description: "Delete a task. Pass task_id, or the title and I'll match it.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        task_id: { type: Type.STRING },
        title: { type: Type.STRING },
      },
    },
  },
  {
    name: "list_registry",
    description: "The couple's gift registry (ønskeliste) items with ids, prices and claim counts.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: "add_registry_items",
    description:
      "Add one or many gift-registry items in a single call. Prices are DKK (whole kroner, not øre).",
    parameters: {
      type: Type.OBJECT,
      properties: {
        items: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              price: { type: Type.INTEGER, description: "Price in DKK" },
              product_url: { type: Type.STRING },
              store_name: { type: Type.STRING },
              quantity: { type: Type.INTEGER, description: "How many the couple wishes for (default 1)" },
            },
            required: ["title"],
          },
        },
      },
      required: ["items"],
    },
  },
  {
    name: "update_registry_item",
    description:
      "Update a registry item (price, quantity, link…). Pass item_id from list_registry, or the title and I'll match it.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        item_id: { type: Type.STRING },
        title: { type: Type.STRING, description: "Item title to match when item_id is unknown" },
        new_title: { type: Type.STRING },
        description: { type: Type.STRING },
        price: { type: Type.INTEGER, description: "Price in DKK" },
        product_url: { type: Type.STRING },
        store_name: { type: Type.STRING },
        quantity: { type: Type.INTEGER },
      },
    },
  },
  {
    name: "delete_registry_item",
    description: "Remove a registry item. Pass item_id, or the title and I'll match it.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        item_id: { type: Type.STRING },
        title: { type: Type.STRING },
      },
    },
  },
];

/**
 * Execute one planning tool call. Returns null when `name` is not a planning
 * tool, so the caller can fall through to its own executors.
 */
export async function execPlanningTool(
  supabase: SupabaseClient,
  event: EventRow,
  name: string,
  args: Record<string, unknown>
): Promise<Record<string, unknown> | null> {
  switch (name) {
    case "get_planning_overview":
      return execPlanningOverview(supabase, event);
    case "list_vendors":
      return execListVendors(supabase, event, args);
    case "swipe_vendor":
      return execSwipeVendor(supabase, event, args);
    case "list_budget":
      return execListBudget(supabase, event);
    case "set_budget_entry":
      return execSetBudgetEntry(supabase, event, args);
    case "delete_budget_entry":
      return execDeleteBudgetEntry(supabase, event, args);
    case "list_guests":
      return execListGuests(supabase, event, args);
    case "add_guests":
      return execAddGuests(supabase, event, args);
    case "update_guest":
      return execUpdateGuest(supabase, event, args);
    case "remove_guest":
      return execRemoveGuest(supabase, event, args);
    case "list_tasks":
      return execListTasks(supabase, event, args);
    case "add_tasks":
      return execAddTasks(supabase, event, args);
    case "update_task":
      return execUpdateTask(supabase, event, args);
    case "delete_task":
      return execDeleteTask(supabase, event, args);
    case "list_registry":
      return execListRegistry(supabase, event);
    case "add_registry_items":
      return execAddRegistryItems(supabase, event, args);
    case "update_registry_item":
      return execUpdateRegistryItem(supabase, event, args);
    case "delete_registry_item":
      return execDeleteRegistryItem(supabase, event, args);
    default:
      return null;
  }
}

// ── Shared helpers ──────────────────────────────────────────────────────

const str = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim() ? v.trim() : undefined;
// Lenient: the model occasionally sends numbers as strings ("5000").
const int = (v: unknown): number | undefined => {
  if (typeof v === "number" && Number.isFinite(v)) return Math.round(v);
  if (typeof v === "string" && v.trim() && !Number.isNaN(Number(v))) {
    return Math.round(Number(v));
  }
  return undefined;
};

/**
 * Resolve a row by id or (case-insensitive, then substring) name match.
 * Returns an error record when nothing or several rows match, so the model
 * can recover by asking or listing.
 */
async function findRow<T extends { id: string }>(
  supabase: SupabaseClient,
  event: EventRow,
  table: string,
  nameColumn: string,
  args: Record<string, unknown>,
  idKey: string,
  nameKey: string
): Promise<{ row?: T; error?: string }> {
  const id = str(args[idKey]);
  if (id) {
    const { data } = await supabase
      .from(table)
      .select("*")
      .eq("id", id)
      .eq("event_id", event.id)
      .maybeSingle();
    if (data) return { row: data as T };
    return { error: `No row with that ${idKey} on this wedding` };
  }
  const name = str(args[nameKey]);
  if (!name) return { error: `Pass ${idKey} or ${nameKey}` };

  const { data } = await supabase.from(table).select("*").eq("event_id", event.id);
  const rows = (data ?? []) as (T & Record<string, unknown>)[];
  const needle = name.toLowerCase();
  const exact = rows.filter((r) => String(r[nameColumn] ?? "").toLowerCase() === needle);
  const candidates = exact.length
    ? exact
    : rows.filter((r) => String(r[nameColumn] ?? "").toLowerCase().includes(needle));
  if (candidates.length === 1) return { row: candidates[0] };
  if (candidates.length === 0) return { error: `No ${table} row matching "${name}"` };
  return {
    error: `Ambiguous, ${candidates.length} rows match "${name}": ${candidates
      .map((r) => `${String(r[nameColumn])} (${r.id})`)
      .join(", ")}`,
  };
}

// ── Overview ────────────────────────────────────────────────────────────

/** The same live numbers get_planning_overview returns, for the chat route to
 *  put in front of Ava every turn, whichever conversation she is in. */
export function planningSnapshot(supabase: SupabaseClient, event: EventRow) {
  return execPlanningOverview(supabase, event);
}

async function execPlanningOverview(
  supabase: SupabaseClient,
  event: EventRow
): Promise<Record<string, unknown>> {
  const [venuesQ, budgetQ, guestsQ, tasksQ, registryQ, claimsQ, repliesQ, outboundQ, siteQ, designsQ, ordersQ] =
    await Promise.all([
      supabase.from("venues").select("id, name, category, swipe_status, booked_at").eq("event_id", event.id),
      supabase.from("budget_items").select("category, label, planned_amount, paid_amount").eq("event_id", event.id),
      supabase.from("guests").select("rsvp, plus_one").eq("event_id", event.id),
      supabase.from("timeline_tasks").select("title, due_date, done, category, kind").eq("event_id", event.id),
      supabase.from("registry_items").select("id").eq("event_id", event.id),
      supabase.from("registry_claims").select("id").eq("event_id", event.id),
      supabase.from("email_replies").select("id, read_at, quote_status").eq("event_id", event.id),
      supabase.from("outbound_emails").select("venue_id").eq("event_id", event.id),
      supabase.from("wedding_sites").select("domain, published").eq("event_id", event.id).maybeSingle(),
      supabase.from("website_designs").select("id, active").eq("event_id", event.id),
      supabase.from("website_orders").select("status").eq("event_id", event.id),
    ]);

  const venues = (venuesQ.data ?? []) as Pick<VenueRow, "id" | "name" | "category" | "swipe_status" | "booked_at">[];
  const byCategory: Record<string, { total: number; shortlisted: number; contacted: number; booked: number }> = {};
  const contacted = new Set((outboundQ.data ?? []).map((o) => o.venue_id as string));
  for (const v of venues) {
    const bucket = (byCategory[v.category] ??= { total: 0, shortlisted: 0, contacted: 0, booked: 0 });
    bucket.total++;
    if (v.swipe_status === "liked") bucket.shortlisted++;
    if (contacted.has(v.id)) bucket.contacted++;
    if (v.booked_at) bucket.booked++;
  }
  const chosenVenue = venues.find((v) => v.id === event.chosen_venue_id);

  const budget = (budgetQ.data ?? []) as Pick<BudgetItemRow, "category" | "label" | "planned_amount" | "paid_amount">[];
  const guests = (guestsQ.data ?? []) as Pick<GuestRow, "rsvp" | "plus_one">[];
  const allTasks = (tasksQ.data ?? []) as Pick<TimelineTaskRow, "title" | "due_date" | "done" | "category" | "kind">[];
  // Two levels of detail live in this table — report them apart, or the ~205
  // seeded checklist items swamp the milestone numbers Ava reasons about.
  const tasks = allTasks.filter((t) => t.kind !== "check");
  const checks = allTasks.filter((t) => t.kind === "check");
  const today = new Date().toISOString().slice(0, 10);
  // What is next, and what is late, is asked of everything with a date — a
  // dated checklist item sits on the Tidslinje tab too, so leaving it out here
  // would have Ava contradict the screen the couple is looking at.
  const dated = allTasks.filter((t) => t.due_date);
  const upcoming = dated
    .filter((t) => !t.done)
    .sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1))
    .slice(0, 5);
  const checksByArea: Record<string, { total: number; done: number }> = {};
  for (const c of checks) {
    const area = c.category ?? "ovrigt";
    const bucket = (checksByArea[area] ??= { total: 0, done: 0 });
    bucket.total += 1;
    if (c.done) bucket.done += 1;
  }

  const replies = repliesQ.data ?? [];
  const designs = designsQ.data ?? [];

  return {
    event: {
      title: event.title,
      type: event.event_type,
      location: event.location,
      date: event.event_date ?? event.date_hint ?? "not set",
      guest_count_estimate: event.guest_count,
      budget_text: event.budget,
      status: event.status,
    },
    budget: {
      total_dkk: parseBudgetTotal(event.budget),
      planned_sum_dkk: budget.reduce((s, b) => s + b.planned_amount, 0),
      paid_sum_dkk: budget.reduce((s, b) => s + b.paid_amount, 0),
      categories: budget.map((b) => ({
        category: b.category,
        label: b.label,
        planned_dkk: b.planned_amount,
        paid_dkk: b.paid_amount,
      })),
    },
    guests: {
      total: guests.length,
      yes: guests.filter((g) => g.rsvp === "ja").length,
      no: guests.filter((g) => g.rsvp === "nej").length,
      awaiting: guests.filter((g) => g.rsvp === "afventer").length,
      plus_ones: guests.filter((g) => g.plus_one).length,
    },
    vendors: {
      chosen_venue: chosenVenue ? { id: chosenVenue.id, name: chosenVenue.name } : null,
      by_category: byCategory,
    },
    tasks: {
      // total/done stay milestone-only — they are the "how far along the big
      // plan" numbers. overdue/next_up span both, matching the Tidslinje tab.
      total: tasks.length,
      done: tasks.filter((t) => t.done).length,
      overdue: dated.filter((t) => !t.done && t.due_date! < today).length,
      next_up: upcoming.map((t) => ({ title: t.title, due_date: t.due_date })),
    },
    checklist: {
      total: checks.length,
      done: checks.filter((t) => t.done).length,
      by_area: checksByArea,
    },
    registry: {
      items: (registryQ.data ?? []).length,
      claims: (claimsQ.data ?? []).length,
    },
    website: {
      designs_generated: designs.length,
      has_active_design: designs.some((d) => d.active),
      paid: (ordersQ.data ?? []).some((o) => o.status === "paid"),
      published: Boolean(siteQ.data?.published),
      public_path: siteQ.data?.domain ? `/w/${siteQ.data.domain}` : null,
    },
    inbox: {
      replies: replies.length,
      unread: replies.filter((r) => !r.read_at).length,
      quotes_received: replies.filter((r) => r.quote_status === "quoted").length,
    },
  };
}

function parseBudgetTotal(text: string | null): number | null {
  if (!text) return null;
  const digits = text.replace(/[^\d]/g, "");
  return digits ? Number.parseInt(digits, 10) : null;
}

// ── Vendors ─────────────────────────────────────────────────────────────

async function execListVendors(
  supabase: SupabaseClient,
  event: EventRow,
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  let query = supabase
    .from("venues")
    .select("id, name, category, swipe_status, booked_at, email, price_hint, capacity, rating, address")
    .eq("event_id", event.id)
    .order("created_at");
  const category = str(args.category);
  if (category) query = query.eq("category", category);
  const status = str(args.status);
  if (status === "booked") query = query.not("booked_at", "is", null);
  else if (status) query = query.eq("swipe_status", status);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Pick<
    VenueRow,
    "id" | "name" | "category" | "swipe_status" | "booked_at" | "email" | "price_hint" | "capacity" | "rating" | "address"
  >[];
  return {
    count: rows.length,
    vendors: rows.map((v) => ({
      id: v.id,
      name: v.name,
      category: v.category,
      swipe_status: v.swipe_status,
      booked: Boolean(v.booked_at),
      chosen_venue: v.id === event.chosen_venue_id,
      has_email: Boolean(v.email),
      price_hint: v.price_hint,
      capacity: v.capacity,
      rating: v.rating,
      address: v.address,
    })),
  };
}

async function execSwipeVendor(
  supabase: SupabaseClient,
  event: EventRow,
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const venueId = str(args.venue_id);
  const decision = str(args.decision);
  if (!venueId || !decision || !["liked", "rejected", "pending"].includes(decision)) {
    return { error: "Pass venue_id and decision (liked | rejected | pending)" };
  }
  const { data, error } = await supabase
    .from("venues")
    .update({ swipe_status: decision })
    .eq("id", venueId)
    .eq("event_id", event.id)
    .select("id, name, swipe_status")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return { error: "That vendor is not on this wedding's board" };
  return { ok: true, vendor: data };
}

// ── Budget ──────────────────────────────────────────────────────────────

async function execListBudget(
  supabase: SupabaseClient,
  event: EventRow
): Promise<Record<string, unknown>> {
  const { data, error } = await supabase
    .from("budget_items")
    .select("category, label, planned_amount, paid_amount")
    .eq("event_id", event.id)
    .order("sort");
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Pick<BudgetItemRow, "category" | "label" | "planned_amount" | "paid_amount">[];
  return {
    total_dkk: parseBudgetTotal(event.budget),
    planned_sum_dkk: rows.reduce((s, b) => s + b.planned_amount, 0),
    paid_sum_dkk: rows.reduce((s, b) => s + b.paid_amount, 0),
    entries: rows.map((b) => ({
      category: b.category,
      label: b.label,
      planned_dkk: b.planned_amount,
      paid_dkk: b.paid_amount,
    })),
  };
}

async function execSetBudgetEntry(
  supabase: SupabaseClient,
  event: EventRow,
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const category = str(args.category)?.toLowerCase().replace(/\s+/g, "-");
  if (!category) return { error: "category is required" };

  const { data: existing } = await supabase
    .from("budget_items")
    .select("*")
    .eq("event_id", event.id)
    .eq("category", category)
    .maybeSingle();
  const existingRow = existing as BudgetItemRow | null;

  const label = str(args.label) ?? existingRow?.label ?? category;
  const planned = int(args.planned_amount);
  const paid = int(args.paid_amount);

  if (existingRow) {
    const { data, error } = await supabase
      .from("budget_items")
      .update({
        label,
        planned_amount: planned ?? existingRow.planned_amount,
        paid_amount: paid ?? existingRow.paid_amount,
      })
      .eq("id", existingRow.id)
      .select("category, label, planned_amount, paid_amount")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, updated: data };
  }

  const { data: maxSort } = await supabase
    .from("budget_items")
    .select("sort")
    .eq("event_id", event.id)
    .order("sort", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data, error } = await supabase
    .from("budget_items")
    .insert({
      event_id: event.id,
      user_id: event.user_id,
      category,
      label,
      planned_amount: planned ?? 0,
      paid_amount: paid ?? 0,
      sort: (maxSort?.sort ?? -1) + 1,
    })
    .select("category, label, planned_amount, paid_amount")
    .single();
  if (error) throw new Error(error.message);
  return { ok: true, created: data };
}

async function execDeleteBudgetEntry(
  supabase: SupabaseClient,
  event: EventRow,
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const category = str(args.category)?.toLowerCase().replace(/\s+/g, "-");
  if (!category) return { error: "category is required" };
  const { data, error } = await supabase
    .from("budget_items")
    .delete()
    .eq("event_id", event.id)
    .eq("category", category)
    .select("category");
  if (error) throw new Error(error.message);
  if (!data?.length) return { error: `No budget entry with category "${category}"` };
  return { ok: true, deleted: category };
}

// ── Guests ──────────────────────────────────────────────────────────────

const RSVP_VALUES = new Set(["ja", "nej", "afventer"]);

function guestSummary(g: GuestRow) {
  return {
    id: g.id,
    name: g.name,
    side: g.side,
    rsvp: g.rsvp,
    plus_one: g.plus_one,
    plus_one_name: g.plus_one_name,
    email: g.email,
    phone: g.phone,
    meal: g.meal,
    notes: g.notes,
  };
}

async function execListGuests(
  supabase: SupabaseClient,
  event: EventRow,
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  let query = supabase.from("guests").select("*").eq("event_id", event.id).order("created_at");
  const rsvp = str(args.rsvp);
  if (rsvp && RSVP_VALUES.has(rsvp)) query = query.eq("rsvp", rsvp);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as GuestRow[];
  return { count: rows.length, guests: rows.map(guestSummary) };
}

async function execAddGuests(
  supabase: SupabaseClient,
  event: EventRow,
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const list = Array.isArray(args.guests) ? (args.guests as Record<string, unknown>[]) : [];
  const rows = list
    .map((g) => {
      const name = str(g.name);
      if (!name) return null;
      const rsvp = str(g.rsvp);
      return {
        event_id: event.id,
        user_id: event.user_id,
        name,
        side: str(g.side) ?? "Fælles",
        email: str(g.email) ?? null,
        phone: str(g.phone) ?? null,
        rsvp: rsvp && RSVP_VALUES.has(rsvp) ? rsvp : "afventer",
        plus_one: g.plus_one === true,
        meal: str(g.meal) ?? null,
        notes: str(g.notes) ?? null,
      };
    })
    .filter((g): g is NonNullable<typeof g> => g !== null);
  if (rows.length === 0) return { error: "guests must contain at least one entry with a name" };

  const { data, error } = await supabase.from("guests").insert(rows).select("id, name");
  if (error) throw new Error(error.message);
  return { ok: true, added: (data ?? []).map((g) => g.name), count: data?.length ?? 0 };
}

async function execUpdateGuest(
  supabase: SupabaseClient,
  event: EventRow,
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const { row, error } = await findRow<GuestRow>(supabase, event, "guests", "name", args, "guest_id", "name");
  if (!row) return { error };

  const patch: Record<string, unknown> = {};
  const newName = str(args.new_name);
  if (newName) patch.name = newName;
  for (const key of ["side", "email", "phone", "meal", "notes", "plus_one_name"] as const) {
    const v = str(args[key]);
    if (v !== undefined) patch[key] = v;
  }
  const rsvp = str(args.rsvp);
  if (rsvp && RSVP_VALUES.has(rsvp)) {
    patch.rsvp = rsvp;
    if (rsvp !== "afventer") patch.responded_at = new Date().toISOString();
  }
  if (typeof args.plus_one === "boolean") patch.plus_one = args.plus_one;
  if (Object.keys(patch).length === 0) return { error: "Nothing to update, pass at least one field" };

  const { data, error: updateError } = await supabase
    .from("guests")
    .update(patch)
    .eq("id", row.id)
    .select("*")
    .single();
  if (updateError) throw new Error(updateError.message);
  return { ok: true, guest: guestSummary(data as GuestRow) };
}

async function execRemoveGuest(
  supabase: SupabaseClient,
  event: EventRow,
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const { row, error } = await findRow<GuestRow>(supabase, event, "guests", "name", args, "guest_id", "name");
  if (!row) return { error };
  const { error: delError } = await supabase.from("guests").delete().eq("id", row.id);
  if (delError) throw new Error(delError.message);
  return { ok: true, removed: row.name };
}

// ── Tasks ───────────────────────────────────────────────────────────────

async function execListTasks(
  supabase: SupabaseClient,
  event: EventRow,
  args: Record<string, unknown> = {}
): Promise<Record<string, unknown>> {
  // Default to milestones: listing all ~220 rows would flood the context.
  const kind = str(args.kind) === "check" ? "check" : "milestone";
  const { data, error } = await supabase
    .from("timeline_tasks")
    .select("id, title, due_date, done, category, kind")
    .eq("event_id", event.id)
    .eq("kind", kind)
    .order("sort")
    .order("due_date");
  if (error) throw new Error(error.message);
  return { kind, count: (data ?? []).length, tasks: data ?? [] };
}

async function execAddTasks(
  supabase: SupabaseClient,
  event: EventRow,
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const list = Array.isArray(args.tasks) ? (args.tasks as Record<string, unknown>[]) : [];
  const rows = list
    .map((t, i) => {
      const title = str(t.title);
      if (!title) return null;
      return {
        event_id: event.id,
        user_id: event.user_id,
        title,
        due_date: str(t.due_date) ?? null,
        category: str(t.category) ?? null,
        done: false,
        sort: i,
      };
    })
    .filter((t): t is NonNullable<typeof t> => t !== null);
  if (rows.length === 0) return { error: "tasks must contain at least one entry with a title" };

  const { data, error } = await supabase.from("timeline_tasks").insert(rows).select("id, title");
  if (error) throw new Error(error.message);
  return { ok: true, added: (data ?? []).map((t) => t.title), count: data?.length ?? 0 };
}

async function execUpdateTask(
  supabase: SupabaseClient,
  event: EventRow,
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const { row, error } = await findRow<TimelineTaskRow>(
    supabase, event, "timeline_tasks", "title", args, "task_id", "title"
  );
  if (!row) return { error };

  const patch: Record<string, unknown> = {};
  const newTitle = str(args.new_title);
  if (newTitle) patch.title = newTitle;
  const due = str(args.due_date);
  if (due) patch.due_date = due;
  if (typeof args.done === "boolean") patch.done = args.done;
  if (Object.keys(patch).length === 0) return { error: "Nothing to update, pass at least one field" };

  const { data, error: updateError } = await supabase
    .from("timeline_tasks")
    .update(patch)
    .eq("id", row.id)
    .select("id, title, due_date, done")
    .single();
  if (updateError) throw new Error(updateError.message);
  return { ok: true, task: data };
}

async function execDeleteTask(
  supabase: SupabaseClient,
  event: EventRow,
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const { row, error } = await findRow<TimelineTaskRow>(
    supabase, event, "timeline_tasks", "title", args, "task_id", "title"
  );
  if (!row) return { error };
  const { error: delError } = await supabase.from("timeline_tasks").delete().eq("id", row.id);
  if (delError) throw new Error(delError.message);
  return { ok: true, deleted: row.title };
}

// ── Registry ────────────────────────────────────────────────────────────

async function execListRegistry(
  supabase: SupabaseClient,
  event: EventRow
): Promise<Record<string, unknown>> {
  const [{ data: items, error }, { data: claims }] = await Promise.all([
    supabase
      .from("registry_items")
      .select("id, title, description, price_cents, currency, quantity, store_name, product_url")
      .eq("event_id", event.id)
      .order("sort"),
    supabase.from("registry_claims").select("item_id, quantity").eq("event_id", event.id),
  ]);
  if (error) throw new Error(error.message);
  const claimedByItem = new Map<string, number>();
  for (const c of claims ?? []) {
    claimedByItem.set(c.item_id, (claimedByItem.get(c.item_id) ?? 0) + (c.quantity ?? 1));
  }
  return {
    count: (items ?? []).length,
    items: (items ?? []).map((i) => ({
      id: i.id,
      title: i.title,
      description: i.description,
      price_dkk: i.price_cents != null ? Math.round(i.price_cents / 100) : null,
      quantity: i.quantity,
      claimed: claimedByItem.get(i.id) ?? 0,
      store_name: i.store_name,
      product_url: i.product_url,
    })),
  };
}

async function execAddRegistryItems(
  supabase: SupabaseClient,
  event: EventRow,
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const list = Array.isArray(args.items) ? (args.items as Record<string, unknown>[]) : [];
  const { data: maxSort } = await supabase
    .from("registry_items")
    .select("sort")
    .eq("event_id", event.id)
    .order("sort", { ascending: false })
    .limit(1)
    .maybeSingle();
  const base = (maxSort?.sort ?? -1) + 1;

  const rows = list
    .map((i, idx) => {
      const title = str(i.title);
      if (!title) return null;
      const price = int(i.price);
      return {
        event_id: event.id,
        user_id: event.user_id,
        title,
        description: str(i.description) ?? null,
        product_url: str(i.product_url) ?? null,
        store_name: str(i.store_name) ?? null,
        price_cents: price !== undefined ? price * 100 : null,
        currency: "DKK",
        quantity: int(i.quantity) ?? 1,
        sort: base + idx,
      };
    })
    .filter((i): i is NonNullable<typeof i> => i !== null);
  if (rows.length === 0) return { error: "items must contain at least one entry with a title" };

  const { data, error } = await supabase.from("registry_items").insert(rows).select("id, title");
  if (error) throw new Error(error.message);
  return { ok: true, added: (data ?? []).map((i) => i.title), count: data?.length ?? 0 };
}

async function execUpdateRegistryItem(
  supabase: SupabaseClient,
  event: EventRow,
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const { row, error } = await findRow<RegistryItemRow>(
    supabase, event, "registry_items", "title", args, "item_id", "title"
  );
  if (!row) return { error };

  const patch: Record<string, unknown> = {};
  const newTitle = str(args.new_title);
  if (newTitle) patch.title = newTitle;
  for (const key of ["description", "product_url", "store_name"] as const) {
    const v = str(args[key]);
    if (v !== undefined) patch[key] = v;
  }
  const price = int(args.price);
  if (price !== undefined) patch.price_cents = price * 100;
  const quantity = int(args.quantity);
  if (quantity !== undefined) patch.quantity = quantity;
  if (Object.keys(patch).length === 0) return { error: "Nothing to update, pass at least one field" };

  const { data, error: updateError } = await supabase
    .from("registry_items")
    .update(patch)
    .eq("id", row.id)
    .select("id, title, price_cents, quantity")
    .single();
  if (updateError) throw new Error(updateError.message);
  return { ok: true, item: data };
}

async function execDeleteRegistryItem(
  supabase: SupabaseClient,
  event: EventRow,
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const { row, error } = await findRow<RegistryItemRow>(
    supabase, event, "registry_items", "title", args, "item_id", "title"
  );
  if (!row) return { error };
  const { error: delError } = await supabase.from("registry_items").delete().eq("id", row.id);
  if (delError) throw new Error(delError.message);
  return { ok: true, deleted: row.title };
}
