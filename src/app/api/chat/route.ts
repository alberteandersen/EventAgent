import { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { runAgentTurn } from "@/lib/gemini/agent";
import { CHAT_MODE_CONTEXT, ONBOARDING_KICKOFF_CONTEXT } from "@/lib/gemini/prompts";
import { logAgentError } from "@/lib/gemini/log";
import { loadMemories, memoryContext, threadTitle } from "@/lib/gemini/memory";
import { planningSnapshot } from "@/lib/gemini/planningTools";
import type {
  ChatMessageRow,
  ChatThreadRow,
  EmailReplyRow,
  EventRow,
  ReplyProposalRow,
  VenueRow,
} from "@/lib/db/types";

export const maxDuration = 120; // agent turns can chain several Gemini calls

/** System-prompt context block describing the vendor reply under discussion. */
async function buildReplyContext(
  supabase: SupabaseClient,
  replyId: string,
  eventId: string
): Promise<string | undefined> {
  const { data: reply } = await supabase
    .from("email_replies")
    .select("*")
    .eq("id", replyId)
    .eq("event_id", eventId)
    .maybeSingle();
  if (!reply) return undefined;
  const replyRow = reply as EmailReplyRow;

  const [{ data: venue }, { data: proposal }] = await Promise.all([
    supabase.from("venues").select("name, category").eq("id", replyRow.venue_id).maybeSingle(),
    supabase
      .from("reply_proposals")
      .select("*")
      .eq("email_reply_id", replyId)
      .eq("status", "proposed")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const venueRow = venue as Pick<VenueRow, "name" | "category"> | null;
  const proposalRow = proposal as ReplyProposalRow | null;

  return [
    `DISCUSSION CONTEXT, the user is talking about a reply from "${venueRow?.name ?? "a vendor"}"${
      venueRow?.category && venueRow.category !== "venue" ? ` (${venueRow.category})` : ""
    } (reply_id: ${replyId}).`,
    `Their message: ${(replyRow.body ?? replyRow.snippet ?? "").slice(0, 1500)}`,
    proposalRow
      ? `Your current proposed reply: ${proposalRow.body.slice(0, 800)}`
      : "There is no proposed reply yet.",
    `If the user wants to change the reply, call propose_vendor_reply with reply_id "${replyId}" and the revised body.`,
  ].join("\n");
}

/** Messages of the conversation Ava reads back each turn. */
const HISTORY_LIMIT = 50;

/**
 * POST /api/chat — run one agent turn.
 * Body: { eventId?: string, threadId?: string, message: string }
 * Without a threadId the turn starts a new conversation.
 * Responds with an SSE stream:
 *   event: status  → data: {"status": "Searching the web…"}
 *   event: event   → data: {"eventId": "..."}        (when a new event is created)
 *   event: thread  → data: <ChatThreadRow>           (when a new conversation starts)
 *   event: tool    → data: <ChatToolEvent>           (a tool starting or finishing)
 *   event: ui      → data: <AgentUiAction>           (agent-driven client navigation)
 *   event: message → data: <persisted assistant ChatMessageRow>
 *   event: error   → data: {"error": "..."}
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { eventId, threadId, message, contextReplyId, uiMode, kickoff } = (await request.json()) as {
    eventId?: string;
    threadId?: string;
    message?: string;
    contextReplyId?: string;
    uiMode?: "chat" | "classic";
    /** First turn after the onboarding walkthrough — drive the plan forward. */
    kickoff?: boolean;
  };
  if (!message?.trim()) {
    return Response.json({ error: "message is required" }, { status: 400 });
  }

  // Load or create the event.
  let event: EventRow;
  if (eventId) {
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .eq("id", eventId)
      .single();
    if (error || !data) {
      return Response.json({ error: "Event not found" }, { status: 404 });
    }
    event = data as EventRow;
  } else {
    const { data, error } = await supabase
      .from("events")
      .insert({ user_id: user.id })
      .select()
      .single();
    if (error || !data) {
      return Response.json({ error: error?.message ?? "Could not create event" }, { status: 500 });
    }
    event = data as EventRow;
  }

  // The conversation this turn belongs to, or a new one titled by its opener.
  let thread: ChatThreadRow;
  let newThread = false;
  if (threadId) {
    const { data } = await supabase
      .from("chat_threads")
      .select("*")
      .eq("id", threadId)
      .eq("event_id", event.id)
      .maybeSingle();
    if (!data) return Response.json({ error: "Conversation not found" }, { status: 404 });
    thread = data as ChatThreadRow;
    if (!thread.title) {
      const title = threadTitle(message);
      await supabase.from("chat_threads").update({ title }).eq("id", thread.id);
      thread = { ...thread, title };
    }
  } else {
    const { data, error } = await supabase
      .from("chat_threads")
      .insert({ event_id: event.id, user_id: user.id, title: threadTitle(message) })
      .select()
      .single();
    if (error || !data) {
      return Response.json({ error: error?.message ?? "Could not start conversation" }, { status: 500 });
    }
    thread = data as ChatThreadRow;
    newThread = true;
  }

  // The latest messages, oldest first.
  const { data: historyData } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("thread_id", thread.id)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);
  const history = ((historyData ?? []) as ChatMessageRow[]).reverse();

  // What Ava carries between conversations: her memories, the live planning
  // numbers and what the couple talked about elsewhere.
  const [memories, snapshot, { data: otherThreadsData }] = await Promise.all([
    loadMemories(supabase, event.id),
    planningSnapshot(supabase, event).catch((err) => {
      logAgentError("api/chat:snapshot", err, { eventId: event.id });
      return null;
    }),
    supabase
      .from("chat_threads")
      .select("title, updated_at")
      .eq("event_id", event.id)
      .neq("id", thread.id)
      .order("updated_at", { ascending: false })
      .limit(8),
  ]);

  // When the user is discussing a specific vendor reply (from the outreach
  // inbox), give the agent that thread's context so it can revise the response.
  const replyContext = contextReplyId
    ? await buildReplyContext(supabase, contextReplyId, event.id)
    : undefined;

  // Respond in the couple's chosen language.
  const { data: prof } = await supabase
    .from("profiles")
    .select("language")
    .eq("user_id", user.id)
    .maybeSingle();
  const languageDirective =
    prof?.language === "en"
      ? "Always reply to the couple in English."
      : "Svar altid parret på dansk.";
  const extraContext = [
    languageDirective,
    memoryContext({
      memories,
      snapshot,
      otherThreads: (otherThreadsData ?? []) as Pick<ChatThreadRow, "title" | "updated_at">[],
      today: new Date().toISOString().slice(0, 10),
    }),
    uiMode === "chat" ? CHAT_MODE_CONTEXT : undefined,
    kickoff ? ONBOARDING_KICKOFF_CONTEXT : undefined,
    replyContext,
  ]
    .filter(Boolean)
    .join("\n\n");

  const { data: userMsg, error: userMsgError } = await supabase
    .from("chat_messages")
    .insert({
      event_id: event.id,
      thread_id: thread.id,
      user_id: user.id,
      role: "user",
      content: message,
    })
    .select()
    .single();
  if (userMsgError || !userMsg) {
    return Response.json(
      { error: userMsgError?.message ?? "Could not save message" },
      { status: 500 }
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (eventName: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };
      try {
        if (!eventId) send("event", { eventId: event.id });
        if (newThread) send("thread", thread);
        // Lets the client swap its optimistic bubble for the persisted row.
        send("user_message", userMsg);

        const result = await runAgentTurn(
          supabase,
          event,
          history,
          message,
          (status) => send("status", { status }),
          extraContext,
          (action) => send("ui", action),
          (toolEvent) => send("tool", toolEvent)
        );

        const { data: saved, error } = await supabase
          .from("chat_messages")
          .insert({
            event_id: event.id,
            thread_id: thread.id,
            user_id: user.id,
            role: "assistant",
            content: result.text,
            payload: result.payload,
            tool_calls: result.toolCalls.length > 0 ? result.toolCalls : null,
          })
          .select()
          .single();
        if (error) throw new Error(error.message);

        send("message", saved);
      } catch (err) {
        logAgentError("api/chat", err, {
          userId: user.id,
          eventId: event.id,
          threadId: thread.id,
          historyLength: history.length,
          messageLength: message.length,
        });
        send("error", { error: err instanceof Error ? err.message : "Agent failed" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
