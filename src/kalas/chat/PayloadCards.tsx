"use client";

/* The cards Ava attaches to a reply: a batch of vendors to open on the board,
   an outreach draft to approve, a proposed answer to a vendor, invitation
   wording. Each reads its own row, so a card stays current after a reload. */

import { useEffect, useMemo, useState } from 'react';
import { MapPin, Copy, Check } from 'lucide-react';
import { useWedding } from '../useWedding';
import { useLang } from '../i18n';
import type { NavigateTarget } from '../lib/hub-nav';
import { navigateToHub } from '../lib/hub-nav';
import { createClient } from '@/lib/supabase/client';
import type { ChatMessageRow, ReplyProposalRow, EmailDraftRow, VenueRow, VendorCategory } from '@/lib/db/types';
import {
  batchCategory,
  batchHubCat,
  batchHubTab,
  batchLabel,
  batchSupplierFilter,
} from '@/lib/vendor-batch';

/* ── Interactive payload cards ───────────────────────────────────────── */
export default function PayloadCard({
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
      navigateToHub(batchHubTab(category), filter ? (filter as import('../screens/team/shared').HubCat) : batchHubCat(category));
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
