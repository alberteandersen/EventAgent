"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Send, Paperclip, MapPin, Copy, Check, X } from 'lucide-react';
import { useWedding } from '../useWedding';
import { cn } from '../ui';
import { useLang } from '../i18n';
import type { NavigateTarget } from '../lib/hub-nav';
import { navigateToHub } from '../lib/hub-nav';
import { createClient } from '@/lib/supabase/client';
import { useAgentChat } from '@/lib/hooks/useAgentChat';
import type { AgentUiAction, ChatMessageRow, ReplyProposalRow, EmailDraftRow, VenueRow, VendorCategory } from '@/lib/db/types';
import {
  batchCategory,
  batchHubCat,
  batchHubTab,
  batchLabel,
  batchSupplierFilter,
} from '@/lib/vendor-batch';
import RichText from '../chat/RichText';

export default function Ava({
  onNavigate,
  onClose,
  onUiAction,
  uiMode = 'classic',
  variant = 'page',
  pendingPrompt = null,
  onPendingPromptSent,
  onPendingPromptDone,
}: {
  onNavigate?: (s: NavigateTarget) => void;
  onClose?: () => void;
  /** Applies agent-driven client actions (page navigation) as they stream in. */
  onUiAction?: (action: AgentUiAction) => void;
  uiMode?: 'chat' | 'classic';
  variant?: 'page' | 'drawer';
  /** A prompt handed over by the guided tour, sent once the history is in. */
  pendingPrompt?: string | null;
  onPendingPromptSent?: () => void;
  /** Fires when that prompt's turn has finished, so the tour can react. */
  onPendingPromptDone?: () => void;
}) {
  const { loading, event, couple } = useWedding();
  const { t } = useLang();

  const shellClass = variant === 'drawer'
    ? 'flex h-full flex-col'
    : 'mx-auto flex h-[calc(100dvh-130px)] max-w-2xl flex-col px-5 lg:h-screen';

  if (loading) {
    return (
      <div className={cn(shellClass, 'items-center justify-center px-5')}>
        <TypingDots />
      </div>
    );
  }

  if (!event) {
    return (
      <div className={cn(shellClass, 'flex-col items-center justify-center px-5 text-center')}>
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-ink">
          <span className="font-serif text-[1.5rem] leading-none text-canvas">K</span>
        </div>
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
      onClose={onClose}
      onUiAction={onUiAction}
      uiMode={uiMode}
      variant={variant}
      pendingPrompt={pendingPrompt}
      onPendingPromptSent={onPendingPromptSent}
      onPendingPromptDone={onPendingPromptDone}
    />
  );
}

function AvaChat({
  eventId,
  coupleA,
  onNavigate,
  onClose,
  onUiAction,
  uiMode,
  variant,
  pendingPrompt,
  onPendingPromptSent,
  onPendingPromptDone,
}: {
  eventId: string;
  coupleA: string;
  onNavigate?: (s: NavigateTarget) => void;
  onClose?: () => void;
  onUiAction?: (action: AgentUiAction) => void;
  uiMode: 'chat' | 'classic';
  variant: 'page' | 'drawer';
  pendingPrompt?: string | null;
  onPendingPromptSent?: () => void;
  onPendingPromptDone?: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const { refresh, venues } = useWedding();
  /* Set while a tour prompt is in flight, so its completion can be reported
     back without every other turn in the chat looking like one. */
  const tourTurnRef = useRef(false);
  const { messages, agentStatus, sendMessage, setMessages } = useAgentChat({
    initialEventId: eventId,
    onTurnComplete: () => {
      void refresh();
      if (tourTurnRef.current) {
        tourTurnRef.current = false;
        onPendingPromptDone?.();
      }
    },
    onUiAction,
    uiMode,
  });
  const { t } = useLang();
  const [draft, setDraft] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  // The history load replaces the message array wholesale, so a handed-over
  // prompt must wait for it — otherwise its reply is wiped on arrival.
  const [historyLoaded, setHistoryLoaded] = useState(false);

  // Load the real chat history, then subscribe for live agent/cron messages.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: true });
      if (cancelled) return;
      if (data) setMessages(data as ChatMessageRow[]);
      setHistoryLoaded(true);
    })();
    const channel = supabase
      .channel(`ava-${eventId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `event_id=eq.${eventId}` },
        (p) => {
          const row = p.new as ChatMessageRow;
          setMessages((m) => {
            if (m.some((x) => x.id === row.id)) return m;
            // Replace the optimistic local bubble once the persisted row lands.
            if (row.role === 'user') {
              const i = m.findIndex(
                (x) => x.id.startsWith('local-') && x.role === 'user' && x.content === row.content
              );
              if (i !== -1) {
                const next = [...m];
                next[i] = row;
                return next;
              }
            }
            return [...m, row];
          });
        }
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [supabase, eventId, setMessages]);

  /* A prompt the guided tour handed over — its "prøv" buttons live on the tour
     card, outside this component, in both modes. Waits for the history, then
     clears through the callback so it is sent exactly once. */
  const sentRef = useRef<string | null>(null);
  useEffect(() => {
    if (!historyLoaded || !pendingPrompt) return;
    if (sentRef.current === pendingPrompt) return;
    sentRef.current = pendingPrompt;
    tourTurnRef.current = true;
    void sendMessage(pendingPrompt);
    onPendingPromptSent?.();
  }, [historyLoaded, pendingPrompt, sendMessage, onPendingPromptSent]);


  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, agentStatus]);

  const visible = messages.filter((m) => m.role === 'user' || m.role === 'assistant');

  return (
    <div className={cn(
      'flex flex-col',
      variant === 'drawer' ? 'h-full px-4' : 'mx-auto h-[calc(100dvh-130px)] max-w-2xl px-5 lg:h-screen',
    )}>
      <header className="flex shrink-0 items-center gap-3 py-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#12332b]">
          <span className="font-serif text-[1.3rem] leading-none text-white">K</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-serif text-[1.15rem] text-[#12332b]">Ava</div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label={t('Luk')}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-[#d9ded9] bg-white text-[#12332b] hover:bg-[#fafaf8] cursor-pointer"
          >
            <X size={18} />
          </button>
        )}
      </header>

      <div className="relative min-h-0 flex-1">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-10 bg-gradient-to-b from-[#f4f5f3] to-transparent"
        />
        <div className="hide-scrollbar h-full space-y-4 overflow-y-auto py-5">
          {visible.map((m) => (
            <Bubble key={m.id} msg={m} onNavigate={onNavigate} venues={venues} onRefresh={refresh} />
          ))}
          {agentStatus && <TypingDots label={agentStatus} />}
          <div ref={endRef} />
        </div>
      </div>

      <div className="border-t border-[#d9ded9] pb-3 pt-2">
        <form onSubmit={(e) => { e.preventDefault(); const msg = draft; setDraft(''); void sendMessage(msg); }}
          className="focus-shell flex items-center gap-2 rounded-full rule bg-card px-2 py-2">
          <button type="button" aria-label={t('Vedhæft fil')} disabled
            className="flex h-10 w-10 items-center justify-center rounded-full text-faint cursor-not-allowed">
            <Paperclip size={17} />
          </button>
          <input value={draft} onChange={(e) => setDraft(e.target.value)}
            placeholder={t('Skriv til Ava, {name}…', { name: coupleA || t('du') })}
            aria-label={t('Besked til Ava')}
            className="flex-1 bg-transparent text-[0.98rem] text-ink placeholder:text-faint focus:outline-none" />
          <button type="submit" aria-label={t('Send besked')} disabled={agentStatus !== null || !draft.trim()}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-sage text-ink transition-colors hover:bg-sage-strong cursor-pointer disabled:opacity-50">
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}

function Bubble({
  msg,
  onNavigate,
  venues,
  onRefresh,
}: {
  msg: ChatMessageRow;
  onNavigate?: (s: NavigateTarget) => void;
  venues: VenueRow[];
  onRefresh: () => Promise<void>;
}) {
  const mine = msg.role === 'user';
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
      className={cn('flex flex-col', mine ? 'items-end' : 'items-start')}>
      {msg.content && (
        <div className={cn('max-w-[80%] rounded-3xl px-5 py-3.5 text-[0.97rem] leading-relaxed',
          mine ? 'rounded-br-lg bg-ink text-canvas' : 'rounded-bl-lg rule bg-card text-ink')}>
          {/* The couple's own line is short and literal; Ava's is the one that
              needs paragraphs and bullets to stay skimmable. */}
          {mine ? <span className="whitespace-pre-line">{msg.content}</span> : <RichText text={msg.content} />}
        </div>
      )}
      {msg.payload && (
        <div className="mt-2 w-full max-w-[80%]">
          <PayloadCard payload={msg.payload} onNavigate={onNavigate} venues={venues} onRefresh={onRefresh} />
        </div>
      )}
    </motion.div>
  );
}

/* ── Interactive payload cards ───────────────────────────────────────── */
function PayloadCard({
  payload,
  onNavigate,
  venues,
  onRefresh,
}: {
  payload: NonNullable<ChatMessageRow['payload']>;
  onNavigate?: (s: NavigateTarget) => void;
  venues: VenueRow[];
  onRefresh: () => Promise<void>;
}) {
  const { t, lang } = useLang();
  switch (payload.kind) {
    case 'venue_batch':
      return (
        <VenueBatchCard
          payload={payload}
          venues={venues}
          onNavigate={onNavigate}
          onRefresh={onRefresh}
          label={(category, count) => batchLabel(category, lang, count)}
        />
      );
    case 'reply_proposal':
      return <ProposalCard proposalId={payload.proposal_id} onNavigate={onNavigate} />;
    case 'draft':
      return <DraftCard draftId={payload.draft_id} />;
    case 'invite_brief':
      return <InviteBriefCard wording={payload.wording} style={payload.style} onNavigate={onNavigate} />;
    case 'send_report':
      return (
        <div className="rounded-full bg-sage-tint px-4 py-2 text-[0.78rem] text-ink">
          {t('Sendt til {sent}', { sent: payload.sent })}{payload.skipped ? t(', {n} sprunget over', { n: payload.skipped }) : ''}{payload.failed ? t(', {n} fejlede', { n: payload.failed }) : ''}.
        </div>
      );
    default:
      return null;
  }
}

function VenueBatchCard({
  payload,
  venues,
  onNavigate,
  onRefresh,
  label,
}: {
  payload: Extract<NonNullable<ChatMessageRow['payload']>, { kind: 'venue_batch' }>;
  venues: VenueRow[];
  onNavigate?: (s: NavigateTarget) => void;
  onRefresh: () => Promise<void>;
  label: (category: VendorCategory, count: number) => string;
}) {
  const [busy, setBusy] = useState(false);
  const supabase = useMemo(() => createClient(), []);

  const openBoard = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onRefresh();
      let rows: { id: string; category: VendorCategory }[] = venues;
      if (payload.venue_ids.length > 0) {
        const { data } = await supabase
          .from('venues')
          .select('id, category')
          .in('id', payload.venue_ids);
        if (data?.length) rows = data as { id: string; category: VendorCategory }[];
      }
      const category = batchCategory(payload, rows);
      const filter = batchSupplierFilter(category);
      navigateToHub(batchHubTab(category), filter ? (filter as import('./team/shared').HubCat) : batchHubCat(category));
      onNavigate?.('team');
    } finally {
      setBusy(false);
    }
  };

  const category = batchCategory(payload, venues);

  return (
    <ActionPill onClick={() => void openBoard()}>
      <MapPin size={13} /> {label(category, payload.venue_ids.length)}
    </ActionPill>
  );
}

function ActionPill({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="inline-flex items-center gap-2 rounded-full bg-sage-tint px-4 py-2 text-[0.78rem] font-medium text-ink hover:bg-sage transition-colors cursor-pointer">
      {children}
    </button>
  );
}

function CardShell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl rule bg-card p-4">
      <p className="mb-2 text-[0.64rem] font-semibold uppercase tracking-[0.14em] text-ink">{label}</p>
      {children}
    </div>
  );
}

function ProposalCard({ proposalId, onNavigate }: { proposalId: string; onNavigate?: (s: NavigateTarget) => void }) {
  const { t } = useLang();
  const supabase = useMemo(() => createClient(), []);
  const { refresh } = useWedding();
  const [proposal, setProposal] = useState<ReplyProposalRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<'sent' | 'dismissed' | null>(null);

  useEffect(() => {
    supabase.from('reply_proposals').select('*').eq('id', proposalId).maybeSingle()
      .then(({ data }) => setProposal((data as ReplyProposalRow | null) ?? null));
  }, [supabase, proposalId]);

  if (!proposal) return null;
  const settled = done ?? (proposal.status !== 'proposed' ? proposal.status : null);

  const act = async (kind: 'send' | 'dismiss') => {
    setBusy(true);
    try {
      const res = await fetch(`/api/proposals/${proposalId}/${kind}`, { method: 'POST' });
      if (res.ok) { setDone(kind === 'send' ? 'sent' : 'dismissed'); await refresh(); }
    } finally { setBusy(false); }
  };

  return (
    <CardShell label={t('Foreslået svar til leverandør')}>
      <p className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-xl bg-shell px-3 py-2.5 text-[0.85rem] leading-relaxed text-ink-soft">
        {proposal.body}
      </p>
      {settled ? (
        <p className="mt-2.5 text-[0.76rem] font-medium text-success">{settled === 'sent' ? t('Sendt ✓') : t('Afvist')}</p>
      ) : (
        <div className="mt-2.5 flex flex-wrap gap-2">
          <button disabled={busy} onClick={() => act('send')}
            className="rounded-full bg-ink px-4 py-2 text-[0.76rem] font-medium text-canvas hover:bg-ink/90 transition-colors cursor-pointer disabled:opacity-50">
            {busy ? t('Sender…') : t('Godkend & send')}
          </button>
          <button onClick={() => onNavigate?.('inbox')}
            className="rounded-full rule px-4 py-2 text-[0.76rem] text-ink-soft hover:bg-shell transition-colors cursor-pointer">
            {t('Se i indbakke')}
          </button>
          <button disabled={busy} onClick={() => act('dismiss')}
            className="rounded-full px-3 py-2 text-[0.76rem] text-muted hover:text-ink transition-colors cursor-pointer disabled:opacity-50">
            {t('Afvis')}
          </button>
        </div>
      )}
    </CardShell>
  );
}

function DraftCard({ draftId }: { draftId: string }) {
  const { t, tn } = useLang();
  const supabase = useMemo(() => createClient(), []);
  const { venues, refresh } = useWedding();
  const [draft, setDraft] = useState<EmailDraftRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    supabase.from('email_drafts').select('*').eq('id', draftId).maybeSingle()
      .then(({ data }) => setDraft((data as EmailDraftRow | null) ?? null));
  }, [supabase, draftId]);

  if (!draft) return null;
  const recipients = venues.filter((v: VenueRow) => v.swipe_status === 'liked' && v.category === draft.category);

  const approve = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/drafts/${draft.id}/approve`, { method: 'POST' });
      if (res.ok) { setSent(true); await refresh(); }
    } finally { setBusy(false); }
  };

  return (
    <CardShell label={t('Udkast · henvendelse')}>
      <p className="text-[0.9rem] font-medium text-ink">{draft.subject}</p>
      <p className="mt-1.5 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-xl bg-shell px-3 py-2.5 text-[0.82rem] leading-relaxed text-ink-soft">
        {draft.body_template}
      </p>
      <p className="mt-2 text-[0.74rem] text-muted">
        {tn(recipients.length, 'Ava skriver til den valgte leverandør', 'Ava skriver individuelt til {n} valgte leverandører')}
        {recipients.length > 0 && `: ${recipients.map((v) => v.name).join(', ')}`}.
      </p>
      {draft.status !== 'proposed' || sent ? (
        <p className="mt-2.5 text-[0.76rem] font-medium text-success">{t('Sendt ✓')}</p>
      ) : (
        <button disabled={busy || recipients.length === 0} onClick={approve}
          className="mt-2.5 rounded-full bg-ink px-4 py-2 text-[0.76rem] font-medium text-canvas hover:bg-ink/90 transition-colors cursor-pointer disabled:opacity-50">
          {busy ? t('Sender…') : t('Godkend & send')}
        </button>
      )}
    </CardShell>
  );
}

function InviteBriefCard({ wording, style, onNavigate }: { wording: string; style: string | null; onNavigate?: (s: NavigateTarget) => void }) {
  const { t } = useLang();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(wording); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* no clipboard */ }
  };
  return (
    <div className="rounded-2xl rule bg-card overflow-hidden">
      <div className="flex items-center justify-between rule-b px-4 py-2.5">
        <span className="text-[0.78rem] font-medium text-ink">{t('💌 Invitationstekst')}</span>
        {style && <span className="rounded-full bg-sage-tint px-2.5 py-0.5 text-[0.68rem] text-ink">{style}</span>}
      </div>
      <p className="whitespace-pre-wrap px-5 py-5 text-center font-serif text-[0.98rem] leading-[1.8] text-ink">{wording}</p>
      <div className="flex items-center gap-2 rule-t px-4 py-3">
        <button onClick={() => onNavigate?.('invites')}
          className="rounded-full bg-ink px-4 py-2 text-[0.76rem] font-medium text-canvas hover:bg-ink/90 transition-colors cursor-pointer">
          {t('Bestil tryk →')}
        </button>
        <button onClick={copy}
          className="inline-flex items-center gap-1.5 rounded-full rule px-4 py-2 text-[0.76rem] text-ink-soft hover:bg-shell transition-colors cursor-pointer">
          {copied ? <><Check size={13} /> {t('Kopieret')}</> : <><Copy size={13} /> {t('Kopiér')}</>}
        </button>
      </div>
    </div>
  );
}

function TypingDots({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-start gap-2">
      <div className="flex gap-1.5 rounded-3xl rounded-bl-lg rule bg-card px-5 py-4">
        {[0, 1, 2].map((i) => (
          <motion.span key={i} className="h-1.5 w-1.5 rounded-full bg-muted"
            animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.18 }} />
        ))}
      </div>
      {label && <span className="text-[0.72rem] italic text-muted">{label}</span>}
    </div>
  );
}
