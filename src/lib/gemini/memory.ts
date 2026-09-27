import type { SupabaseClient } from "@supabase/supabase-js";
import { Type, type FunctionDeclaration } from "@google/genai";
import {
  MEMORY_CATEGORIES,
  type AvaMemoryRow,
  type ChatThreadRow,
  type EventRow,
  type MemoryCategory,
} from "@/lib/db/types";

/*
 * Ava's memory across conversations. A new chat starts with no messages, so
 * everything she should still know has to come from somewhere else: the
 * memories she saved herself (preferences, decisions, follow-ups), and the
 * live planning data, which the chat route puts in front of her every turn.
 */

/** More than this and the prompt grows faster than the memories help. */
const MAX_MEMORIES = 150;

export const memoryFunctionDeclarations: FunctionDeclaration[] = [
  {
    name: "remember",
    description:
      "Save something about the couple that should still be known in a later conversation: a preference or taste (colours, style, music, food), a decision they made, a fact about people or circumstances (a grandmother in a wheelchair, a vegan best man), or something to follow up on later. One short, self-contained sentence per memory, written so it makes sense on its own months from now. To correct an existing memory, pass its id as replaces_id instead of saving a duplicate. Do not save what the planning data already holds (guest rows, budget numbers, task rows, the date).",
    parameters: {
      type: Type.OBJECT,
      properties: {
        content: {
          type: Type.STRING,
          description: "The memory, one sentence, in the couple's language",
        },
        category: {
          type: Type.STRING,
          enum: [...MEMORY_CATEGORIES],
          description:
            "preference = taste or wish; decision = something settled; fact = circumstance about people or the day; followup = something to come back to later",
        },
        replaces_id: {
          type: Type.STRING,
          description: "Id of an existing memory this one corrects or updates",
        },
      },
      required: ["content", "category"],
    },
  },
  {
    name: "forget",
    description:
      "Delete a memory that is no longer true or that the couple asks you to forget. For a follow-up that is done, forget it.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        memory_id: { type: Type.STRING },
      },
      required: ["memory_id"],
    },
  },
];

const isCategory = (v: unknown): v is MemoryCategory =>
  typeof v === "string" && (MEMORY_CATEGORIES as readonly string[]).includes(v);

/** Runs remember/forget; null for any other tool name. */
export async function execMemoryTool(
  supabase: SupabaseClient,
  event: EventRow,
  name: string,
  args: Record<string, unknown>
): Promise<Record<string, unknown> | null> {
  if (name === "remember") {
    const content = typeof args.content === "string" ? args.content.trim().slice(0, 500) : "";
    if (!content) return { error: "content is required" };
    const category = isCategory(args.category) ? args.category : "fact";
    const replaces = typeof args.replaces_id === "string" ? args.replaces_id : null;
    if (replaces) {
      const { data, error } = await supabase
        .from("ava_memories")
        .update({ content, category, updated_at: new Date().toISOString() })
        .eq("id", replaces)
        .eq("event_id", event.id)
        .select("id")
        .maybeSingle();
      if (error) return { error: error.message };
      if (data) return { ok: true, memory_id: data.id, updated: true };
      // An id that no longer exists: save it as new rather than lose it.
    }
    const { data, error } = await supabase
      .from("ava_memories")
      .insert({ event_id: event.id, user_id: event.user_id, category, content })
      .select("id")
      .single();
    if (error) return { error: error.message };
    return { ok: true, memory_id: data.id };
  }
  if (name === "forget") {
    const id = typeof args.memory_id === "string" ? args.memory_id : "";
    if (!id) return { error: "memory_id is required" };
    const { error, count } = await supabase
      .from("ava_memories")
      .delete({ count: "exact" })
      .eq("id", id)
      .eq("event_id", event.id);
    if (error) return { error: error.message };
    return count ? { ok: true } : { error: "No memory with that id" };
  }
  return null;
}

export async function loadMemories(
  supabase: SupabaseClient,
  eventId: string
): Promise<AvaMemoryRow[]> {
  const { data } = await supabase
    .from("ava_memories")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true })
    .limit(MAX_MEMORIES);
  return (data ?? []) as AvaMemoryRow[];
}

const CATEGORY_HEADINGS: Record<MemoryCategory, string> = {
  preference: "Preferences and taste",
  decision: "Decisions made",
  fact: "Facts about people and the day",
  followup: "To follow up on",
};

/**
 * The system-prompt block for everything Ava carries between conversations:
 * her memories (with ids, so she can correct or forget them), the live
 * planning snapshot, and the titles of other recent conversations.
 */
export function memoryContext({
  memories,
  snapshot,
  otherThreads,
  today,
}: {
  memories: Pick<AvaMemoryRow, "id" | "category" | "content">[];
  snapshot: Record<string, unknown> | null;
  otherThreads: Pick<ChatThreadRow, "title" | "updated_at">[];
  today: string;
}): string {
  const sections: string[] = [`Today is ${today}.`];

  if (memories.length === 0) {
    sections.push(
      "WHAT YOU REMEMBER ABOUT THIS COUPLE: nothing saved yet. Use remember as you learn things worth keeping."
    );
  } else {
    const groups = MEMORY_CATEGORIES.map((c) => {
      const rows = memories.filter((m) => m.category === c);
      if (rows.length === 0) return null;
      return `${CATEGORY_HEADINGS[c]}:\n${rows.map((m) => `- [${m.id}] ${m.content}`).join("\n")}`;
    }).filter(Boolean);
    sections.push(
      `WHAT YOU REMEMBER ABOUT THIS COUPLE (saved in earlier conversations; ids in brackets are for remember.replaces_id and forget, never show them to the couple):\n${groups.join("\n\n")}`
    );
  }

  if (snapshot) {
    sections.push(
      `LIVE PLANNING SNAPSHOT (fetched at the start of this turn; call get_planning_overview again only after you change data):\n${JSON.stringify(snapshot)}`
    );
  }

  if (otherThreads.length > 0) {
    sections.push(
      `OTHER RECENT CONVERSATIONS (titles only; their details live in your memories):\n${otherThreads
        .map((t) => `- ${t.title ?? "(untitled)"} (${t.updated_at.slice(0, 10)})`)
        .join("\n")}`
    );
  }

  sections.push(`How to use your memory:
- This conversation may be new, but the couple is not. Use what you remember
  and the snapshot without asking again for things you already know.
- When the couple tells you something that should outlive this chat (a taste,
  a wish, a dislike, a decision, a circumstance, a "remind us to…"), call
  remember right away, in the same turn. Do not announce it at length; a short
  "noteret" is enough.
- Concrete actions with a clear owner or date belong in tasks (add_tasks), so
  they show up in the plan. Softer things to come back to go in remember with
  category followup.
- When they ask what is left, what to do next or what you know, answer from the
  snapshot's next_up and overdue tasks, the unbooked vendor categories and your
  followup memories, most urgent first.
- When a memory turns out wrong or outdated, fix it with remember + replaces_id,
  or forget it. Never keep two memories that contradict each other.`);

  return sections.join("\n\n");
}

/** First words of the couple's opening message, as a conversation title. */
export function threadTitle(message: string): string {
  const oneLine = message.replace(/\s+/g, " ").trim();
  if (oneLine.length <= 60) return oneLine;
  const cut = oneLine.slice(0, 60);
  const space = cut.lastIndexOf(" ");
  return `${(space > 30 ? cut.slice(0, space) : cut).replace(/[\s,.;:!?-]+$/, "")}…`;
}
