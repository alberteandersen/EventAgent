"use client";

/* Contact ONE vendor. Ava composes the email in the vendor's own language,
   the couple reads and edits it, and only then does it go out, the same
   approve-before-send contract as the bulk flow, minus the batch. */

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Check, Languages, Mail, X } from 'lucide-react';
import { cn } from './ui';
import { useLang } from './i18n';
import { kalasSignatureHtml } from '@/lib/gmail/signature';

interface Prepared {
  toEmail: string;
  subject: string;
  body: string;
  language: { code: string; name: string; source: string };
}

/** Danish names for the languages Ava writes in; the English name rides along
 *  on prepared.language.name, so the badge is localized without a second map. */
const LANG_DA: Record<string, string> = {
  en: 'engelsk', da: 'dansk', sv: 'svensk', nb: 'norsk', fi: 'finsk',
  is: 'islandsk', de: 'tysk', fr: 'fransk', it: 'italiensk', es: 'spansk',
  pt: 'portugisisk', nl: 'hollandsk', pl: 'polsk', cs: 'tjekkisk',
  el: 'græsk', hu: 'ungarsk', hr: 'kroatisk', ro: 'rumænsk', tr: 'tyrkisk',
  et: 'estisk', lv: 'lettisk', lt: 'litauisk', sl: 'slovensk',
  sk: 'slovakisk', bg: 'bulgarsk',
};

/** Server error codes → a Danish source string t() can localize. Keeps the
 *  API language-agnostic: it returns a stable code, the client translates. */
const ERROR_BY_CODE: Record<string, string> = {
  no_contact_email:
    'Ava kunne ikke finde en mailadresse til leverandøren. Tilføj den manuelt og prøv igen.',
  already_contacted: 'Ava har allerede skrevet til denne leverandør.',
  outreach_unavailable: 'Avas postkasse er ved at blive sat op, prøv igen om lidt.',
};

export default function OutreachDialog({
  venueId,
  venueName,
  onClose,
  onSent,
}: {
  venueId: string;
  venueName: string;
  onClose: () => void;
  onSent: () => void;
}) {
  const { t, lang } = useLang();
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  // Prefer our own localized copy for known error codes; fall back to the
  // server's message, then a generic line.
  const messageForError = (data: { error?: string; message?: string }, fallback: string) => {
    const known = data.error && ERROR_BY_CODE[data.error];
    if (known) return t(known);
    return data.message ?? t(fallback);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/venues/${venueId}/outreach/prepare`, { method: 'POST' });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(messageForError(data, 'Ava kunne ikke skrive henvendelsen.'));
          return;
        }
        setPrepared(data as Prepared);
        setSubject(data.subject);
        setBody(data.body);
      } catch {
        if (!cancelled) setError(t('Noget gik galt, prøv igen.'));
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venueId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !sending) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, sending]);

  const send = async () => {
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/venues/${venueId}/outreach/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, body }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(messageForError(data, 'Kunne ikke sende, prøv igen.'));
        return;
      }
      setSent(true);
      onSent();
      setTimeout(onClose, 1400);
    } catch {
      setError(t('Kunne ikke sende, prøv igen.'));
    } finally {
      setSending(false);
    }
  };

  // Language the email was written in, named in the app's language: the Danish
  // map in DA, the canonical English name (already on the payload) in EN.
  const langLabel = prepared
    ? lang === 'da'
      ? LANG_DA[prepared.language.code] ?? prepared.language.name.toLowerCase()
      : prepared.language.name
    : null;

  // The caller mounts this conditionally inside an <AnimatePresence>, which
  // is what lets the exit variants below actually play.
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 px-5 backdrop-blur-sm"
      onClick={() => { if (!sending) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 360, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[86vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-line bg-white shadow-[0_32px_80px_-16px_rgba(0,0,0,0.28)]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-line-soft px-6 py-5">
          <div className="min-w-0">
            <p className="text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-sage">
              {t('Ava skriver til')}
            </p>
            <h2 className="mt-1 truncate font-serif text-[1.3rem] text-ink">{venueName}</h2>
            {prepared && (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[0.72rem] text-muted">
                <span className="inline-flex items-center gap-1.5">
                  <Mail size={12} /> {prepared.toEmail}
                </span>
                {langLabel && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-sage-wash px-2 py-0.5 text-ink">
                    <Languages size={12} /> {t('Skrevet på {sprog}', { sprog: langLabel })}
                  </span>
                )}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            aria-label={t('Luk')}
            className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted transition-colors hover:bg-shell disabled:opacity-40"
          >
            <X size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {!prepared && !error && (
            <div className="space-y-3 py-8 text-center">
              <div className="mx-auto h-1.5 w-24 animate-pulse rounded-full bg-line-soft" />
              <p className="text-[0.85rem] text-muted">{t('Ava skriver henvendelsen…')}</p>
            </div>
          )}

          {error && !prepared && (
            <p className="rounded-[14px] bg-[#faf4ef] px-4 py-3 text-[0.85rem] text-terracotta">{error}</p>
          )}

          {prepared && (
            <div className="space-y-4">
              <label className="block">
                <span className="text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-sage">
                  {t('Emne')}
                </span>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  disabled={sending || sent}
                  className="mt-1.5 w-full rounded-[12px] border border-line-soft bg-white px-3 py-2 text-[0.9rem] text-ink outline-none focus:border-ink disabled:opacity-60"
                />
              </label>
              <label className="block">
                <span className="text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-sage">
                  {t('Besked')}
                </span>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  disabled={sending || sent}
                  rows={14}
                  className="mt-1.5 w-full resize-y rounded-[12px] border border-line-soft bg-white px-3 py-2.5 text-[0.88rem] leading-relaxed text-ink outline-none focus:border-ink disabled:opacity-60"
                />
              </label>
              {/* Appended at send time, so it can't be edited away by accident.
                  Rendered from the same constant the mail is built from. */}
              <div>
                <span className="text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-sage">
                  {t('Signatur · tilføjes automatisk')}
                </span>
                <div
                  className="mt-1.5 rounded-[12px] border border-dashed border-line-soft bg-white px-3 py-3"
                  dangerouslySetInnerHTML={{ __html: kalasSignatureHtml() }}
                />
              </div>
              {error && (
                <p className="rounded-[14px] bg-[#faf4ef] px-4 py-3 text-[0.85rem] text-terracotta">{error}</p>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-line-soft px-6 py-4">
          <p className="text-[0.72rem] text-muted">
            {t('Svar lander i jeres henvendelser.')}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={sending}
              className="h-9 cursor-pointer rounded-full px-4 text-xs font-semibold text-muted transition-colors hover:bg-shell disabled:opacity-40"
            >
              {t('Annuller')}
            </button>
            <button
              type="button"
              onClick={() => void send()}
              disabled={!prepared || sending || sent || !subject.trim() || !body.trim()}
              className={cn(
                'flex h-9 cursor-pointer items-center gap-1.5 rounded-full px-4 text-xs font-semibold uppercase tracking-[0.12em] transition-opacity',
                sent ? 'bg-sage-wash text-ink' : 'bg-ink text-paper hover:opacity-85',
                'disabled:cursor-not-allowed disabled:opacity-45',
              )}
            >
              {sent ? (<><Check size={13} /> {t('Sendt')}</>) : sending ? t('Sender…') : t('Godkend & send')}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
