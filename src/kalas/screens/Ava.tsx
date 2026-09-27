"use client";

/* Ava's chat panel. Conversations are threads: the panel opens on the latest
   one, "Ny" starts another, and the clock lists them all. What Ava does to
   answer shows as steps above her reply, live while she works. What she
   remembers across conversations has its own view, so the couple can see it
   and take things out. */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Brain, CircleAlert, History, Plus } from 'lucide-react';
import { useWedding } from '../useWedding';
import { cn } from '../ui';
import { useLang } from '../i18n';
import type { NavigateTarget } from '../lib/hub-nav';
import { createClient } from '@/lib/supabase/client';
import { useAgentChat, type ChatMessageView } from '@/lib/hooks/useAgentChat';
import type { AgentUiAction, ChatMessageRow, ChatThreadRow } from '@/lib/db/types';
import RichText from '../chat/RichText';
import ToolSteps from '../chat/ToolSteps';
import PayloadCard from '../chat/PayloadCards';
import Composer, { type ComposerHandle } from '../chat/Composer';
import ThreadList from '../chat/ThreadList';
import MemoryView from '../chat/MemoryView';

type View = 'chat' | 'history' | 'memory';

const SUGGESTIONS = [
  'Hvad mangler vi at gøre?',
  'Hvor står budgettet?',
  'Find en fotograf til os',
  'Hvad husker du om os?',
];

export default function Ava({
  onNavigate,
  onUiAction,
  uiMode = 'classic',
}: {
  onNavigate?: (s: NavigateTarget) => void;
  /** Applies agent-driven client actions (page navigation) as they stream in. */
  onUiAction?: (action: AgentUiAction) => void;
  uiMode?: 'chat' | 'classic';
}) {
  const { loading, event, couple } = useWedding();
  const { t } = useLang();

  if (loading) {
    return <div className="flex h-full items-center justify-center"><Dots /></div>;
  }

  if (!event) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
        <Avatar />
        <p className="mt-4 font-serif text-[1.2rem] text-ink">{t('Lad os planlægge jeres bryllup')}</p>
        <p className="mt-2 max-w-sm text-[0.9rem] text-ink-soft">
          {t('Fortæl mig om jeres dag, så går jeg i gang med at finde venues.')}
        </p>
      </div>
    );
  }

  return (
    <AvaChat
      key={event.id}
      eventId={event.id}
      coupleA={couple.a}
      onNavigate={onNavigate}
      onUiAction={onUiAction}
      uiMode={uiMode}
    />
  );
}

function AvaChat({
  eventId,
  coupleA,
  onNavigate,
  onUiAction,
  uiMode,
}: {
  eventId: string;
  coupleA: string;
  onNavigate?: (s: NavigateTarget) => void;
  onUiAction?: (action: AgentUiAction) => void;
  uiMode: 'chat' | 'classic';
}) {
  const supabase = useMemo(() => createClient(), []);
  const { refresh } = useWedding();
  const { t } = useLang();

  const [view, setView] = useState<View>('chat');
  const [threads, setThreads] = useState<ChatThreadRow[]>([]);
  const [threadsLoaded, setThreadsLoaded] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  // Whose messages are on screen. A thread the current turn just created
  // counts as loaded: its messages are the ones already showing.
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const activeIdRef = useRef(activeId);
  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);
  const composer = useRef<ComposerHandle>(null);

  const bumpThread = useCallback((id: string, at = new Date().toISOString()) => {
    setThreads((list) => {
      const th = list.find((x) => x.id === id);
      if (!th) return list;
      return [{ ...th, updated_at: at }, ...list.filter((x) => x.id !== id)];
    });
  }, []);

  const { messages, setMessages, busy, liveTools, sendMessage } = useAgentChat({
    initialEventId: eventId,
    threadId: activeId,
    onThreadCreated: (thread) => {
      setLoadedFor(thread.id);
      setThreads((list) => [thread, ...list.filter((x) => x.id !== thread.id)]);
      setActiveId(thread.id);
    },
    onTurnComplete: () => {
      void refresh();
      if (activeIdRef.current) bumpThread(activeIdRef.current);
    },
    onUiAction,
    uiMode,
  });

  const fetchThreads = useCallback(
    () => supabase
      .from('chat_threads')
      .select('*')
      .eq('event_id', eventId)
      .order('updated_at', { ascending: false })
      .limit(100)
      .then(({ data }) => (data ?? []) as ChatThreadRow[]),
    [supabase, eventId],
  );

  // Open on the latest conversation.
  useEffect(() => {
    let cancelled = false;
    void fetchThreads().then((rows) => {
      if (cancelled) return;
      setThreads(rows);
      setThreadsLoaded(true);
      if (rows[0]) setActiveId(rows[0].id);
    });
    return () => { cancelled = true; };
  }, [fetchThreads]);

  // The open conversation's messages.
  useEffect(() => {
    if (!activeId || loadedFor === activeId) return;
    let cancelled = false;
    supabase
      .from('chat_messages')
      .select('*')
      .eq('thread_id', activeId)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (cancelled) return;
        setMessages((data ?? []) as ChatMessageRow[]);
        setLoadedFor(activeId);
      });
    return () => { cancelled = true; };
  }, [supabase, activeId, loadedFor, setMessages]);

  // Live messages from elsewhere: the partner, the reply poller, outreach reports.
  useEffect(() => {
    const channel = supabase
      .channel(`ava-${eventId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `event_id=eq.${eventId}` },
        (p) => {
          const row = p.new as ChatMessageRow;
          if (!row.thread_id) return;
          if (row.thread_id !== activeIdRef.current) {
            bumpThread(row.thread_id, row.created_at);
            return;
          }
          setMessages((m) => {
            if (m.some((x) => x.id === row.id)) return m;
            if (row.role === 'user') {
              const i = m.findIndex((x) => x.id.startsWith('local-') && x.role === 'user' && x.content === row.content);
              if (i !== -1) {
                const next = [...m];
                next[i] = row;
                return next;
              }
            }
            return [...m, row];
          });
        },
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [supabase, eventId, setMessages, bumpThread]);

  const startNew = () => {
    if (busy) return;
    setActiveId(null);
    setMessages([]);
    setView('chat');
    requestAnimationFrame(() => composer.current?.focus());
  };

  const openThread = (id: string) => {
    if (busy) return;
    setView('chat');
    if (id === activeId) return;
    setMessages([]);
    setActiveId(id);
  };

  const openView = (next: View) => {
    // Pick up conversations the partner started since the panel opened.
    if (next === 'history') void fetchThreads().then(setThreads);
    setView((v) => (v === next ? 'chat' : next));
  };

  const activeThread = threads.find((x) => x.id === activeId);
  const visible = messages.filter((m) => m.role === 'user' || m.role === 'assistant');
  const title = view === 'history' ? t('Samtaler')
    : view === 'memory' ? t('Ava husker')
    : activeThread?.title || t('Ny samtale');

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-[#e7eae6] px-3">
        {view === 'chat' ? (
          <Avatar small />
        ) : (
          <IconButton label={t('Tilbage')} onClick={() => setView('chat')}>
            <ArrowLeft size={17} />
          </IconButton>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-[0.9rem] font-semibold leading-tight text-ink">{title}</div>
          {view === 'chat' && <div className="text-[0.7rem] leading-tight text-muted">Ava</div>}
        </div>
        <IconButton label={t('Tidligere samtaler')} onClick={() => openView('history')} active={view === 'history'} disabled={busy}>
          <History size={17} strokeWidth={1.7} />
        </IconButton>
        <IconButton label={t('Hvad Ava husker')} onClick={() => openView('memory')} active={view === 'memory'}>
          <Brain size={17} strokeWidth={1.7} />
        </IconButton>
        <button
          type="button"
          onClick={startNew}
          disabled={busy}
          className="ml-0.5 inline-flex h-8 items-center gap-1 rounded-full bg-ink pl-2.5 pr-3 text-[0.78rem] font-semibold text-canvas transition-[background-color,transform] duration-150 hover:bg-ink/90 active:scale-[0.97] disabled:opacity-40 cursor-pointer disabled:cursor-default"
        >
          <Plus size={15} strokeWidth={2.2} /> {t('Ny')}
        </button>
      </header>

      {/* ── Body ───────────────────────────────────────────────────── */}
      {view === 'history' ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-2">
          <ThreadList threads={threads} loading={!threadsLoaded} activeId={activeId} onOpen={openThread} />
        </div>
      ) : view === 'memory' ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-3">
          <MemoryView eventId={eventId} />
        </div>
      ) : (
        <Messages
          key={activeId ?? 'new'}
          messages={visible}
          busy={busy}
          liveTools={liveTools}
          loading={activeId ? loadedFor !== activeId : !threadsLoaded}
          coupleA={coupleA}
          onNavigate={onNavigate}
          onSuggestion={(s) => void sendMessage(t(s))}
        />
      )}

      {view === 'chat' && (
        <div className="shrink-0 px-3 pb-3 pt-1">
          <Composer
            ref={composer}
            busy={busy}
            placeholder={t('Skriv til Ava, {name}…', { name: coupleA || t('du') })}
            onSend={(text) => void sendMessage(text)}
          />
        </div>
      )}
    </div>
  );
}

function Messages({
  messages,
  busy,
  liveTools,
  loading,
  coupleA,
  onNavigate,
  onSuggestion,
}: {
  messages: ChatMessageView[];
  busy: boolean;
  liveTools: Parameters<typeof ToolSteps>[0]['calls'];
  loading: boolean;
  coupleA: string;
  onNavigate?: (s: NavigateTarget) => void;
  onSuggestion: (s: string) => void;
}) {
  const { t } = useLang();
  const { venues, refresh } = useWedding();
  const scroller = useRef<HTMLDivElement>(null);
  // Follow new messages only while the couple is at the bottom already.
  const pinned = useRef(true);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && pinned.current) el.scrollTop = el.scrollHeight;
  }, [messages, liveTools, busy, loading]);

  if (loading) {
    return <div className="flex min-h-0 flex-1 items-center justify-center"><Dots /></div>;
  }

  if (messages.length === 0 && !busy) {
    return (
      <div className="flex min-h-0 flex-1 flex-col justify-end overflow-y-auto px-4 pb-4">
        <Avatar />
        <p className="mt-3 font-serif text-[1.3rem] leading-snug text-ink">
          {coupleA ? t('Hej {name}. Hvad skal vi kigge på?', { name: coupleA }) : t('Hej. Hvad skal vi kigge på?')}
        </p>
        <p className="mt-1.5 text-[0.84rem] leading-relaxed text-muted">
          {t('Jeg kender jeres plan og husker det, I har fortalt mig, også fra tidligere samtaler.')}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onSuggestion(s)}
              className="rounded-full border border-line bg-card px-3.5 py-1.5 text-[0.8rem] text-ink-soft transition-[background-color,color,transform] duration-150 hover:bg-shell hover:text-ink active:scale-[0.97] cursor-pointer"
            >
              {t(s)}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={scroller}
      onScroll={(e) => {
        const el = e.currentTarget;
        pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      }}
      className="hide-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-4"
    >
      <div className="space-y-5">
        {messages.map((m) => (
          <Message key={m.id} msg={m} onNavigate={onNavigate} venues={venues} onRefresh={refresh} />
        ))}
        {busy && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} className="space-y-1.5">
            <ToolSteps calls={liveTools} live />
            <div className="flex items-center gap-2 px-1.5 text-[0.76rem] text-muted">
              <Dots />
              {liveTools.length === 0 && <span>{t('Ava tænker')}</span>}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function Message({
  msg,
  onNavigate,
  venues,
  onRefresh,
}: {
  msg: ChatMessageView;
  onNavigate?: (s: NavigateTarget) => void;
  venues: ReturnType<typeof useWedding>['venues'];
  onRefresh: () => Promise<void>;
}) {
  const { t } = useLang();

  if (msg.role === 'user') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
        className="flex justify-end"
      >
        <div className="max-w-[85%] whitespace-pre-line rounded-[18px] rounded-br-md bg-ink px-4 py-2.5 text-[0.92rem] leading-relaxed text-canvas">
          {msg.content}
        </div>
      </motion.div>
    );
  }

  const tools = msg.tool_calls ?? [];
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
      className="space-y-2"
    >
      {tools.length > 0 && <ToolSteps calls={tools} />}
      {msg.error ? (
        <div className="flex items-start gap-2 rounded-xl border border-[#ecd3cb] bg-[#fbf3f0] px-3 py-2.5 text-[0.84rem] leading-snug text-[#8a3f2f]">
          <CircleAlert size={15} className="mt-px shrink-0" />
          <span>{t('Det gik galt: {error}. Prøv igen om lidt.', { error: msg.error })}</span>
        </div>
      ) : (
        msg.content && (
          <div className="text-[0.93rem] leading-relaxed text-ink">
            <RichText text={msg.content} />
          </div>
        )
      )}
      {msg.payload && (
        <PayloadCard payload={msg.payload} onNavigate={onNavigate} venues={venues} onRefresh={onRefresh} />
      )}
    </motion.div>
  );
}

function IconButton({
  label, onClick, active = false, disabled = false, children,
}: {
  label: string; onClick: () => void; active?: boolean; disabled?: boolean; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-full transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-default',
        active ? 'bg-ink/[0.08] text-ink' : 'text-ink-soft hover:bg-ink/[0.05] hover:text-ink',
      )}
    >
      {children}
    </button>
  );
}

function Avatar({ small = false }: { small?: boolean }) {
  return (
    <div className={cn('flex shrink-0 items-center justify-center rounded-full bg-ink-deep', small ? 'size-8' : 'size-10')}>
      <span className={cn('font-serif leading-none text-white', small ? 'text-[1.05rem]' : 'text-[1.3rem]')}>K</span>
    </div>
  );
}

function Dots() {
  return (
    <span className="inline-flex gap-1" aria-hidden>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="size-1.5 rounded-full bg-muted"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1, repeat: Infinity, delay: i * 0.18 }}
        />
      ))}
    </span>
  );
}
