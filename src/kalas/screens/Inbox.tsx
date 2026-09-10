"use client";

/* Henvendelser — the visual outreach inbox. Shows every vendor Ava has
   emailed, the full thread of replies, the quotes she extracted, and any
   files vendors sent back. All wired to the real coordination backend
   (outbound_emails · email_replies · email_attachments · reply_proposals). */

import { useMemo, useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, FileText, Star, Inbox as InboxIcon } from 'lucide-react';
import { useWedding } from '../useWedding';
import { useLang } from '../i18n';
import { Chip, Pill, cn } from '../ui';
import type { NavigateTarget } from '../lib/hub-nav';
import { createClient } from '@/lib/supabase/client';
import type {
  EmailAttachmentRow, EmailReplyRow, OutboundEmailRow, ReplyProposalRow, VenueRow,
} from '@/lib/db/types';

const CAT_DA: Record<string, string> = {
  venue: 'Venue', florist: 'Blomster', photographer: 'Foto',
  musician: 'Musik', caterer: 'Catering', planner: 'Planlægger', other: 'Andet',
};

type Tab = 'threads' | 'quotes' | 'files';

/* ══════════════════════════════════════════════════════════════════════ */
export default function Inbox({ onNavigate, embedded }: { onNavigate?: (s: NavigateTarget) => void; embedded?: boolean }) {
  const { loading, venues, outbound, replies, attachments, proposals, refresh } = useWedding();
  const { t } = useLang();
  const [tab, setTab] = useState<Tab>('threads');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [catFilter, setCatFilter] = useState<string>('all');

  const contacted = useMemo(() => {
    // Replies count too: a tag-matched reply can exist for a vendor that
    // wrote to the plus address before any outreach went out.
    const ids = new Set([
      ...outbound.map((o) => o.venue_id),
      ...replies.map((r) => r.venue_id),
    ]);
    return venues.filter((v) => ids.has(v.id));
  }, [outbound, replies, venues]);

  if (loading) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Dots /></div>;
  }

  if (contacted.length === 0 && replies.length === 0) {
    return (
      <div className={cn('flex flex-col items-center justify-center text-center', embedded ? 'min-h-[40vh] px-0' : 'min-h-[60vh] px-6')}>
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-ink">
          <InboxIcon size={20} className="text-canvas" />
        </div>
        <h2 className="display mt-5 text-[1.8rem] text-ink">{t('Ingen henvendelser endnu')}</h2>
        <p className="mt-2 max-w-sm text-[0.9rem] text-ink-soft">
          {t('Når Ava skriver til venues og leverandører, samles alle samtaler, tilbud og filer her, så I har ét sted til al koordinering.')}
        </p>
        <div className="mt-6"><Pill arrow onClick={() => onNavigate?.('ava')}>{t('Bed Ava tage kontakt')}</Pill></div>
      </div>
    );
  }

  const cats = Array.from(new Set(contacted.map((v) => v.category)));
  const visible = catFilter === 'all' ? contacted : contacted.filter((v) => v.category === catFilter);
  const selected = venues.find((v) => v.id === selectedId) ?? null;
  const unreadByVenue = new Map<string, number>();
  for (const r of replies) if (!r.read_at) unreadByVenue.set(r.venue_id, (unreadByVenue.get(r.venue_id) ?? 0) + 1);
  const totalUnread = replies.filter((r) => !r.read_at).length;

  const openThread = async (venueId: string) => {
    setSelectedId(venueId);
    const unread = replies.filter((r) => r.venue_id === venueId && !r.read_at);
    if (unread.length) {
      await Promise.all(unread.map((r) => fetch(`/api/replies/${r.id}/read`, { method: 'POST' })));
      await refresh();
    }
  };

  const tabLabels: [Tab, string][] = [
    ['threads', totalUnread ? t('Samtaler · {n}', { n: totalUnread }) : t('Samtaler')],
    ['quotes', t('Tilbud')],
    ['files', t('Filer · {n}', { n: attachments.length })],
  ];

  return (
    <div className={embedded ? 'pt-2' : 'px-6 py-8 sm:px-9 lg:px-12 lg:py-8'}>
      {!embedded && (
        <p className="max-w-lg text-[0.9rem] text-ink-soft">
          {t('Ava skriver på jeres vegne fra én central postkasse. Her ser I hvem hun har kontaktet, hvad de svarer, og godkender hendes svar før de sendes.')}
        </p>
      )}

      {/* Tabs */}
      <div className={cn('flex gap-1 rule-b', embedded ? 'mt-2' : 'mt-6')}>
        {tabLabels.map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={cn('relative px-5 py-3 text-[0.85rem] transition-colors cursor-pointer',
              tab === id ? 'text-ink' : 'text-muted hover:text-ink')}>
            {label}
            {tab === id && <motion.span layoutId="inbox-tab" className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-sage" />}
          </button>
        ))}
      </div>

      {tab === 'threads' && (
        <div className="mt-6 grid gap-6 lg:grid-cols-[320px_1fr]">
          {/* Vendor list */}
          <div className={cn('min-w-0', selected && 'hidden lg:block')}>
            {cats.length > 1 && (
              <div className="mb-4 flex flex-wrap gap-2">
                <FilterChip label={t('Alle')} active={catFilter === 'all'} onClick={() => setCatFilter('all')} />
                {cats.map((c) => (
                  <FilterChip key={c} label={t(CAT_DA[c] ?? c)} active={catFilter === c} onClick={() => setCatFilter(c)} />
                ))}
              </div>
            )}
            <div className="divide-y divide-[var(--color-line)] rule rounded-2xl bg-card overflow-hidden">
              {visible.map((v) => {
                const thread = buildThread(v.id, outbound, replies, attachments);
                const last = thread[thread.length - 1];
                const unread = unreadByVenue.get(v.id) ?? 0;
                return (
                  <button key={v.id} onClick={() => openThread(v.id)}
                    className={cn('flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors',
                      selectedId === v.id ? 'bg-shell' : 'hover:bg-shell')}>
                    <VenueThumb v={v} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-serif text-[1rem] text-ink">{v.name}</span>
                        {unread > 0 && <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--color-terracotta)]" />}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[0.7rem] text-muted">
                        <span>{t(CAT_DA[v.category] ?? v.category)}</span>
                        {v.booked_at && <Chip tone="sage">{t('Booket')}</Chip>}
                      </div>
                      <p className="mt-1 truncate text-[0.76rem] text-muted">
                        {last
                          ? `${last.direction === 'out' ? `${t('Ava')}: ` : ''}${last.body.slice(0, 54)}`
                          : t('Ingen beskeder')}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Thread detail */}
          <div className={cn('min-w-0', !selected && 'hidden lg:block')}>
            {selected ? (
              <ThreadDetail venue={selected}
                messages={buildThread(selected.id, outbound, replies, attachments)}
                proposal={latestProposal(selected.id, replies, proposals)}
                onBack={() => setSelectedId(null)}
                onNavigate={onNavigate}
                onChanged={refresh} />
            ) : (
              <div className="flex h-full min-h-[40vh] items-center justify-center rounded-2xl rule bg-card px-8 text-center">
                <div>
                  <p className="text-[2rem]">📨</p>
                  <p className="mt-3 max-w-xs text-[0.85rem] text-muted">
                    {t('Vælg en leverandør for at se samtalen, deres svar og filer. Ava forbereder et svar til hvert svar, som I godkender.')}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'quotes' && (
        <QuotesTab venues={venues} outbound={outbound} replies={replies} onChanged={refresh} />
      )}

      {tab === 'files' && (
        <FilesTab venues={venues} attachments={attachments} />
      )}
    </div>
  );
}

/* ── Thread building ─────────────────────────────────────────────────── */
type ThreadMsg = {
  id: string; direction: 'out' | 'in'; body: string; at: string;
  attachments?: EmailAttachmentRow[]; reply?: EmailReplyRow;
};
function buildThread(venueId: string, outbound: OutboundEmailRow[], replies: EmailReplyRow[], attachments: EmailAttachmentRow[]): ThreadMsg[] {
  const attByReply = new Map<string, EmailAttachmentRow[]>();
  for (const a of attachments) attByReply.set(a.email_reply_id, [...(attByReply.get(a.email_reply_id) ?? []), a]);
  const outs: ThreadMsg[] = outbound.filter((o) => o.venue_id === venueId)
    .map((o) => ({ id: `out-${o.id}`, direction: 'out' as const, body: o.body, at: o.sent_at ?? o.created_at }));
  const ins: ThreadMsg[] = replies.filter((r) => r.venue_id === venueId)
    .map((r) => ({ id: `in-${r.id}`, direction: 'in' as const, body: r.body ?? r.snippet ?? '', at: r.received_at ?? r.created_at, attachments: attByReply.get(r.id), reply: r }));
  return [...outs, ...ins].sort((a, b) => a.at.localeCompare(b.at));
}
function latestProposal(venueId: string, replies: EmailReplyRow[], proposals: ReplyProposalRow[]): ReplyProposalRow | null {
  const latestReply = replies.filter((r) => r.venue_id === venueId)
    .sort((a, b) => (b.received_at ?? b.created_at).localeCompare(a.received_at ?? a.created_at))[0];
  if (!latestReply) return null;
  return proposals.filter((p) => p.status === 'proposed' && p.email_reply_id === latestReply.id).slice(-1)[0] ?? null;
}

/* ── Thread detail ───────────────────────────────────────────────────── */
function ThreadDetail({ venue, messages, proposal, onBack, onNavigate, onChanged }: {
  venue: VenueRow; messages: ThreadMsg[]; proposal: ReplyProposalRow | null;
  onBack: () => void; onNavigate?: (s: NavigateTarget) => void; onChanged: () => Promise<void>;
}) {
  const { t } = useLang();
  const [booking, setBooking] = useState(false);
  const book = async () => {
    setBooking(true);
    try {
      await fetch(`/api/venues/${venue.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ booked: true }) });
      await onChanged();
    } finally { setBooking(false); }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="flex min-h-[40vh] flex-col rounded-2xl rule bg-card overflow-hidden">
      <header className="flex items-center justify-between gap-3 rule-b px-5 py-4">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onBack} aria-label={t('Tilbage')} className="lg:hidden text-muted hover:text-ink cursor-pointer"><ArrowLeft size={18} /></button>
          <div className="min-w-0">
            <h2 className="truncate font-serif text-[1.2rem] text-ink">{venue.name}</h2>
            <p className="text-[0.72rem] text-muted">
              {t(CAT_DA[venue.category] ?? venue.category)}
              {venue.rating != null && <> · <Star size={10} className="inline -mt-0.5 text-sage" /> {Number(venue.rating).toFixed(1)}</>}
            </p>
          </div>
        </div>
        {venue.booked_at
          ? <Chip tone="sage">{t('Booket 🎉')}</Chip>
          : <button onClick={book} disabled={booking}
              className="shrink-0 rounded-full border border-ink px-3.5 py-1.5 text-[0.72rem] font-medium text-ink hover:bg-sage-tint transition-colors cursor-pointer disabled:opacity-50">
              {booking ? '…' : t('Markér booket')}
            </button>}
      </header>

      <div className="flex-1 space-y-3 px-5 py-5">
        {messages.map((m) => (
          <div key={m.id} className={cn('flex', m.direction === 'out' ? 'justify-end' : 'justify-start')}>
            <div className={cn('max-w-[82%] rounded-2xl px-4 py-3',
              m.direction === 'out' ? 'rounded-br-md bg-ink text-canvas' : 'rounded-bl-md rule bg-canvas text-ink')}>
              <p className="whitespace-pre-wrap text-[0.9rem] leading-relaxed">{m.body}</p>
              {m.reply?.quote?.summary && (
                <div className="mt-2 rounded-lg bg-sage-tint px-3 py-2 text-[0.78rem] text-ink">
                  💬 {m.reply.quote.summary}
                  {m.reply.quote.price_amount != null && (
                    <span className="ml-1 font-semibold">{m.reply.quote.price_amount.toLocaleString('da-DK')} {m.reply.quote.currency ?? ''}</span>
                  )}
                </div>
              )}
              {m.attachments && m.attachments.length > 0 && <Attachments attachments={m.attachments} />}
            </div>
          </div>
        ))}
      </div>

      {proposal && (
        <ProposalReply proposal={proposal} venueName={venue.name} onNavigate={onNavigate} onChanged={onChanged} />
      )}
    </motion.div>
  );
}

/* ── Ava's suggested reply (approve / dismiss / regenerate) ──────────── */
function ProposalReply({ proposal, venueName, onNavigate, onChanged }: {
  proposal: ReplyProposalRow; venueName: string; onNavigate?: (s: NavigateTarget) => void; onChanged: () => Promise<void>;
}) {
  const { t } = useLang();
  const [body, setBody] = useState(proposal.body);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<'sent' | 'dismissed' | null>(null);

  const send = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/proposals/${proposal.id}/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body }) });
      if (res.ok) { setDone('sent'); await onChanged(); }
    } finally { setBusy(false); }
  };
  const dismiss = async () => {
    setBusy(true);
    try { await fetch(`/api/proposals/${proposal.id}/dismiss`, { method: 'POST' }); setDone('dismissed'); await onChanged(); }
    finally { setBusy(false); }
  };
  const regenerate = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/replies/${proposal.email_reply_id}/propose`, { method: 'POST' });
      if (res.ok) { const fresh = (await res.json()) as ReplyProposalRow; setBody(fresh.body); }
    } finally { setBusy(false); }
  };

  if (done) {
    return <div className="rule-t bg-sage-tint px-5 py-3 text-[0.8rem] font-medium text-ink">
      {done === 'sent' ? t('Svar sendt ✓') : t('Svar afvist')}
    </div>;
  }

  return (
    <div className="rule-t bg-shell px-5 py-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-ink">{t('Avas foreslåede svar')}</span>
        <button disabled={busy} onClick={regenerate} className="text-[0.72rem] text-muted underline-offset-2 hover:underline disabled:opacity-50 cursor-pointer">{t('Generér igen')}</button>
      </div>
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5}
        className="w-full resize-none rounded-xl rule bg-canvas px-4 py-3 text-[0.9rem] leading-relaxed text-ink focus:border-ink focus:outline-none" />
      <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
        <button disabled={busy || !body.trim()} onClick={send}
          className="rounded-full bg-ink px-4 py-2 text-[0.78rem] font-medium text-canvas hover:bg-ink/90 transition-colors cursor-pointer disabled:opacity-50">
          {busy ? t('Sender…') : t('Godkend & send')}
        </button>
        <button onClick={() => onNavigate?.('ava')}
          className="rounded-full rule px-4 py-2 text-[0.78rem] text-ink-soft hover:bg-card transition-colors cursor-pointer">
          {t('Tal med Ava')}
        </button>
        <button disabled={busy} onClick={dismiss}
          className="rounded-full px-3 py-2 text-[0.78rem] text-muted hover:text-ink transition-colors cursor-pointer disabled:opacity-50">
          {t('Afvis')}
        </button>
      </div>
      <p className="mt-2 text-[0.68rem] text-muted">{t('Til {name} · sendes fra jeres Kalas-postkasse', { name: venueName })}</p>
    </div>
  );
}

/* ── Quotes comparison tab ───────────────────────────────────────────── */
function QuotesTab({ venues, outbound, replies, onChanged }: {
  venues: VenueRow[]; outbound: OutboundEmailRow[]; replies: EmailReplyRow[]; onChanged: () => Promise<void>;
}) {
  const { t } = useLang();
  const shortlist = venues.filter((v) => v.swipe_status === 'liked' || outbound.some((o) => o.venue_id === v.id));
  if (shortlist.length === 0) {
    return <p className="mt-10 text-center font-serif text-[1.1rem] italic text-muted">
      {t('Ingen leverandører på listen endnu, like nogen, så samler Ava tilbuddene her.')}
    </p>;
  }
  return (
    <div className="mt-6 space-y-3">
      {shortlist.map((v) => (
        <QuoteCard key={v.id} venue={v} outbound={outbound.find((o) => o.venue_id === v.id)}
          replies={replies.filter((r) => r.venue_id === v.id)} onChanged={onChanged} />
      ))}
    </div>
  );
}

function quoteBadge(outbound?: OutboundEmailRow, latest?: EmailReplyRow): { label: string; tone: 'sage' | 'clay' | 'success' | 'neutral' } {
  if (latest) {
    switch (latest.quote_status) {
      case 'quoted': return { label: 'Tilbud', tone: 'success' };
      case 'no_availability': return { label: 'Ingen ledig dato', tone: 'clay' };
      case 'needs_info': return { label: 'Mangler info', tone: 'clay' };
      default: return { label: 'Svar modtaget', tone: 'neutral' };
    }
  }
  switch (outbound?.status) {
    case 'sent': return { label: 'Sendt · afventer', tone: 'neutral' };
    case 'failed': return { label: 'Send fejlede', tone: 'clay' };
    default: return { label: 'Ikke kontaktet', tone: 'neutral' };
  }
}

function QuoteCard({ venue, outbound, replies, onChanged }: {
  venue: VenueRow; outbound?: OutboundEmailRow; replies: EmailReplyRow[]; onChanged: () => Promise<void>;
}) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const latest = [...replies].sort((a, b) => (b.received_at ?? b.created_at).localeCompare(a.received_at ?? a.created_at))[0];
  const badge = quoteBadge(outbound, latest);
  const quote = latest?.quote;

  const book = async () => {
    setBusy(true);
    try {
      await fetch(`/api/venues/${venue.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ booked: true }) });
      await onChanged();
    } finally { setBusy(false); }
  };

  return (
    <div className="rule rounded-2xl bg-card overflow-hidden">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left cursor-pointer">
        <div className="flex min-w-0 items-center gap-3">
          <VenueThumb v={venue} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate font-serif text-[1.05rem] text-ink">{venue.name}</span>
              {venue.booked_at && <Chip tone="sage">{t('Jeres valg 🎉')}</Chip>}
            </div>
            <p className="mt-0.5 truncate text-[0.72rem] text-muted">
              {outbound
                ? t('Sendt til {email}', { email: outbound.to_email })
                : venue.email ?? t('Ingen kontakt-email')}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {quote?.has_quote && quote.price_amount != null && (
            <span className="font-serif text-[1rem] text-ink">
              {quote.price_amount.toLocaleString('da-DK')} {quote.currency ?? ''}
            </span>
          )}
          <Chip tone={badge.tone === 'neutral' ? 'neutral' : badge.tone}>{t(badge.label)}</Chip>
        </div>
      </button>
      {open && (
        <div className="rule-t px-5 py-4 text-[0.88rem]">
          {outbound?.status === 'failed' && (
            <p className="text-[var(--color-terracotta)]">
              {t('Fejl ved afsendelse: {error}', { error: outbound.error ?? '' })}
            </p>
          )}
          {latest ? (
            <>
              {quote?.summary && <p className="text-ink-soft">{quote.summary}</p>}
              {quote?.conditions && (
                <p className="mt-1 text-[0.78rem] text-muted">
                  {t('Betingelser: {conditions}', { conditions: quote.conditions })}
                </p>
              )}
              <details className="mt-3">
                <summary className="cursor-pointer text-[0.76rem] text-muted hover:text-ink">{t('Hele svaret')}</summary>
                <pre className="mt-2 max-h-56 overflow-y-auto whitespace-pre-wrap rounded-xl bg-shell p-3 font-sans text-[0.78rem] leading-relaxed text-ink-soft">
                  {latest.body ?? latest.snippet ?? t('(tomt)')}
                </pre>
              </details>
            </>
          ) : <p className="text-muted">{t('Intet svar endnu.')}</p>}
          {!venue.booked_at && (
            <button onClick={book} disabled={busy}
              className="mt-4 rounded-full bg-ink px-4 py-2 text-[0.78rem] font-medium text-canvas hover:bg-ink/90 transition-colors cursor-pointer disabled:opacity-50">
              {busy ? '…' : t('Vælg denne 🎉')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Files tab ───────────────────────────────────────────────────────── */
function FilesTab({ venues, attachments }: { venues: VenueRow[]; attachments: EmailAttachmentRow[] }) {
  const { t } = useLang();
  const byVenue = useMemo(() => {
    const map = new Map<string, EmailAttachmentRow[]>();
    for (const a of attachments) map.set(a.venue_id, [...(map.get(a.venue_id) ?? []), a]);
    return map;
  }, [attachments]);

  if (attachments.length === 0) {
    return <p className="mt-10 text-center font-serif text-[1.1rem] italic text-muted">
      {t('Ingen filer endnu, menuer, tilbud og billeder fra leverandører samles her.')}
    </p>;
  }
  return (
    <div className="mt-6 space-y-6">
      {[...byVenue.entries()].map(([venueId, files]) => {
        const v = venues.find((x) => x.id === venueId);
        return (
          <div key={venueId}>
            <p className="mb-2 font-serif text-[1.05rem] text-ink">{v?.name ?? t('Leverandør')}</p>
            <Attachments attachments={files} />
          </div>
        );
      })}
    </div>
  );
}

/* ── Attachment chips with signed URLs ───────────────────────────────── */
function Attachments({ attachments }: { attachments: EmailAttachmentRow[] }) {
  const [urls, setUrls] = useState<Record<string, string | null>>({});
  useEffect(() => {
    if (attachments.length === 0) return;
    const supabase = createClient();
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(attachments.map(async (a) => {
        const { data } = await supabase.storage.from('vendor-files').createSignedUrl(a.storage_path, 3600);
        return [a.id, data?.signedUrl ?? null] as const;
      }));
      if (!cancelled) setUrls(Object.fromEntries(entries));
    })();
    return () => { cancelled = true; };
  }, [attachments]);

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {attachments.map((a) => {
        const url = urls[a.id] ?? undefined;
        const isImg = a.mime_type?.startsWith('image/');
        if (isImg && url) {
          return (
            <a key={a.id} href={url} target="_blank" rel="noopener noreferrer"
              className="block h-20 w-20 overflow-hidden rounded-lg rule">
              <img src={url} alt={a.filename} className="h-full w-full object-cover" />
            </a>
          );
        }
        return (
          <a key={a.id} href={url ?? '#'} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-lg rule bg-canvas px-3 py-2 text-[0.76rem] text-ink-soft hover:bg-shell transition-colors">
            <FileText size={14} className="text-muted" />
            <span className="max-w-[140px] truncate">{a.filename}</span>
          </a>
        );
      })}
    </div>
  );
}

/* ── Small bits ──────────────────────────────────────────────────────── */
function VenueThumb({ v }: { v: VenueRow }) {
  const src = v.image_url ?? v.photo_urls?.[0];
  return (
    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-shell">
      {src ? <img src={src} alt="" className="h-full w-full object-cover" />
           : <div className="flex h-full w-full items-center justify-center text-[0.9rem]">📍</div>}
    </div>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={cn('rounded-full border px-3.5 py-1.5 text-[0.78rem] transition-colors cursor-pointer',
        active ? 'border-ink bg-sage-tint text-ink font-medium' : 'border-[var(--color-line-strong)] text-ink-soft hover:bg-shell')}>
      {label}
    </button>
  );
}

function Dots() {
  return (
    <div className="flex gap-1.5">
      {[0, 1, 2].map((i) => (
        <motion.span key={i} className="h-1.5 w-1.5 rounded-full bg-muted"
          animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.18 }} />
      ))}
    </div>
  );
}
