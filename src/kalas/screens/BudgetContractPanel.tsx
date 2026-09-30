"use client";

import { useEffect, useRef, useState } from 'react';
import { Upload, FileText, Trash2, ScanText, Send, Loader2, AlertTriangle } from 'lucide-react';
import { useLang } from '../i18n';
import { apiWrite } from '../notice';
import { cn } from '../ui';
import type { BudgetContractRow, ContractReview } from '@/lib/db/types';

type Contract = BudgetContractRow & { url?: string | null };

const kr = (n: number) => new Intl.NumberFormat('da-DK').format(Math.round(n));

/**
 * Contract upload + Ava (Gemini) review for a single budget line, keyed by
 * (eventId, category). Lets the couple upload a PDF/image, shows Ava's
 * structured review, applies suggested actual cost / reminder, and answers
 * follow-up questions about the contract.
 */
export default function BudgetContractPanel({
  eventId,
  category,
  onApply,
}: {
  eventId: string | null;
  category: string;
  onApply: (patch: { actual_cost?: number; reminder_at?: string }) => void;
}) {
  const { t } = useLang();
  const [contract, setContract] = useState<Contract | null>(null);
  const [busy, setBusy] = useState<'idle' | 'uploading' | 'reviewing' | 'asking'>('idle');
  const [error, setError] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // Load any existing contract for this line.
  useEffect(() => {
    if (!eventId) return;
    let alive = true;
    fetch(`/api/budget/contracts?eventId=${eventId}&category=${category}`)
      .then((r) => r.json())
      .then((d) => { if (alive && Array.isArray(d.contracts) && d.contracts[0]) setContract(d.contracts[0]); })
      .catch(() => {});
    return () => { alive = false; };
  }, [eventId, category]);

  const review: ContractReview | null = contract?.review ?? null;

  async function runReview(contractId: string) {
    setBusy('reviewing');
    setError('');
    try {
      const res = await fetch('/api/budget/contracts/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractId }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setContract((c) => (c ? { ...c, review: d.review } : c));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Ava kunne ikke gennemgå kontrakten lige nu'));
    } finally {
      setBusy('idle');
    }
  }

  async function onFile(file: File) {
    if (!eventId) return;
    setBusy('uploading');
    setError('');
    try {
      const form = new FormData();
      form.set('file', file);
      form.set('eventId', eventId);
      form.set('category', category);
      const res = await fetch('/api/budget/contracts', { method: 'POST', body: form });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setContract(d.contract);
      await runReview(d.contract.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Upload mislykkedes'));
      setBusy('idle');
    }
  }

  async function removeContract() {
    if (!contract) return;
    const removed = contract;
    setContract(null);
    setAnswer('');
    // Put it back if the delete did not go through.
    if (!(await apiWrite(`/api/budget/contracts?id=${removed.id}`, { method: 'DELETE' }, t))) setContract(removed);
  }

  async function ask() {
    if (!contract || !question.trim()) return;
    setBusy('asking');
    setAnswer('');
    try {
      const res = await fetch('/api/budget/contracts/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractId: contract.id, question: question.trim() }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setAnswer(d.answer ?? '');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Ava kunne ikke svare lige nu'));
    } finally {
      setBusy('idle');
    }
  }

  return (
    <div className="mt-2.5 rounded-xl rule bg-card p-3.5">
      {/* Upload / file header */}
      {!contract ? (
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-[0.8rem] text-muted">
            <ScanText size={14} className="text-sage-strong" />
            {t('Upload en kontrakt, så gennemgår Ava den for jer')}
          </span>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy !== 'idle'}
            className="flex items-center gap-1.5 rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-canvas hover:bg-ink/80 transition-colors cursor-pointer disabled:opacity-60">
            {busy === 'uploading' ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
            {t('Upload')}
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <a href={contract.url ?? undefined} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 text-[0.82rem] text-ink underline underline-offset-2 min-w-0">
            <FileText size={14} className="shrink-0 text-muted" />
            <span className="truncate">{contract.filename}</span>
          </a>
          <button onClick={removeContract} aria-label={t('Fjern kontrakt')}
            className="shrink-0 text-muted hover:text-terracotta transition-colors cursor-pointer">
            <Trash2 size={14} />
          </button>
        </div>
      )}

      <input ref={fileRef} type="file" accept="application/pdf,image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />

      {busy === 'reviewing' && (
        <p className="mt-3 flex items-center gap-2 text-[0.8rem] text-muted">
          <Loader2 size={14} className="animate-spin" /> {t('Ava gennemgår kontrakten…')}
        </p>
      )}
      {error && <p className="mt-3 text-[0.8rem] text-terracotta">{error}</p>}

      {/* Ava's review */}
      {review && (
        <div className="mt-3 space-y-3 rule-t pt-3">
          <p className="text-[0.85rem] leading-relaxed text-ink">{review.summary}</p>

          <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-[0.78rem]">
            {typeof review.totalPrice === 'number' && (
              <span className="text-muted">{t('Pris')} <span className="font-semibold text-ink">{kr(review.totalPrice)} {review.currency ?? 'kr'}</span></span>
            )}
            {typeof review.depositAmount === 'number' && (
              <span className="text-muted">{t('Depositum')} <span className="font-semibold text-ink">{kr(review.depositAmount)}</span></span>
            )}
          </div>

          {review.paymentSchedule && review.paymentSchedule.length > 0 && (
            <div className="space-y-1">
              <span className="eyebrow">{t('Betalingsplan')}</span>
              {review.paymentSchedule.map((p, i) => (
                <div key={i} className="flex justify-between text-[0.8rem]">
                  <span className="text-ink">{p.label}{p.dueDate ? <span className="text-muted"> · {p.dueDate}</span> : null}</span>
                  {typeof p.amount === 'number' && <span className="font-serif text-ink">{kr(p.amount)} kr</span>}
                </div>
              ))}
            </div>
          )}

          {review.cancellationPolicy && (
            <p className="text-[0.78rem] text-muted"><span className="font-medium text-ink">{t('Afbestilling:')} </span>{review.cancellationPolicy}</p>
          )}

          {review.redFlags && review.redFlags.length > 0 && (
            <div className="rounded-lg bg-terracotta-wash px-3 py-2">
              <span className="flex items-center gap-1.5 text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-red-800">
                <AlertTriangle size={12} /> {t('Vær opmærksom på')}
              </span>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[0.78rem] text-red-800/90">
                {review.redFlags.map((f, i) => <li key={i}>{f}</li>)}
              </ul>
            </div>
          )}

          {/* Apply suggestions */}
          {(typeof review.suggestedActualCost === 'number' || review.suggestedReminderDate) && (
            <div className="flex flex-wrap gap-2">
              {typeof review.suggestedActualCost === 'number' && (
                <button onClick={() => onApply({ actual_cost: review.suggestedActualCost })}
                  className="rounded-full rule bg-shell px-3 py-1 text-[0.75rem] text-ink hover:bg-sage-tint transition-colors cursor-pointer">
                  {t('Udfyld faktisk pris')} ({kr(review.suggestedActualCost)})
                </button>
              )}
              {review.suggestedReminderDate && (
                <button onClick={() => onApply({ reminder_at: review.suggestedReminderDate })}
                  className="rounded-full rule bg-shell px-3 py-1 text-[0.75rem] text-ink hover:bg-sage-tint transition-colors cursor-pointer">
                  {t('Sæt påmindelse')} ({review.suggestedReminderDate})
                </button>
              )}
            </div>
          )}

          {/* Ask Ava */}
          <div className="rule-t pt-3">
            <div className="flex items-center gap-2">
              <input value={question} onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') ask(); }}
                placeholder={t('Spørg Ava om kontrakten…')}
                className="flex-1 rule rounded-lg bg-shell px-3 py-1.5 text-[0.8rem] text-ink placeholder:text-muted/60 focus:outline-none" />
              <button onClick={ask} disabled={busy === 'asking' || !question.trim()} aria-label={t('Spørg')}
                className="shrink-0 rounded-full bg-ink p-2 text-canvas hover:bg-ink/80 transition-colors cursor-pointer disabled:opacity-50">
                {busy === 'asking' ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
              </button>
            </div>
            {answer && <p className="mt-2 text-[0.82rem] leading-relaxed text-ink">{answer}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
