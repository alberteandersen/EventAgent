"use client";

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type {
  AgentUiAction,
  ChatMessageRow,
  ChatThreadRow,
  ChatToolCall,
  ChatToolEvent,
} from "@/lib/db/types";
import { takeSseFrames } from "./sse";

/** A tool in the turn that is running now; `running` until its result lands. */
export type LiveToolCall = ChatToolCall & { running: boolean };

/** A message as the chat holds it: a stored row, or a turn that failed. */
export type ChatMessageView = ChatMessageRow & { error?: string };

interface Options {
  initialEventId: string | null;
  /** The conversation to continue; null starts a new one on the next send. */
  threadId: string | null;
  /** Fired when the first message of a new conversation creates it. */
  onThreadCreated?: (thread: ChatThreadRow) => void;
  /** Fired when the agent lazily creates a new event mid-turn. */
  onEventCreated?: (eventId: string) => void;
  /** Fired after a turn's stream completes (refresh venues/drafts, etc.). */
  onTurnComplete?: () => void;
  /** Fired when the agent drives the client mid-turn (page navigation). */
  onUiAction?: (action: AgentUiAction) => void;
}

export interface AgentChat {
  messages: ChatMessageView[];
  setMessages: Dispatch<SetStateAction<ChatMessageView[]>>;
  /** True from send until the reply (or error) has landed. */
  busy: boolean;
  /** The tools the current turn has run so far, in order. */
  liveTools: LiveToolCall[];
  sendMessage: (text: string, ctx?: { contextReplyId?: string; kickoff?: boolean }) => Promise<void>;
}

/**
 * The chat transport: optimistic user message, POST /api/chat, and the SSE
 * frames it streams back — the persisted rows, tool steps as they run, and
 * agent-driven navigation.
 */
export function useAgentChat({
  initialEventId,
  threadId,
  onThreadCreated,
  onEventCreated,
  onTurnComplete,
  onUiAction,
}: Options): AgentChat {
  const [messages, setMessages] = useState<ChatMessageView[]>([]);
  const [busy, setBusy] = useState(false);
  const [liveTools, setLiveTools] = useState<LiveToolCall[]>([]);
  const eventIdRef = useRef<string | null>(initialEventId);
  const busyRef = useRef(false);

  // Refs, so a new callback identity or thread never invalidates a turn mid-stream.
  const threadIdRef = useRef(threadId);
  const callbacks = useRef({ onThreadCreated, onEventCreated, onTurnComplete, onUiAction });
  useEffect(() => {
    threadIdRef.current = threadId;
  }, [threadId]);
  useEffect(() => {
    callbacks.current = { onThreadCreated, onEventCreated, onTurnComplete, onUiAction };
  });

  const sendMessage = useCallback(
    async (text: string, ctx?: { contextReplyId?: string; kickoff?: boolean }) => {
      const trimmed = text.trim();
      if (!trimmed || busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      setLiveTools([]);

      const optimistic: ChatMessageRow = {
        id: `local-${Date.now()}`,
        event_id: eventIdRef.current ?? "",
        thread_id: threadIdRef.current,
        user_id: "",
        role: "user",
        content: trimmed,
        payload: null,
        created_at: new Date().toISOString(),
      };
      setMessages((m) => [...m, optimistic]);
      // Mirrors liveTools, so a failed turn can keep what it ran.
      let turnTools: LiveToolCall[] = [];
      const setTools = (next: LiveToolCall[]) => {
        turnTools = next;
        setLiveTools(next);
      };

      const handle = (event: string, parsed: unknown) => {
        switch (event) {
          case "event": {
            const id = (parsed as { eventId: string }).eventId;
            eventIdRef.current = id;
            callbacks.current.onEventCreated?.(id);
            break;
          }
          case "thread": {
            const thread = parsed as ChatThreadRow;
            threadIdRef.current = thread.id;
            callbacks.current.onThreadCreated?.(thread);
            break;
          }
          case "tool": {
            const e = parsed as ChatToolEvent;
            if (e.phase === "start") {
              setTools([...turnTools, { id: e.id, name: e.name, args: e.args, ok: true, running: true }]);
            } else {
              const done: LiveToolCall = {
                id: e.id, name: e.name, args: e.args, ok: e.ok, error: e.error, result: e.result, running: false,
              };
              setTools(turnTools.map((t) => (t.id === e.id ? done : t)));
            }
            break;
          }
          case "ui":
            callbacks.current.onUiAction?.(parsed as AgentUiAction);
            break;
          case "user_message": {
            // Swap the optimistic bubble for the persisted row, which the
            // realtime feed may already have delivered.
            const saved = parsed as ChatMessageRow;
            setMessages((m) => {
              const without = m.filter((x) => x.id !== optimistic.id);
              return without.some((x) => x.id === saved.id) ? without : [...without, saved];
            });
            break;
          }
          case "message": {
            const saved = parsed as ChatMessageRow;
            setMessages((m) => {
              const i = m.findIndex((x) => x.id === saved.id);
              if (i === -1) return [...m, saved];
              // Realtime got there first; the streamed row is the same row.
              const next = [...m];
              next[i] = saved;
              return next;
            });
            setTools([]);
            break;
          }
          case "error":
            throw new Error((parsed as { error: string }).error);
        }
      };

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventId: eventIdRef.current ?? undefined,
            threadId: threadIdRef.current ?? undefined,
            message: trimmed,
            contextReplyId: ctx?.contextReplyId,
            kickoff: ctx?.kickoff,
          }),
        });
        if (!res.ok || !res.body) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error ?? `Request failed (${res.status})`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const { frames, rest } = takeSseFrames(buffer);
          buffer = rest;
          for (const frame of frames) handle(frame.event, JSON.parse(frame.data));
        }
        callbacks.current.onTurnComplete?.();
      } catch (err) {
        const ran: ChatToolCall[] = turnTools.map(({ running, ...t }) =>
          running ? { ...t, ok: false, error: "interrupted" } : t
        );
        setMessages((m) => [
          ...m,
          {
            ...optimistic,
            id: `local-err-${Date.now()}`,
            role: "assistant",
            content: "",
            tool_calls: ran.length > 0 ? ran : null,
            error: err instanceof Error ? err.message : "unknown error",
          },
        ]);
      } finally {
        busyRef.current = false;
        setBusy(false);
        setTools([]);
      }
    },
    []
  );

  return { messages, setMessages, busy, liveTools, sendMessage };
}
