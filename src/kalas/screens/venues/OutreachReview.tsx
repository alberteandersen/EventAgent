"use client";

import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Check, ArrowLeft, Loader2, Send } from 'lucide-react';
import { useLang } from '../../i18n';
import type { EmailDraftRow } from '@/lib/db/types';
import { type DisplayVenue, imgSrc } from './shared';

/* ══════════════════════════════════════════════════════════════════════
   OUTREACH REVIEW, "here's what Ava will do & who she'll contact" → approve
═══════════════════════════════════════════════════════════════════════ */
export function OutreachReview({
  recipients, onBack, onApproved, onAva,
}: {
  recipients: DisplayVenue[];
  onBack: () => void; onApproved: () => void; onAva: () => void;
}) {
  const { t, tn } = useLang();
  const [draft, setDraft] = useState<EmailDraftRow | null>(null);
  const [preparing, setPreparing] = useState(true);
  const [prepError, setPrepError] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [approveMsg, setApproveMsg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setPreparing(true);
      setPrepError(null);
      try {
        const res = await fetch('/api/venues/outreach/prepare', { method: 'POST' });
        const data = (await res.json().catch(() => ({}))) as { draft?: EmailDraftRow; error?: string; message?: string };
        if (!alive) return;
        if (!res.ok || !data.draft) {
          setPrepError(data.message ?? t('Kunne ikke forberede henvendelsen lige nu.'));
        } else {
          setDraft(data.draft);
        }
      } catch {
        if (alive) setPrepError(t('Kunne ikke forberede henvendelsen lige nu.'));
      } finally {
        if (alive) setPreparing(false);
      }
    })();
    return () => { alive = false; };
    // Prepared once, as the dialog opens; a language switch does not redo it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const approve = async () => {
    if (!draft) return;
    setApproving(true);
    setApproveMsg(null);
    try {
      const res = await fetch(`/api/drafts/${draft.id}/approve`, { method: 'POST' });
      if (res.status === 503) {
        setApproveMsg(t('Forbind Kalas-postkassen (Gmail) i indstillinger for at sende henvendelserne.'));
      } else if (!res.ok) {
        setApproveMsg(t('Kunne ikke sende lige nu, prøv igen.'));
      } else {
        onApproved();
      }
    } catch {
      setApproveMsg(t('Kunne ikke sende lige nu, prøv igen.'));
    } finally {
      setApproving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="mx-auto max-w-3xl px-6 py-8 sm:px-9 lg:px-12"
    >
      <button type="button" onClick={onBack}
        className="mb-4 flex items-center gap-2 text-[0.72rem] font-medium uppercase tracking-[0.18em] text-muted hover:text-ink transition-colors cursor-pointer">
        <ArrowLeft size={13} /> {t('Tilbage til listen')}
      </button>
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-sage">{t('Trin 3 · Godkend')}</p>
      <h1 className="mt-1 font-serif text-[clamp(1.9rem,4vw,2.4rem)] leading-[1.1] tracking-[-0.02em] text-ink">
        {tn(recipients.length, 'Ava kontakter {n} venue', 'Ava kontakter {n} venues')}
      </h1>
      <p className="mt-2 text-[13px] text-muted">
        {t('Ava sender en personlig mail til hvert sted fra jeres Kalas-postkasse og samler alle svar under Henvendelser. I godkender her, intet sendes uden.')}
      </p>

      {/* Recipients */}
      <div className="mt-6 rounded-2xl border border-line bg-card p-5">
        <p className="text-[0.62rem] font-bold uppercase tracking-[0.18em] text-muted">{t('Modtagere')}</p>
        {recipients.length === 0 ? (
          <p className="mt-3 text-[0.88rem] text-ink-soft">{t('Alle på listen er allerede kontaktet.')}</p>
        ) : (
          <div className="mt-3 flex flex-col divide-y divide-line">
            {recipients.map((v) => (
              <div key={v.id} className="flex items-center gap-3 py-2.5">
                <img src={imgSrc(v.image)} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.9rem] font-bold text-ink">{v.name}</p>
                  {v.location && <p className="truncate text-[0.72rem] text-muted">{v.location}</p>}
                </div>
                <Send size={14} className="shrink-0 text-muted" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Draft preview */}
      <div className="mt-4 rounded-2xl border border-line bg-card p-5">
        <div className="flex items-center justify-between">
          <p className="text-[0.62rem] font-bold uppercase tracking-[0.18em] text-muted">{t('Avas udkast')}</p>
          <button onClick={onAva} className="text-[0.72rem] font-semibold text-sage hover:underline cursor-pointer">{t('Rediger med Ava')}</button>
        </div>
        {preparing ? (
          <div className="flex items-center gap-2.5 py-6 text-ink-soft">
            <Loader2 size={16} className="animate-spin" /> {t('Ava skriver udkastet…')}
          </div>
        ) : prepError ? (
          <p className="mt-3 rounded-xl bg-shell px-4 py-3 text-[0.85rem] text-ink-soft">{prepError}</p>
        ) : draft ? (
          <>
            <p className="mt-3 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-muted">{t('Emne')}</p>
            <p className="mt-1 text-[0.95rem] font-semibold text-ink">{draft.subject}</p>
            <p className="mt-4 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-muted">{t('Besked')}</p>
            <p className="mt-1 whitespace-pre-wrap text-[0.88rem] leading-relaxed text-ink-soft">{draft.body_template}</p>
            <p className="mt-3 text-[0.72rem] text-muted">{t('Ava tilpasser hver mail til det enkelte venue før afsendelse.')}</p>
          </>
        ) : null}
      </div>

      {approveMsg && (
        <p className="mt-4 rounded-xl bg-terracotta-tint px-4 py-3 text-[0.85rem] text-terracotta">{approveMsg}</p>
      )}

      {/* Actions */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          onClick={() => void approve()}
          disabled={approving || preparing || !draft || recipients.length === 0}
          className="flex items-center gap-2 rounded-full bg-ink px-7 py-3.5 text-[0.85rem] font-bold text-canvas transition-opacity hover:opacity-90 cursor-pointer disabled:opacity-50"
        >
          {approving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
          {t('Godkend & lad Ava sende')}
        </button>
        <button onClick={onBack}
          className="rounded-full rule bg-canvas px-5 py-3.5 text-[0.85rem] font-medium text-ink hover:bg-card transition-colors cursor-pointer">
          {t('Annuller')}
        </button>
      </div>
    </motion.div>
  );
}
